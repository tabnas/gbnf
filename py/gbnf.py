"""gbnf — validate text against a llama.cpp GBNF grammar, from Python.

GBNF is the grammar notation llama.cpp uses for *constrained decoding*:
the sampler masks out any token that would take generation outside the
grammar, so a model physically cannot emit malformed output. This module
answers the question that sits either side of that: **does this text
actually conform to this grammar?**

That question comes up constantly and is awkward to answer otherwise:

- The grammar is only applied at generation time, so output produced
  without it — a cached completion, another provider, a hand-written
  fixture, a fine-tuning target — is unchecked.
- A grammar you wrote may not accept what you think it does. Checking a
  known-good sample against it is how you find out before a run, not
  after.
- Constrained decoding guarantees conformance to the grammar, not that
  the grammar says what you meant.

The work is done by two C shared libraries, both written in Go and both
exporting the uniform tabnas C ABI (``tabnas_version``,
``tabnas_grammar``, ``tabnas_parse``, ``tabnas_grammar_free``,
``tabnas_free``). This module is a ctypes binding over them:

- ``libtabnasgbnf`` (this repository's ``go/clib``) reads GBNF text and
  compiles it to a *recognition spec*, which is pure data.
- ``libtabnasparser`` (the engine, from tabnas/parser) loads that spec
  and checks text against it.

Nothing here reimplements GBNF, so what Python accepts is exactly what
every other tabnas runtime accepts::

    import gbnf

    with gbnf.Grammar(open("json.gbnf").read()) as g:
        g.accepts('{"a": 1}')      # True
        g.accepts('{"a": 1,}')     # False

        verdict = g.check('{"a": 1,}')
        verdict.accept             # False
        verdict.error["code"]      # "unexpected"
        verdict.error["message"]   # why

Build both libraries first::

    (cd go/clib && ./build.sh)          # libtabnasgbnf, in this repository
    (cd ../parser/go/clib && ./build.sh) # libtabnasparser, in tabnas/parser

Set ``GBNF_LIB`` and ``TABNAS_LIB`` to point at them, or pass ``path=``
and ``engine=``. :func:`compile_spec` needs only ``libtabnasgbnf``.

TWO LIBRARIES, ONE SET OF SYMBOL NAMES. Both libraries export the same
five symbols, so each is opened with ``RTLD_LOCAL`` and every call goes
to the library that owns the handle or string. A C program that links
both at build time gets one library's ``tabnas_parse`` answering for
both; load them dynamically instead.

THREE OUTCOMES, NOT TWO. A grammar that does not compile raises
:class:`GbnfError`; an input outside the language returns a falsy
:class:`Verdict`. Collapsing those would tell you your model's output
was wrong when in fact your grammar was.

A NOTE ON PROCESSES. Each library carries a Go runtime, and a Go runtime
does not survive ``os.fork()`` intact. If you use ``multiprocessing``,
choose the ``spawn`` or ``forkserver`` start method rather than ``fork``.
"""

from __future__ import annotations

import ctypes
import json
import os
import platform
import re
from dataclasses import dataclass, field
from typing import Any, Optional

__all__ = ["Grammar", "Verdict", "GbnfError", "compile_spec", "load",
           "load_engine", "version"]


class GbnfError(Exception):
    """The call itself was wrong — a grammar that does not compile, a
    grammar already closed, a library that is missing or is not the one
    expected.

    ``error`` is the library's structured payload when there is one: for
    a grammar that does not compile, the front-end's own diagnostic.

    NOT raised when input fails to parse: that is an answer, not an
    error. See :class:`Verdict`.
    """

    def __init__(self, message: str, error: Optional[dict] = None):
        super().__init__(message)
        self.error = error


@dataclass(frozen=True)
class Verdict:
    """The result of checking one input against a grammar.

    ``error`` is the engine's structured diagnostic when the input was
    rejected: ``code``, ``message``, ``row``, ``col``, ``pos`` and the
    rest. Only ``code`` is contractual across runtimes.
    """

    accept: bool
    error: Optional[dict] = field(default=None)

    def __bool__(self) -> bool:
        return self.accept


def _platform():
    ext = {"Windows": ".dll", "Darwin": ".dylib"}.get(platform.system(), ".so")
    arch = {"x86_64": "amd64", "AMD64": "amd64", "aarch64": "arm64",
            "arm64": "arm64"}.get(platform.machine(), platform.machine())
    goos = {"Windows": "windows", "Darwin": "darwin"}.get(
        platform.system(), "linux")
    return ext, goos, arch


def _first_existing(candidates) -> Optional[str]:
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _default_lib_path() -> str:
    if env := os.environ.get("GBNF_LIB"):
        return env
    ext, goos, arch = _platform()
    here = os.path.dirname(os.path.abspath(__file__))
    found = _first_existing((
        os.path.join(here, f"libtabnasgbnf{ext}"),
        os.path.join(here, "..", "go", "clib", "dist",
                     f"libtabnasgbnf-{goos}-{arch}{ext}"),
    ))
    if found:
        return found
    raise GbnfError(
        "cannot find libtabnasgbnf, the GBNF front-end library. Build it "
        "with `cd go/clib && ./build.sh`, then set GBNF_LIB to the result "
        "or pass path= to gbnf.load()."
    )


# The engine library is libtabnasparser, which loads a spec through
# tabnas_grammar. tabnas/parser releases before the uniform ABI (0.12.0
# and earlier) shipped it as libtabnas, loading through
# tabnas_grammar_json; both are accepted, the current name first.
_ENGINE_NAMES = ("libtabnasparser", "libtabnas")
_ENGINE_LOADERS = ("tabnas_grammar", "tabnas_grammar_json")


def _default_engine_path() -> str:
    if env := os.environ.get("TABNAS_LIB"):
        return env
    ext, goos, arch = _platform()
    here = os.path.dirname(os.path.abspath(__file__))
    sibling = os.path.join(here, "..", "..", "parser", "go", "clib", "dist")
    found = _first_existing(
        [os.path.join(here, f"{n}{ext}") for n in _ENGINE_NAMES]
        + [os.path.join(sibling, f"{n}-{goos}-{arch}{ext}")
           for n in _ENGINE_NAMES]
    )
    if found:
        return found
    raise GbnfError(
        "cannot find libtabnasparser, the tabnas engine library. Build it "
        "from tabnas/parser (`cd go/clib && ./build.sh`) or take it from a "
        "tabnas/parser GitHub Release, then set TABNAS_LIB to it or pass "
        "engine= to gbnf.Grammar() or gbnf.load_engine()."
    )


def _open(path: str, loaders) -> ctypes.CDLL:
    """Open one library and declare the uniform ABI on it.

    ``loaders`` names the symbol that builds a handle, in order of
    preference; the first one the library exports is declared.
    RTLD_LOCAL keeps the library's symbols out of the global namespace,
    since the two libraries this module loads export the same names.
    """
    lib = ctypes.CDLL(path, mode=ctypes.RTLD_LOCAL)
    loader = next((n for n in loaders if hasattr(lib, n)), None)
    common = ("tabnas_version", "tabnas_parse", "tabnas_grammar_free",
              "tabnas_free")
    if loader is None or not all(hasattr(lib, n) for n in common):
        raise GbnfError(
            f"{path} does not export the uniform tabnas C ABI; rebuild it "
            "from a current checkout")

    # Returned strings are ours to free, so they come back as void* —
    # ctypes would otherwise copy a c_char_p and lose the pointer we
    # have to hand to tabnas_free.
    lib.tabnas_version.restype = ctypes.c_void_p
    lib.tabnas_version.argtypes = []
    getattr(lib, loader).restype = ctypes.c_void_p
    getattr(lib, loader).argtypes = [ctypes.c_char_p, ctypes.c_int]
    lib.tabnas_parse.restype = ctypes.c_void_p
    lib.tabnas_parse.argtypes = [ctypes.c_longlong, ctypes.c_char_p,
                                 ctypes.c_int]
    lib.tabnas_grammar_free.restype = None
    lib.tabnas_grammar_free.argtypes = [ctypes.c_longlong]
    lib.tabnas_free.restype = None
    lib.tabnas_free.argtypes = [ctypes.c_void_p]
    return lib


_lib = None
_engine = None


def load(path: Optional[str] = None):
    """Load ``libtabnasgbnf``, the GBNF front-end. Called automatically
    on first use.

    An explicit ``path`` is remembered, so the documented
    ``gbnf.load(path=...)`` then ``gbnf.Grammar(src)`` sequence works —
    caching only the auto-discovered library would send the second call
    back to discovery and fail for anyone whose library is not on the
    default search path.
    """
    global _lib
    if _lib is not None and path is None:
        return _lib
    path = path or _default_lib_path()
    lib = _open(path, ("tabnas_grammar",))
    doc = _call(lib, lib.tabnas_version())
    if doc.get("format") != "gbnf":
        raise GbnfError(
            f"{path} is {doc.get('lib') or 'an unknown library'}, not "
            "libtabnasgbnf. The engine library goes in engine= or TABNAS_LIB.")
    _lib = lib
    return lib


def load_engine(path: Optional[str] = None):
    """Load ``libtabnasparser``, the engine that checks text against a
    compiled spec. Called automatically by :class:`Grammar`; an explicit
    ``path`` is remembered, as for :func:`load`.
    """
    global _engine
    if _engine is not None and path is None:
        return _engine
    path = path or _default_engine_path()
    lib = _open(path, _ENGINE_LOADERS)
    doc = _call(lib, lib.tabnas_version())
    # libtabnasparser reports format "parser"; the older libtabnas
    # reported none. Anything else is a format library, which would
    # refuse the spec with a less helpful message.
    if doc.get("format", "parser") != "parser":
        raise GbnfError(
            f"{path} is {doc.get('lib') or 'an unknown library'}, not the "
            "engine library libtabnasparser.")
    _engine = lib
    return lib


def _load_spec(lib, spec: bytes) -> dict:
    loader = next(getattr(lib, n) for n in _ENGINE_LOADERS if hasattr(lib, n))
    return _call(lib, loader(spec, len(spec)))


def _call(lib, ptr) -> dict:
    """Decode a returned document and release it with the library that
    allocated it."""
    if not ptr:
        raise GbnfError("the library returned nothing")
    try:
        return json.loads(ctypes.string_at(ptr).decode("utf-8"))
    finally:
        lib.tabnas_free(ptr)


def _as_bytes(src: Any, what: str) -> bytes:
    if isinstance(src, str):
        return src.encode("utf-8")
    if not isinstance(src, (bytes, bytearray)):
        raise TypeError(f"{what} must be str or bytes")
    return bytes(src)


_ANSI = re.compile(r"\x1b\[[0-9;]*m")


def _headline(err: Any, fallback: str) -> str:
    """One clean line from an error payload.

    A failed call carries ``message``. The front-end's diagnostic for
    GBNF that does not compile carries ``Message`` instead, coloured for
    a terminal. An exception message wants neither the colour nor the
    continuation lines.
    """
    msg = None
    if isinstance(err, dict):
        msg = err.get("message") or err.get("Message")
    return _ANSI.sub("", str(msg or fallback)).split("\n", 1)[0]


def _fail(res: dict, fallback: str) -> GbnfError:
    err = res.get("error")
    return GbnfError(_headline(err, fallback),
                     err if isinstance(err, dict) else None)


def version() -> dict:
    """Which front-end library is loaded, and the ABI template revision it
    was built from: ``{"lib": "libtabnasgbnf", "format": "gbnf",
    "template": "v3"}``.

    It carries no front-end or engine version. The library's version is
    the ``go/v<version>`` release it was built from, and every rejection
    reports the engine's in ``Verdict.error["version"]``.
    """
    lib = load()
    doc = _call(lib, lib.tabnas_version())
    return {k: doc.get(k) for k in ("lib", "format", "template")}


def compile_spec(src: Any, *, path: Optional[str] = None,
                 as_text: bool = False):
    """Compile GBNF into a serialized recognition spec: pure data that the
    engine can load and run WITHOUT this front-end present.

    Compile once, validate anywhere::

        spec = gbnf.compile_spec(open("json.gbnf").read(), as_text=True)
        # ship `spec` to a service that has libtabnasparser but no GBNF
        # front-end; it can now validate against the grammar

    Returns a dict, or its JSON text when ``as_text`` is set. A regex
    travels as an ordinary ``"@~/src/flags"`` string, so re-encoding the
    dict with any JSON encoder is safe.

    Raises :class:`GbnfError` if the grammar does not compile. A failure
    never yields a spec, so you cannot ship an empty grammar believing it
    worked. Needs only ``libtabnasgbnf``.
    """
    lib = load(path)
    src = _as_bytes(src, "grammar source")

    res = _call(lib, lib.tabnas_grammar(None, 0))
    if not res.get("ok"):
        raise _fail(res, "the front-end would not start")
    handle = int(res["handle"])
    try:
        # Length is passed explicitly: a NUL-terminated read would stop
        # at the first zero byte.
        res = _call(lib, lib.tabnas_parse(handle, src, len(src)))
    finally:
        lib.tabnas_grammar_free(handle)

    if not res.get("ok"):
        raise _fail(res, "compile failed")
    if not res.get("accept"):
        raise _fail(res, "grammar failed to compile")
    if "value" not in res:
        raise GbnfError(res.get("valueError") or "the library returned no spec")
    spec = res["value"]
    if as_text:
        return json.dumps(spec, ensure_ascii=False, separators=(",", ":"))
    return spec


class Grammar:
    """A compiled GBNF grammar, ready to check inputs against.

    ``src`` is GBNF notation, the text of a ``.gbnf`` file. It is
    compiled by ``libtabnasgbnf`` (``path=``) and loaded into the engine,
    ``libtabnasparser`` (``engine=``). Raises :class:`GbnfError` if it
    does not compile. Use as a context manager, or call :meth:`close`,
    to release the underlying handle deterministically.
    """

    def __init__(self, src: Any, *, path: Optional[str] = None,
                 engine: Optional[str] = None):
        self._handle = None
        spec = compile_spec(src, path=path, as_text=True).encode("utf-8")
        self._lib = load_engine(engine)

        res = _load_spec(self._lib, spec)
        if not res.get("ok"):
            raise _fail(res, "the engine refused the compiled spec")
        self._handle = int(res["handle"])

    @classmethod
    def from_file(cls, path: str, **kw) -> "Grammar":
        """Compile the grammar in a ``.gbnf`` file."""
        with open(path, "rb") as f:
            return cls(f.read(), **kw)

    def check(self, src: Any) -> Verdict:
        """Check one input. Returns a :class:`Verdict`; never raises for
        a rejection."""
        if self._handle is None:
            raise GbnfError("this grammar has been closed")
        src = _as_bytes(src, "src")

        # Length is passed explicitly: input is bytes and may contain a
        # zero byte, which a NUL-terminated read would silently truncate.
        res = _call(self._lib, self._lib.tabnas_parse(
            self._handle, src, len(src)))
        if not res.get("ok"):
            raise _fail(res, "parse failed")
        return Verdict(accept=bool(res.get("accept")), error=res.get("error"))

    def accepts(self, src: Any) -> bool:
        """True when src is in this grammar's language."""
        return self.check(src).accept

    def close(self) -> None:
        if getattr(self, "_handle", None) is not None:
            self._lib.tabnas_grammar_free(self._handle)
            self._handle = None

    def __enter__(self) -> "Grammar":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass
