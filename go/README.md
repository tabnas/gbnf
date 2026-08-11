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
five of them.

```go
import (
    tabnas "github.com/tabnas/parser/go"
    gbnf "github.com/tabnas/gbnf/go"
)

tn := tabnas.Make()
spec, err := gbnf.Install(tn, `root ::= "hi" | "hello"`, nil)
```

**What parity still needs.** Negotiated lexing landed in
`parser/go` v0.8.5 and this front-end opts in, which is what makes
grading possible at all — `chess`, `japanese`, `json`, `json_arr` and
`list` now agree with TypeScript in **both** directions. Three
grammars do not yet: `arithmetic`, `c` and `english` compile and
correctly reject their near-misses, but cannot parse samples that are
inside their language. Those are asserted as expected failures in
`gbnf_test.go`, so a fix turns the suite red rather than passing
unnoticed.

The cause is one gap, not three: relex is necessary but not
sufficient. The shared compiler's contested-alternative guards —
FOLLOW / FOLLOW₂ repetition exits, keyword-shadow guards, left
factoring (`computeFollowSets`, `computeFollowPairs`, `leftFactor` in
the TypeScript `@tabnas/bnf`) — have no counterpart in `bnf/go`
v0.1.2, so a Go-compiled spec simply lacks the alternates that decide
those grammars. Closing it belongs to `@tabnas/bnf`, not here. This
front-end also has no `markClassesEager` port, which is a smaller,
local follow-on.

Astral character classes additionally have no serialisable form the Go
runtime can load (`ts/doc/known-gaps.md` §5).

The TypeScript implementation is canonical. The dialect, and the
scannerless limitations recorded in
[`ts/doc/known-gaps.md`](../ts/doc/known-gaps.md), are the contract
this port is held to.
