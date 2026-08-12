# gbnf — GBNF validation from Python

Check whether text conforms to a llama.cpp GBNF grammar.

```sh
cd ../go/clib && ./build.sh     # build the shared library first
cd ../../py && python3 -m unittest -v
```

```python
import gbnf

with gbnf.Grammar.from_file("json.gbnf") as g:
    g.accepts('{"a": 1}')       # True
    g.accepts('{"a": 1,}')      # False

    verdict = g.check('{"a": 1,}')
    verdict.accept              # False
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

A `ctypes` binding over the Go implementation, exposed as a C shared
library (`../go/clib`). Nothing here reimplements GBNF, so what Python
accepts is exactly what every other tabnas runtime accepts — the test
suite grades the same corpus grammars and the same samples as the Go and
TypeScript suites, in both directions.

## Three outcomes, not two

| situation | result |
|---|---|
| grammar does not compile | raises `GbnfError` |
| input outside the language | `Verdict(accept=False)`, falsy |
| input in the language | `Verdict(accept=True)`, truthy |

A rejection is an *answer*, not an exception. Only a broken grammar or a
misused handle raises — which is what stops a tool from blaming a
model's output when the grammar was at fault.

## Finding the library

`load()` looks for, in order:

1. `$GBNF_LIB`
2. `libtabnasgbnf.so` / `.dylib` / `.dll` beside this module
3. `../go/clib/dist/libtabnasgbnf-<goos>-<arch><ext>`

Or pass `path=` to `gbnf.Grammar(...)` / `gbnf.load(...)`.

## One caveat

The library carries a Go runtime, and a Go runtime does not survive
`os.fork()` intact. If you use `multiprocessing`, choose the `spawn` or
`forkserver` start method rather than `fork`.
