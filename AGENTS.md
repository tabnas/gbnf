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

**This repo owns exactly two things:** the notation — GBNF text ⇄ IR,
both directions (`parseGbnf` / `renderGbnf`) — and the lexer settings
the emitted spec carries, because scannerlessness is a property of the
notation rather than of the IR.

**The value proposition**: GBNF is consumed by llama.cpp, XGrammar (and
therefore vLLM and SGLang), KoboldCpp, LocalAI and node-llama-cpp, and
none of them can answer "does this string match my grammar?" without a
model. This can.

**Why that gap exists**: GBNF's original purpose is constrained
decoding — at each generation step the sampler masks every vocabulary
token that would step outside the grammar's language, so the model
cannot emit text outside the grammar. In the sampler integrations the
grammar only ever runs *inside generation*; the ecosystem's one
offline checker, llama.cpp's `llama-gbnf-validator`, is a C++ example
binary answering accept/reject only — no library form, no AST, no
structured errors. GBNF's quirks all follow from that origin — scannerless,
mandatory `root`, ambiguity legal, tokenizer-token terminals — and so
do this repo's design constraints. The full account is
[`ts/doc/concepts.md` §"What GBNF is for"](ts/doc/concepts.md#what-gbnf-is-for);
the developer consequences (grammar test loops, CI gating, the
generate → check → repair loop that `gbnf-check --json` gives agents
that write grammars) are
[§"What this changes for AI developers"](ts/doc/concepts.md#what-this-changes-for-ai-developers).
Keep both in mind when judging a change: anything that silently widens
or narrows an accepted language defeats the purpose stated there.

## Repository map

| Path | What it is |
|---|---|
| [`ts/src/converter.ts`](ts/src/converter.ts) | The front-end. `gbnfRules` (the tabnas meta-grammar that reads GBNF), the terminal decoders, the validation passes, and the emitted lexer settings. |
| [`ts/src/gbnf.ts`](ts/src/gbnf.ts) | Plugin facade — `tn.gbnf(src)` / `tn.gbnf.toSpec(src)`, plus the bare exports and `VERSION`. |
| [`ts/src/cli.ts`](ts/src/cli.ts) | `gbnf-check`, the validator CLI (`bin` in `package.json`). Compile a grammar, check samples, exit 0/1/2/3; `--json` for a stable machine-readable report. |
| [`ts/src/render.ts`](ts/src/render.ts) | `renderGbnf` — the inverse arrow, grammar IR → GBNF text. Fixed point with `parseGbnf`; refuses what GBNF cannot say; expands ABNF's case-insensitive literals exactly. With `@tabnas/abnf` (same IR), the ABNF → GBNF bridge. |
| [`ts/test/gbnf.test.js`](ts/test/gbnf.test.js) | The main suite: IR shape per construct, escapes, classes, repetition, errors, exact lexing, end-to-end parses, plugin surface. |
| [`ts/test/corpus.test.js`](ts/test/corpus.test.js) | The llama.cpp conformance corpus — compile-all, plus accept / reject / expected-failure samples. |
| [`ts/test/live.test.js`](ts/test/live.test.js) | The live corpus — llama.cpp's 70 expected JSON-schema-to-grammar outputs, compiled and parsed. |
| [`ts/test/cli.test.js`](ts/test/cli.test.js) | The CLI, spawned as a child process — exit codes, both report formats, stdin in both roles, the trailing-newline hint. |
| [`ts/test/render.test.js`](ts/test/render.test.js) | The renderer — parse→render→parse fixed point over BOTH corpora, the refused constructs, the case-insensitive expansion, the ABNF bridge end to end. |
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

## Three things that are easy to get wrong

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

**3. Negotiated lexing is load-bearing.** Every emitted spec sets
`lex: { relex: true }`. GBNF terminals overlap freely
(`ws ::= [ \t\n]*` next to the literal `"\n"` is the canonical case),
and a tokeniser freezes one identity per span at first cut; relex lets
an alternative re-cut the span under its own token list, which is what
lets the corpus grammars parse their own samples. It cannot
over-accept — a wrong cut still fails the parse — so removing it never
shows up as a wrong answer, only as corpus grammars failing mid-input
with unexpected-character errors far from the cause.
`requireRelexSupport` probes the engine and refuses to compile on one
that silently ignores the option; do not weaken the probe. The full
mechanism is
[`ts/doc/concepts.md` §"Negotiated lexing"](ts/doc/concepts.md#negotiated-lexing).

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

- **`markClassesEager` has no Go port.** The front-end's one local
  mitigation — dropping the rule-directed gate when a grammar's classes
  are provably unambiguous — is TypeScript-only. Smaller than it
  sounds, and inert where it does not apply: the whole corpus grades
  in both directions without it.
- **The Go renderer.** `renderGbnf` (IR → GBNF text) is TS-only,
  `ts/` being canonical; the Go port follows.

**Go parse-level parity is done**, and is worth knowing about because
it took two upstream changes, not one. Negotiated lexing landed in
`parser/go` v0.8.5 (`applyExactLexing` opts in), which was necessary
but not sufficient: the shared compiler's contested-alternative guards
— FOLLOW/FOLLOW₂ repetition exits, keyword-shadow guards, left
factoring — then landed in `bnf/go` v0.1.4 (tabnas/bnf#13). With both,
**all eight corpus grammars agree with TypeScript in both
directions**, and `corpusExpectedFailures` in `go/gbnf_test.go` is
empty and stays empty, so the next gap has somewhere honest to live.

The renderer that used to be on this list lives here now, by decision:
emission is the notation's own inverse (this package owns "GBNF text →
IR", so it owns "IR → GBNF text"), not `@tabnas/debug`'s
engine-instance reconstruction. See
[`ts/doc/concepts.md` §"Rendering, and the ABNF bridge"](ts/doc/concepts.md#rendering-and-the-abnf-bridge).
