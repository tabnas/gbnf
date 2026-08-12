# libtabnasgbnf — the C ABI

A llama.cpp GBNF validator as a C shared library, so languages with no
tabnas port can ask the one question GBNF users keep needing answered:
**does this text conform to this grammar?** Python via `ctypes` is the
motivating case (see [`../../py/`](../../py/)), but the surface is plain
C and works from anything with an FFI.

```sh
./build.sh            # host
ZIG=/path/to/zig ./build.sh all
```

## Why this exists

GBNF drives *constrained decoding*: llama.cpp masks any token that would
take generation outside the grammar, so a model cannot emit malformed
output. That guarantee holds only at generation time, and only for the
grammar as written — which leaves the two questions this library
answers:

- **Output produced without the grammar is unchecked.** A cached
  completion, another provider, a hand-written fixture, a fine-tuning
  target. Nothing verified any of it.
- **A grammar may not accept what its author thinks.** Checking a
  known-good sample against it is how you find that out before a run
  rather than after.

Constrained decoding guarantees conformance to the grammar. It does not
guarantee the grammar says what you meant.

## Notation in, verdict out

Unlike `libtabnas` (the engine's own C ABI, which is grammar-agnostic and
takes a serialized `GrammarSpec`), this library takes **GBNF text** and
compiles it inside.

That is a correctness decision, not a convenience. A GBNF grammar's
lexing configuration — an empty ignore set, every default matcher off,
negotiated lexing on — *is* part of the language it accepts, because
GBNF is scannerless and anything the lexer does on its own initiative
changes which inputs are in the language. An in-process install carries
that configuration intact.

Serializing a grammar and reloading it elsewhere is a separate question
with its own history: until [tabnas/bnf#14] the serialized form dropped
exactly those options, so a reloaded `arithmetic.gbnf` lexed `a+b` as one
text token and rejected `a+b=c`. Compiling natively sidesteps that class
of bug entirely, which is why the C surface is shaped this way.

[tabnas/bnf#14]: https://github.com/tabnas/bnf/pull/14

## The contract

| Function | Returns |
|---|---|
| `gbnf_version()` | `{"ok":true,"version":"…","engine":"…"}` |
| `gbnf_grammar(src, len)` | `{"ok":true,"handle":N}` |
| `gbnf_parse(handle, src, len)` | `{"ok":true,"accept":true}` or `{"ok":true,"accept":false,"error":{…}}` |
| `gbnf_compile(src, len)` | `{"ok":true,"spec":"…"}` |
| `gbnf_grammar_free(handle)` | — |
| `gbnf_free(str)` | — |

Five rules, each load-bearing:

1. **Every call returns JSON.** A C ABI has one return value and no
   exceptions. Rather than out-params or a thread-local error slot, each
   entry point returns a document, so a binding in any language is
   *call, decode* and the error contract is identical everywhere.
2. **Three outcomes, not two.** A broken grammar is `ok:false` with code
   `parse` or `compile`; an input outside the language is `ok:true,
   accept:false`; an accepted input is `ok:true, accept:true`.
   Collapsing the first two would tell a caller their model output was
   wrong when in fact their grammar was.
3. **A rejection is an answer, not a failure.** `ok:false` is reserved
   for the call itself being wrong — an unknown handle, a grammar that
   will not compile, an engine bug — so a caller can branch without
   reading messages.
4. **Lengths are explicit.** Grammar and source arguments take a byte
   length and are *not* read as NUL-terminated C strings. Validator
   input is arbitrary bytes and may legitimately contain a zero byte;
   truncating there would answer a question the caller did not ask.
5. **The caller owns what it is given.** Every `char*` returned must be
   released with `gbnf_free` (it is `malloc`'d, so that is `free(3)` —
   do not use another allocator's). Every handle must be released with
   `gbnf_grammar_free`.

Handles are safe to use from several threads: each carries a mutex,
because a `*Tabnas` is not safe for concurrent `Parse` and an FFI caller
is under no obligation to serialise — CPython, for one, releases the GIL
for the duration of a `ctypes` call.

## Cross-compiling

cgo needs a C toolchain per target, which normally forces a matrix of
native CI runners. `zig cc` is a cross compiler for all of them, so one
Linux box produces Linux and Windows artifacts:

| target | how |
|---|---|
| `linux/amd64`, `linux/arm64` | zig, cross |
| `windows/amd64` | zig, cross |
| `darwin/*` | **native macOS host only** |

macOS is the exception: linking needs Apple's SDK (`CoreFoundation`,
`libresolv`), which zig cannot redistribute. `build.sh all` skips darwin
unless it is already running on it.

## Layout

- `core.go` — the behaviour, in plain Go.
- `gbnf_c.go` — the cgo shim: `(pointer, length)` in, `malloc`'d string
  out, nothing else.
- `core_test.go` — the contract, graded against `test/corpus` in both
  directions.

The split is not decoration. Go does not support cgo in `_test.go`
files, so anything beside `import "C"` is unreachable from a test;
keeping the behaviour in `core.go` is what makes it testable.

## Compile once, validate anywhere

`gbnf_compile` is the other door. It turns GBNF text into a serialized
**recognition spec** — pure data that `libtabnas` loads and runs with no
GBNF front-end present:

```
GBNF text ──libtabnasgbnf──▶ recognition spec ──libtabnas──▶ verdicts
              (compile here)                    (validate anywhere)
```

Compile at build time, ship the spec, validate in a service that never
needs to know GBNF exists. Recognition rather than pure form because the
AST does not cross this boundary — tree-building hooks would be dead
weight in a spec whose only job is accept/reject.

**Why this arrived later than the rest of the surface.** Installing
natively keeps the grammar's lexing configuration by construction;
serializing has to carry it deliberately, and until `@tabnas/bnf` v0.1.5
it did not. The emitted spec dropped GBNF's empty ignore set and
disabled matchers, so a reloaded `arithmetic.gbnf` lexed `a+b` as one
text token and rejected `a+b=c` — it loaded cleanly and answered
differently. Shipping that would have been worse than shipping nothing.

So the test for this function is not "it emitted valid JSON". It is
`TestCompiledSpecAgreesWithNativeInstall`: every corpus grammar
compiled, reloaded into a **bare engine**, and graded against all 23
accept/reject samples in both directions. `py/test_gbnf.py` does the
same across the two shared libraries.
