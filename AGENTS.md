# Agents Guide — gbnf

## What this project is

`@tabnas/gbnf` is a **compiler front-end**: it reads
[GBNF](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)
— the grammar notation llama.cpp uses for constrained decoding — and
emits a tabnas `GrammarSpec`. Installed on an engine, the spec parses
inputs in that grammar and builds a `{rule, src, kids}` AST.

It is not a plugin that adds a data format (contrast `@tabnas/zon` or
`@tabnas/json`). It is one of three front-ends onto a shared compiler:

```
GBNF text ──parseGbnf──▶ Grammar IR ──emitGrammarSpec──▶ GrammarSpec
          └─ @tabnas/gbnf ─┘        └──── @tabnas/bnf ────┘
```

[`@tabnas/bnf`](https://github.com/tabnas/bnf) parses no syntax. It
defines the IR (`Grammar` → `Production[]` → `Element`) and owns
everything downstream: repetition desugaring, left-recursion
elimination, tail-repeat rewriting, probe dispatch, literal lifting,
token allocation, first-set analysis, `$stepN` chain emission.
`@tabnas/abnf` (RFC 5234) and `@tabnas/ebnf` are the sibling front-ends.

**This repo owns exactly two things:** the notation (GBNF text → IR) and
the lexer settings the emitted spec carries, because scannerlessness is
a property of the notation rather than of the IR.

**The value proposition**: GBNF is consumed by llama.cpp, XGrammar (and
therefore vLLM and SGLang), KoboldCpp, LocalAI and node-llama-cpp, and
none of them can answer "does this string match my grammar?" without a
model. This can.

## Repository map

| Path | What it is |
|---|---|
| [`ts/src/converter.ts`](ts/src/converter.ts) | The front-end. `gbnfRules` (the tabnas meta-grammar that reads GBNF), the terminal decoders, the validation passes, and the emitted lexer settings. |
| [`ts/src/gbnf.ts`](ts/src/gbnf.ts) | Plugin facade — `tn.gbnf(src)` / `tn.gbnf.toSpec(src)`, plus the bare exports and `VERSION`. |
| [`ts/src/cli.ts`](ts/src/cli.ts) | `gbnf-check`, the validator CLI (`bin` in `package.json`). Compile a grammar, check samples, exit 0/1/2/3; `--json` for a stable machine-readable report. |
| [`ts/test/gbnf.test.js`](ts/test/gbnf.test.js) | The main suite: IR shape per construct, escapes, classes, repetition, errors, exact lexing, end-to-end parses, plugin surface. |
| [`ts/test/corpus.test.js`](ts/test/corpus.test.js) | The llama.cpp conformance corpus — compile-all, plus accept / reject / expected-failure samples. |
| [`ts/test/live.test.js`](ts/test/live.test.js) | The live corpus — llama.cpp's 70 expected JSON-schema-to-grammar outputs, compiled and parsed. |
| [`ts/test/cli.test.js`](ts/test/cli.test.js) | The CLI, spawned as a child process — exit codes, both report formats, stdin in both roles, the trailing-newline hint. |
| [`ts/test/doc-examples.test.js`](ts/test/doc-examples.test.js) | Runs every ` ```js ` fence in the repo's markdown that carries a `// =>` assertion. |
| [`ts/test/version.test.js`](ts/test/version.test.js) | The exported `VERSION` against `ts/package.json`. |
| [`test/corpus/`](test/corpus/) | llama.cpp's own `grammars/*.gbnf`, verbatim and **committed**. See the README there for provenance. |
| [`test/live/`](test/live/) | Schema-generated GBNF, extracted verbatim from llama.cpp's converter tests. See the README there. |
| [`ts/doc/`](ts/doc/) | 4-quadrant Diátaxis docs plus [`known-gaps.md`](ts/doc/known-gaps.md). |
| [`go/`](go/) | The Go port. Follows `ts/`; see [`go/README.md`](go/README.md). |

## Conformance claim

**Every grammar in llama.cpp's `grammars/` directory compiles.** Eight
files, copied verbatim at commit
`030ebb558a5820b444a8f836ed5cdd46c9b4bd7a`, tracked in
[`test/corpus/`](test/corpus/) and graded by
[`ts/test/corpus.test.js`](ts/test/corpus.test.js).

All eight also **parse real input** end to end, and reject near-miss
invalid input — both directions are graded. A second corpus,
[`test/live/`](test/live/), holds the 70 expected outputs of
llama.cpp's JSON-schema-to-grammar converter; all 70 compile, and all
70 are sampled in both directions, a census the suite itself pins
(`ts/test/live.test.js`).

Exactly one sample is recorded as an expected failure:

| Grammar | Sample | Cause |
|---|---|---|
| `chess.gbnf` | `Nf3` | stacked optional prefixes need backtracking (`known-gaps.md` §3) |

If it starts working the suite goes **red**, because the assertion is
`notEqual(err, null)`. That is deliberate: an expected failure that
quietly becomes a pass is a documentation bug. The three entries that
used to sit in this table — `arithmetic.gbnf`, `json.gbnf` and
`c.gbnf` — were resolved by negotiated lexing plus the shared
compiler's guards, and are written up as such in `known-gaps.md` §2.

**Do not narrow a corpus case to make it green.** The grammars are
upstream bytes; the whole point is that they are not tidied for us.

## Two things that are easy to get wrong

**1. GBNF string literals are case-SENSITIVE.** ABNF's are
case-insensitive by default; this is the opposite. The IR carries
`caseSensitive: true` and the shared emitter lowers it to a plain
`fixed.token` (an exact byte match) rather than an `i`-flagged regex.
Drop the flag and the grammar still compiles, still parses its own
examples, and quietly accepts `TRUE` for `"true"`. Asserted twice in
`ts/test/gbnf.test.js` — on the IR and through a parse.

**2. GBNF is scannerless; the engine is not.** The engine ships
`tokenSet.IGNORE = ['#SP','#LN','#CM']` and a full set of JSON-shaped
matchers. Left alone, `root ::= "a"` would accept `" a "` and a `#` in
the *input* would vanish as a comment. `applyExactLexing` in the
converter emits an empty ignore set and switches off
space/line/comment/string/number/text/value lexing, so what remains is
the grammar's own tokens. Removing any of that turns `tn.parse()` from
an acceptance test into a lenient one — silently.

## Design notes for the meta-grammar

The grammar that reads GBNF is itself a tabnas grammar
(`gbnfRules` in `ts/src/converter.ts`). Two decisions keep it short:

- **Free-form terminals are lexed whole and `eager$`.** String literals,
  character classes, repetition braces, tokenizer terminals and rule
  names are each one `match.token` regex flagged `eager$`, which opts
  out of the lexer's token-column gate. GBNF's terminals are
  distinguished by their first character, so tokenisation does not need
  to know what the parser expects. This is why the file has none of the
  two-token `s:` tcol-widening patterns the ABNF front-end needs.
- **A postfix run is ONE token (`#POST`).** A close-state loop in tabnas
  needs a `p:`/`r:` on every iteration and there is no child to push for
  a `*`, so lexing `*`, `+`, `?` and `{m,n}` as a run keeps `elem` a
  two-alternative rule and moves chaining (`x*?`) into `applyPostfix`.

Note `r.c[0]`, not `r.o[0]`, in `elem`'s close action: tokens matched by
a close-state alt land in the rule's close-token array.

## Repo-specific gotchas

- **Validation runs in `parseGbnf`, before `@tabnas/bnf` sees the IR.**
  This ordering is load-bearing: the shared compiler maps an undefined
  `TX`/`NR`/`ST`/`VL` reference onto the engine's own lexer tokens —
  right for ABNF, wrong for GBNF, where those are ordinary rule names.
  `requireDefinedRefs` has to run first so a typo is reported as a typo.
- **Character classes are re-emitted, never passed through.** GBNF and
  JavaScript agree on `[`, `]`, `^` and `-` and nothing else. Every
  member is written back as a `\uXXXX` (or `\u{…}`) escape, which has
  one meaning inside a class and needs no further quoting. Same reason
  string literals are lexed raw and decoded here rather than by the
  engine's string matcher.
- **`lex.empty` is computed, not fixed.** The engine short-circuits `''`
  before any rule runs, so `derivesEmpty` walks the IR and sets
  `lex: { empty: … }` accordingly. `root ::= "x"*` accepts the empty
  input; `root ::= "x"` does not.
- **`eagerClasses` is conditional and the conditions are checked.** When
  a grammar's classes are pairwise disjoint AND no class holds the first
  character of any literal, `markClassesEager` drops the token-column
  gate. Both conditions are necessary — match matchers run at lex order
  `1e6` and the fixed matcher at `2e6`, so an eager class would
  otherwise swallow a literal's opening character. Getting this wrong
  makes parses **fail**, never wrongly succeed; do not weaken the check
  to make a grammar parse.
- **Tokenizer-token terminals parse, then are rejected.** `<think>`,
  `<[1000]>`, `!</think>` are sampler-level. The syntax layer accepts
  them so the diagnostic can name the rule; `rejectTokenTerminals`
  throws `GbnfCompileError`. Do not add a "treat it as literal text"
  fallback that is on by default — that changes the accepted language.
- **Rule boundaries use a two-token `NM ::=` lookahead.** Exact, but
  line-insensitive, where llama.cpp ends a rule at a top-level newline.
  We accept a superset; see
  [`known-gaps.md` §4](ts/doc/known-gaps.md).

## Authority and alignment rules

1. **`ts/` is canonical.** The Go port follows it.
2. **`@tabnas/bnf` is not this repo's to change.** If a limitation is in
   the shared compiler's emission (as the overlapping-terminal gaps in
   §2 of known-gaps were), record it there and fix it upstream — do not
   work around it by rewriting the IR into a shape that no longer says
   what the grammar said.
3. **A gap gets written down, not smoothed over.**
   [`ts/doc/known-gaps.md`](ts/doc/known-gaps.md) is the record, and
   `ts/test/corpus.test.js` is its enforcement. Every entry names the
   mechanism and where a fix would have to live.
4. `VERSION` in `ts/src/gbnf.ts` MUST equal `ts/package.json`'s
   `version`; `ts/test/version.test.js` fails the build on drift.

## Build & test

From `ts/`:

```bash
npm install    # resolves the file: siblings (@tabnas/bnf, parser, debug, railroad)
npm run build  # tsc --build src
npm test       # node --enable-source-maps --test test/**/*.test.js
```

Tests are plain `.js` under `ts/test/` — they run against `dist/`, so
**build before testing**. There is no `pretest` corpus fetch: the corpus
is committed.

The repo-root [`Makefile`](Makefile) wraps the same targets
(`make build|test|clean|reset`). Its `build-go`/`test-go`/`clean-go`
targets run the real Go toolchain against `go/`; only `publish-go`
stays an echo, because Go releases are `go/v*` tags served by the
module proxy.

## Not implemented yet

- **Go parse-level parity.** The Go front-end IS implemented
  (`go/parser_gbnf.go` + `go/facade.go`, mirroring `ts/src/converter.ts`;
  its suite compiles the corpus). What it cannot do yet is *grade* the
  corpus: the Go engine has no negotiated lexing (`lex.relex` is
  "TypeScript only" per `parser/go`'s `doc/differences.md`) and the
  front-end has no `markClassesEager` port, so accept/reject conformance
  runs only in `ts/`. The engine gap is `@tabnas/parser`'s to close,
  not this repo's — the same fix-it-upstream principle alignment rule 2
  states for `@tabnas/bnf`.
- **A renderer** (engine → GBNF), the mirror of `@tabnas/debug`'s ABNF
  round-trip. It would give an ABNF ⇄ GBNF bridge for free, and belongs
  beside the ABNF renderer in `@tabnas/debug`.
