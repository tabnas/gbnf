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

The engine underneath is written in Go and exposed as a C shared library
(``go/clib``); this module is a ctypes binding over it. Nothing here
reimplements GBNF, so what Python accepts is exactly what every other
tabnas runtime accepts::

    import gbnf

    with gbnf.Grammar(open("json.gbnf").read()) as g:
        g.accepts('{"a": 1}')      # True
        g.accepts('{"a": 1,}')     # False

        verdict = g.check('{"a": 1,}')
        verdict.accept             # False
        verdict.error["message"]   # why

Build the library first::

    cd go/clib && ./build.sh

Set ``GBNF_LIB`` to point at it, or pass ``path=`` to ``load()``.

THREE OUTCOMES, NOT TWO. A grammar that does not compile raises
:class:`GbnfError`; an input outside the language returns a falsy
:class:`Verdict`. Collapsing those would tell you your model's output
was wrong when in fact your grammar was.

A NOTE ON PROCESSES. The library carries a Go runtime, and a Go runtime
does not survive ``os.fork()`` intact. If you use ``multiprocessing``,
choose the ``spawn`` or ``forkserver`` start method rather than ``fork``.
"""

from __future__ import annotations

import ctypes
import json
import os
import platform
from dataclasses import dataclass, field
from typing import Any, Optional

__all__ = ["Grammar", "Verdict", "GbnfError", "load", "version"]


class GbnfError(Exception):
    """The call itself was wrong — a grammar that does not compile, a
    grammar already closed.

    NOT raised when input fails to parse: that is an answer, not an
    error. See :class:`Verdict`.
    """


@dataclass(frozen=True)
class Verdict:
    """The result of checking one input against a grammar."""

    accept: bool
    error: Optional[dict] = field(default=None)

    def __bool__(self) -> bool:
        return self.accept


def _default_lib_path() -> str:
    if env := os.environ.get("GBNF_LIB"):
        return env
    ext = {"Windows": ".dll", "Darwin": ".dylib"}.get(platform.system(), ".so")
    arch = {"x86_64": "amd64", "AMD64": "amd64", "aarch64": "arm64",
            "arm64": "arm64"}.get(platform.machine(), platform.machine())
    goos = {"Windows": "windows", "Darwin": "darwin"}.get(
        platform.system(), "linux")
    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (
        os.path.join(here, f"libgbnf{ext}"),
        os.path.join(here, "..", "go", "clib", "dist",
                     f"libgbnf-{goos}-{arch}{ext}"),
    ):
        if os.path.exists(candidate):
            return candidate
    raise GbnfError(
        "cannot find the gbnf shared library. Build it with "
        "`cd go/clib && ./build.sh`, then set GBNF_LIB to the result "
        "or pass path= to gbnf.load()."
    )


_lib = None


def load(path: Optional[str] = None):
    """Load the shared library. Called automatically on first use."""
    global _lib
    if _lib is not None and path is None:
        return _lib

    lib = ctypes.CDLL(path or _default_lib_path())

    # Returned strings are ours to free, so they come back as void* —
    # ctypes would otherwise copy a c_char_p and lose the pointer we
    # have to hand to gbnf_free.
    lib.gbnf_version.restype = ctypes.c_void_p
    lib.gbnf_version.argtypes = []
    lib.gbnf_grammar.restype = ctypes.c_void_p
    lib.gbnf_grammar.argtypes = [ctypes.c_char_p, ctypes.c_int]
    lib.gbnf_parse.restype = ctypes.c_void_p
    lib.gbnf_parse.argtypes = [ctypes.c_longlong, ctypes.c_char_p,
                               ctypes.c_int]
    lib.gbnf_grammar_free.restype = None
    lib.gbnf_grammar_free.argtypes = [ctypes.c_longlong]
    lib.gbnf_free.restype = None
    lib.gbnf_free.argtypes = [ctypes.c_void_p]

    if path is None:
        _lib = lib
    return lib


def _call(lib, ptr) -> dict:
    """Decode a returned document and release it."""
    if not ptr:
        raise GbnfError("the library returned nothing")
    try:
        return json.loads(ctypes.string_at(ptr).decode("utf-8"))
    finally:
        lib.gbnf_free(ptr)


def version() -> dict:
    """The front-end and engine versions behind the loaded library."""
    lib = load()
    res = _call(lib, lib.gbnf_version())
    return {"gbnf": res.get("version"), "engine": res.get("engine")}


class Grammar:
    """A compiled GBNF grammar, ready to check inputs against.

    ``src`` is GBNF notation — the text of a ``.gbnf`` file. Raises
    :class:`GbnfError` if it does not compile. Use as a context manager,
    or call :meth:`close`, to release the underlying handle
    deterministically.
    """

    def __init__(self, src: Any, *, path: Optional[str] = None):
        self._lib = load(path)
        self._handle = None
        if isinstance(src, str):
            src = src.encode("utf-8")
        if not isinstance(src, (bytes, bytearray)):
            raise TypeError("grammar source must be str or bytes")
        src = bytes(src)

        res = _call(self._lib, self._lib.gbnf_grammar(src, len(src)))
        if not res.get("ok"):
            err = res.get("error", {})
            raise GbnfError(err.get("message", "grammar failed to compile"))
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
        if isinstance(src, str):
            src = src.encode("utf-8")
        if not isinstance(src, (bytes, bytearray)):
            raise TypeError("src must be str or bytes")
        src = bytes(src)

        # Length is passed explicitly: input is bytes and may contain a
        # zero byte, which a NUL-terminated read would silently truncate.
        res = _call(self._lib, self._lib.gbnf_parse(
            self._handle, src, len(src)))
        if not res.get("ok"):
            raise GbnfError(res.get("error", {}).get("message", "parse failed"))
        return Verdict(accept=bool(res.get("accept")), error=res.get("error"))

    def accepts(self, src: Any) -> bool:
        """True when src is in this grammar's language."""
        return self.check(src).accept

    def close(self) -> None:
        if getattr(self, "_handle", None) is not None:
            self._lib.gbnf_grammar_free(self._handle)
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
