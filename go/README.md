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
rejected by policy. The suite mirrors `ts/test/gbnf.test.js`, compiles
all eight llama.cpp corpus grammars in
[`../test/corpus/`](../test/corpus/), and **grades accept/reject** on
all of them.

```go
import (
    tabnas "github.com/tabnas/parser/go"
    gbnf "github.com/tabnas/gbnf/go"
)

tn := tabnas.Make()
spec, err := gbnf.Install(tn, `root ::= "hi" | "hello"`, nil)
```

**Parity.** Two pieces made grading possible in both directions.
Negotiated lexing landed in `parser/go` v0.8.5 and this front-end opts
in; the shared compiler's contested-alternative guards — FOLLOW /
FOLLOW₂ repetition exits, keyword-shadow guards, left factoring —
landed in `bnf/go` v0.1.4 (tabnas/bnf#13). With both in place, **all
eight corpus grammars agree with TypeScript in both directions**;
`bnf/go/doc/differences.md` records how that was verified (65/65
accept, 30/30 reject against the tables `ts/test/corpus.test.js`
pins, and rule-for-rule emitter comparison on `c.gbnf`).

`corpusExpectedFailures` in `gbnf_test.go` is empty and stays: a new
gap goes in the table, and a closed one turns the suite red rather
than passing unnoticed. (Two of its former entries — c's
`int x = 1;` and english's trailing newline — turned out to be
outside their grammars' languages, mislabelled as gaps; they moved to
the reject table.)

Astral character classes additionally have no serialisable form the Go
runtime can load (`ts/doc/known-gaps.md` §5).

The TypeScript implementation is canonical. The dialect, and the
scannerless limitations recorded in
[`ts/doc/known-gaps.md`](../ts/doc/known-gaps.md), are the contract
this port is held to.
