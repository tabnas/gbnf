# gbnf — GBNF validation from Python

Check whether text conforms to a llama.cpp GBNF grammar.

```sh
cd ../go/clib && ./build.sh     # libtabnasgbnf, the GBNF front-end
# libtabnasparser, the engine: build it in a tabnas/parser checkout
# (cd go/clib && ./build.sh), or take it from a tabnas/parser Release
cd ../../py && TABNAS_LIB=/path/to/libtabnasparser.so python3 -m unittest -v
```

```python
import gbnf

with gbnf.Grammar.from_file("json.gbnf") as g:
    g.accepts('{"a": 1}')       # True
    g.accepts('{"a": 1,}')      # False

    verdict = g.check('{"a": 1,}')
    verdict.accept              # False
    verdict.error["code"]       # 'unexpected'
    verdict.error["message"]    # why, in one line
```

## Why you would want this

GBNF drives **constrained decoding**: llama.cpp masks any token that
would take generation outside the grammar, so a model cannot emit
malformed output. That guarantee is real, and it is narrower than it
first appears — it holds only at generation time, and only for the
grammar as actually written.

So:

- **Output produced without the grammar is unchecked.** Cached
  completions, another provider, hand-written fixtures, fine-tuning
  targets. Constrained decoding never touched any of it.
- **Your grammar may not accept what you think.** Running known-good
  samples through it is how you find out before a run rather than after
  a confusing failure.
- **Regression-test a grammar you edit.** A grammar is code; changing it
  can quietly narrow the language.

Python is where models are usually driven from, and until now answering
"does this conform?" there meant shelling out or reimplementing GBNF.

## What it is

A `ctypes` binding over two C shared libraries, both built from the Go
implementation and both exporting the uniform tabnas C ABI
(`tabnas_version`, `tabnas_grammar`, `tabnas_parse`,
`tabnas_grammar_free`, `tabnas_free`):

| library | from | does |
|---|---|---|
| `libtabnasgbnf` | this repository, `../go/clib` | GBNF text in, recognition spec out |
| `libtabnasparser` | tabnas/parser, `go/clib` | spec plus text in, verdict out |

`Grammar` uses both: the front-end compiles the grammar, and the engine
checks text against it with no GBNF front-end involved. Nothing here
reimplements GBNF, so what Python accepts is exactly what every other
tabnas runtime accepts. The test suite grades the same corpus grammars
and the same samples as the Go and TypeScript suites, in both
directions.

Both libraries export the same five symbol names. This module opens
each with `RTLD_LOCAL` and calls each through its own handle, so they
coexist in one process. A C program that links both at build time
cannot do that: one library's `tabnas_parse` would answer for both.

## Compile once, validate anywhere

`compile_spec` turns GBNF into a serialized recognition spec: pure data
the engine runs **without this front-end present**. It needs only
`libtabnasgbnf`:

```python
spec = gbnf.compile_spec(open("json.gbnf").read(), as_text=True)
# ship `spec` to a service that has libtabnasparser but no GBNF
# front-end; it can now validate against the grammar
```

Compile at build time, validate at run time somewhere else entirely.
`as_text=True` returns compact JSON text; without it you get a dict. A
regex travels as an ordinary `"@~/src/flags"` string, so re-encoding the
dict with any JSON encoder is safe.

A spec is only worth shipping if it accepts the same language as the
grammar. Serializing has to carry the grammar's lexing configuration
deliberately, and before `@tabnas/bnf` v0.1.5 it did not — the reloaded
grammar accepted a different language than the one you wrote. Every
`Grammar` verdict now goes through a compiled spec, so the corpus tests
here grade that path directly, and `go/clib/value_test.go` checks it
against a native install.

## Three outcomes, not two

| situation | result |
|---|---|
| grammar does not compile | raises `GbnfError` |
| input outside the language | `Verdict(accept=False)`, falsy |
| input in the language | `Verdict(accept=True)`, truthy |

A rejection is an *answer*, not an exception. Only a broken grammar, a
misused handle or a missing library raises. That is what stops a tool
from blaming a model's output when the grammar was at fault.
`GbnfError.error` holds the front-end's diagnostic for a grammar that
does not compile; `Verdict.error` is the engine's structured diagnostic,
whose `code` is the stable part.

`version()` names the loaded front-end and the C ABI revision it was
built from: `{"lib": "libtabnasgbnf", "format": "gbnf", "template":
"v3"}`. It carries no package or engine version.

## Finding the libraries

`load()` looks for the front-end, in order:

1. `$GBNF_LIB`
2. `libtabnasgbnf.so` / `.dylib` / `.dll` beside this module
3. `../go/clib/dist/libtabnasgbnf-<goos>-<arch><ext>`

`load_engine()` looks for the engine, in order:

1. `$TABNAS_LIB`
2. `libtabnasparser<ext>` beside this module
3. `../../parser/go/clib/dist/libtabnasparser-<goos>-<arch><ext>`, a
   sibling tabnas/parser checkout

At 2 and 3 it also accepts `libtabnas`, the engine library's name in
tabnas/parser 0.12.0 and earlier. Or pass `path=` and `engine=` to
`gbnf.Grammar(...)`, or a path to `gbnf.load(...)` and
`gbnf.load_engine(...)`. Without an engine the tests that check text
skip and say so; the `compile_spec` tests still run.

## One caveat

Each library carries a Go runtime, and a Go runtime does not survive
`os.fork()` intact. If you use `multiprocessing`, choose the `spawn` or
`forkserver` start method rather than `fork`.
