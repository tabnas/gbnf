# github.com/tabnas/gbnf/go

Go port of [`@tabnas/gbnf`](../ts) — a llama.cpp GBNF front-end for the
[tabnas](https://github.com/tabnas/parser) parsing engine.

**Port status: front-end implemented.** `ParseGbnf` reads `.gbnf` text
into the shared grammar IR with a hand-written recursive-descent parser
(`parser_gbnf.go`), and `Gbnf` / `ToSpec` / `Install` (`facade.go`)
emit and install a `GrammarSpec` with GBNF's exact lexing — empty
ignore set, default matchers off, `lex.empty` computed from the IR.
The same validation passes as the TypeScript front-end run here:
mandatory `root`, defined references, tokenizer-token terminals
rejected by policy. The suite mirrors `ts/test/gbnf.test.js` and
compiles seven of the eight llama.cpp corpus grammars in
[`../test/corpus/`](../test/corpus/) — `english.gbnf` is not yet in
the Go census.

```go
import (
    tabnas "github.com/tabnas/parser/go"
    gbnf "github.com/tabnas/gbnf/go"
)

tn := tabnas.Make()
spec, err := gbnf.Install(tn, `root ::= "hi" | "hello"`, nil)
```

**What parity still needs.** Accept/reject conformance *grading* runs
only in `ts/`: the Go engine does not implement negotiated lexing
(`lex.relex` is "TypeScript only" in `parser/go`'s
`doc/differences.md`), and this front-end has no `markClassesEager`
port, so grammars whose terminals overlap compile here but may not
parse their own samples. That engine gap belongs to `@tabnas/parser`.
Astral character classes additionally have no serialisable form the Go
runtime can load (`ts/doc/known-gaps.md` §5).

The TypeScript implementation is canonical. The dialect, and the
scannerless limitations recorded in
[`ts/doc/known-gaps.md`](../ts/doc/known-gaps.md), are the contract
this port is held to.
