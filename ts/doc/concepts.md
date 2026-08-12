# Concepts

This document explains how `@tabnas/gbnf` works and why it is built the
way it is. For the API see [reference.md](reference.md); for the places
where it and llama.cpp part company see [known-gaps.md](known-gaps.md).

## What GBNF is for

GBNF was not designed as a parsing notation. It is llama.cpp's grammar
format for **constrained decoding** — steering a language model while
it generates.

At every generation step the model proposes a probability distribution
over its whole vocabulary. With a grammar loaded, the sampler tracks
where in the grammar the output-so-far sits and masks out every token
that would step outside the grammar's language, before anything is
sampled. The model *cannot* emit text outside the grammar — a hard
guarantee where a prompt is a request, with one boundary worth
knowing: masking guarantees every emitted prefix is a *viable* prefix,
so generation that stops early (a max-token cutoff, a cancellation)
can still return an incomplete prefix the grammar rejects. The
guarantee is whole-string only when generation runs to grammar
completion — which is one more reason to validate final outputs
offline. That is what `.gbnf` files are
written for: forcing valid JSON (llama.cpp's JSON-Schema converter
emits exactly these grammars — the [`test/live/`](../../test/live/)
corpus), legal chess moves, arithmetic, any structured output. The
notation is consumed by llama.cpp, XGrammar (and through it vLLM and
SGLang), KoboldCpp, LocalAI and node-llama-cpp.

GBNF's defining quirks all follow from that origin:

- **It is scannerless.** The sampler constrains raw text one code
  point at a time, so the grammar has no lexical level — a space is a
  character the grammar demands, not whitespace to be skipped.
- **`root` is mandatory.** Generation always starts from one known
  symbol, and the whole emitted output must derive from it.
- **Ambiguity is legal.** The sampler explores alternatives
  nondeterministically as characters arrive, so nothing forces a GBNF
  grammar to be decidable on one committed parse path — and some
  grammars defeat this engine's strategy of a single rule stack,
  first-match-wins alternatives and bounded, grammar-declared
  lookahead
  ([known-gaps.md §3](known-gaps.md#3-gbnf-can-express-grammars-no-deterministic-parser-can-run)).
- **Tokenizer-token terminals exist** (`<think>`, `<[1000]>`) because
  the sampler operates on vocabulary entries, so a grammar can
  constrain at the token level — and therefore mean different
  languages on different models
  ([known-gaps.md §1](known-gaps.md#1-tokenizer-token-terminals-are-rejected-by-policy)).

The gap this package fills follows from the same origin. In the
sampler integrations the grammar only ever runs *inside generation*,
and the one offline checker the ecosystem ships — llama.cpp's
`llama-gbnf-validator`, a C++ example binary built from the llama.cpp
tree — answers accept/reject and nothing more. This compiler gives the
notation an actual parser, as a library, where JS tooling lives:
compile once, test many strings in-process in milliseconds, and get
structured, named errors instead of a pass/fail. And because the
engine builds a `{rule, src, kids}` tree, the same grammar that
constrained generation can then *parse* the generated output into
structure — one artifact for both directions, instead of a sampler
grammar plus a second, driftable extraction parser.

## What the compiler is, and what the engine is

`@tabnas/gbnf` is a **compiler**, not a parser. It reads GBNF source and
emits a tabnas `GrammarSpec` — a declarative description of rules,
tokens, lexer settings, and AST-building actions. The actual parsing is
done by the **tabnas engine** (`@tabnas/parser`), a push-down
recursive-descent parser:

```
GBNF source ──gbnfConvert──▶ GrammarSpec ──tn.grammar──▶ engine ──parse──▶ AST
```

The compiler decides *what* grammar the engine should run; the engine
decides *whether a given input matches* and *what tree to build*. That
separation is why a compiled grammar can be serialised, shipped, and
re-loaded on a bare engine in another process — the spec is data.

## Three packages, one pipeline

This package holds only the notation:

```
GBNF text ──parseGbnf──▶ Grammar IR ──emitGrammarSpec──▶ GrammarSpec
          └─ @tabnas/gbnf ─┘        └──── @tabnas/bnf ────┘
```

`@tabnas/bnf` is the shared half, and it parses no syntax at all. It
defines an intermediate representation — a `Grammar` of `Production`s
over `Element`s — and everything hard about compiling one: desugaring
repetition into helper rules, eliminating left recursion, rewriting tail
repeats into same-depth loops, the probe/rewind dispatcher for prefixes
that exceed the engine's bounded lookahead, lifting single-literal rules
into named lexer tokens, allocating token names, first-set analysis, and
chaining multi-reference alternatives through `$stepN` rules.

`@tabnas/abnf` and `@tabnas/ebnf` are the other two front-ends onto the
same IR. Writing this one meant writing a parser for GBNF that produces
`Production[]`, and nothing else — plus the lexer settings a scannerless
notation needs, which are this front-end's business because they are a
property of the notation rather than of the IR.

## Reading GBNF with tabnas

The meta-grammar — the grammar that reads GBNF source — is itself a
tabnas grammar, written as a table of `open`/`close` rule alternatives
in `src/converter.ts`. It is small:

```
gbnf  = prod*
prod  = NM '::=' alts
alts  = seq ('|' seq)*
seq   = elem*
elem  = atom POST?
atom  = NM | GS | CC | DOT | TOK | '(' alts ')'
```

Two decisions keep it that small.

**Free-form terminals are lexed whole, and eagerly.** A string literal,
a character class, a repetition brace, a tokenizer terminal and a rule
name are each one `match.token` regex flagged `eager$`, which opts the
matcher out of the lexer's token-column gate. GBNF's terminals are
distinguished by their first character — `"`, `[`, `{`, `<`, `!` and
word characters are each claimed by exactly one matcher — so
tokenisation does not need to know what the parser expects. The ABNF
front-end spends a dozen alternatives on two-token `s:` patterns whose
only job is to widen the token column at the position after a rule name;
none of that is needed here.

**A postfix run is one token.** `#POST` matches `*`, `+`, `?` and
`{m,n}` in a run, so `elem` is a two-alternative rule rather than a
loop. A close-state loop in tabnas needs a `p:`/`r:` on every iteration,
and there is no child rule to push for a `*`. Lexing the run instead
moves the (rare, but legal) chaining of `x*?` into a five-line decoder.

Rule boundaries are found with a two-token `NM ::=` lookahead. That is
exact — `::=` can only follow a name at the start of a production — but
it is line-insensitive, where llama.cpp treats a top-level newline as
the end of a rule. See [known-gaps.md](known-gaps.md#4-line-breaks-are-not-significant-here-and-are-in-llamacpp).

## Terminals are re-emitted, not passed through

A character class looks like a regex, and it is tempting to hand `[a-z]`
straight to `new RegExp`. The front-end does not: it decodes the class
into code points and writes every member back as a `\uXXXX` (or
`\u{…}`) escape.

The reason is that GBNF and JavaScript agree on `[`, `]`, `^` and `-`
and on nothing else. A verbatim copy would hand JS a pattern in which
`\d`, `\b`, `\w` or a stray `$` mean something GBNF never said, and
GBNF's own escape set (`\[`, `\]`, `\UXXXXXXXX`) is not JS's. Writing
each member back as a fixed-width escape has exactly one meaning inside
a character class and needs no further quoting.

String literals get the same treatment for the same reason: they are
lexed raw and decoded here, rather than by the engine's string matcher,
because GBNF's escapes are its own.

## Case sensitivity is the flag that matters

GBNF's string literals are case-**sensitive**. ABNF's, by RFC 5234
default, are case-**insensitive**. The IR carries the intent
(`caseSensitive: true`) and the shared emitter lowers it: a sensitive
literal becomes a plain `fixed.token`, an exact byte match; an
insensitive one becomes an `i`-flagged, `eager$` regex.

Getting that backwards is silent — the grammar still compiles, still
parses its own examples, and quietly accepts `TRUE` for `"true"`. It is
asserted in the IR and again through a parse, in
`ts/test/gbnf.test.js`.

## Scannerless notation, tokenising engine

This is the central tension in the design, and the source of most of
what is in [known-gaps.md](known-gaps.md).

GBNF has no lexical level. `[0-9]+` is *characters*, not a number token;
`" "` is a space the grammar asked for, not whitespace to be skipped.
The tabnas engine, by contrast, is built around a configurable lexer:
by default it recognises numbers, strings, barewords, comments and
whitespace, and the parser works on the token stream that produces.

The front-end closes most of that gap by configuration. The emitted spec
carries an empty ignore set and switches off every default matcher, so
what remains is the grammar's own fixed tokens (its literals) and match
tokens (its classes). An input character the grammar never mentioned
becomes a lex error rather than a silently-skipped one, and `tn.parse()`
is a faithful acceptance test.

What configuration cannot close is **overlap**. Two GBNF terminals may
freely match the same character — `[0-9]` and `[0-9a-fA-F]`, or
`["\\bfnrt]` and the literal `"\""`. A tokeniser must choose one, and it
chooses before the parser has said which it wanted. The engine's first
answer is rule-directed lexing: a class matcher only fires where the
active rule names it. That resolves overlap, at the cost of making a
class invisible where the rule does *not* name it — which is exactly
what happens at the end of a repetition.

## Negotiated lexing

The deeper problem is that a first cut **freezes** a character's
identity. Watch the final newline here:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`
root ::= ws "x" ws "\\n"
ws   ::= [ \\t\\n]*
`)

tn.parse(' x \n').src // => ' x \n'
tn.parse('x\n').src   // => 'x\n'
```

That `\n` is a member of `ws`'s class *and* the literal `"\n"` — both
are real tokens in the compiled spec, and both can claim the same
position. If the lexer's first cut labels it the class token, the
alternative that needs the literal sees the wrong token type and fails,
even though the character is exactly what it wanted. The same shape is
everywhere in real GBNF: `"` is an escapable body character and the
closing quote inside `json.gbnf`'s strings; keywords sit inside
identifier classes in `c.gbnf`.

Negotiated lexing is the engine's answer, and every spec this front-end
emits opts in (`lex: { relex: true }` — see `applyExactLexing`). When a
buffered token's type does not match what an alternative expects, the
engine **re-cuts that source span constrained to the tokens the
alternative names**, instead of failing the alternative outright. A
character's identity stops being frozen at first fetch and becomes
something alternatives negotiate.

The safety direction is the one an offline validator needs: every
alternative still requires exactly its own tokens, so a renegotiated
cut can turn a false failure into a match but can never make a wrong
parse succeed. Mis-tokenising can only make a parse **fail**, never
wrongly accept.

Relex is off by default in the engine because grammars written *for* a
tokenising lexer have disjoint token classes and never need it. It is
also why the front-end probes the engine (`requireRelexSupport`): an
engine too old to know the option would ignore it in silence, and the
grammars that need it would then fail mid-input with an ordinary
unexpected-character error, far from the real cause. Refusing to
compile is the honest failure.

The engine's relex works together with guards the shared compiler
emits — FOLLOW and FOLLOW₂ exit guards on contested repetitions,
keyword-shadow guards, left factoring — and with one front-end
mitigation: when a grammar's classes are pairwise disjoint *and* no
class holds the first character of a literal, overlap cannot arise at
all, so the rule-directed gate is dropped entirely and every character
has exactly one possible token (`eagerClasses`). Together these resolve
the whole llama.cpp corpus; what remains genuinely out of reach is
ambiguity that needs backtracking, which is a different problem — see
[known-gaps.md §2 and §3](known-gaps.md#2-overlapping-terminals-and-rule-directed-lexing--resolved).

## Why tokenizer-token terminals are refused

`<think>`, `<[1000]>` and `!</think>` are a newer GBNF extension that
matches entries of the sampler's **vocabulary**. Which text an entry
covers is decided by the model's tokenizer, so the same grammar denotes
different languages on different models.

A text parser has no tokenizer, and the two available approximations are
both wrong in a way that would go unnoticed: treating `<think>` as the
literal text `"<think>"` accepts strings the sampler would refuse, and
dropping it accepts strings with nothing there at all. Either silently
changes the accepted language.

So the syntax layer accepts them — a grammar containing one is not a
*syntax* error, and the diagnostic can say so and name the rule — and a
validation pass rejects them with `GbnfCompileError`. An offline
validator that quietly disagrees with the sampler it is validating for
is worse than one that says "I cannot check this".

## Where validation lives

Every semantic check — the `root` requirement, undefined references,
tokenizer terminals — runs in `parseGbnf`, before the IR reaches
`@tabnas/bnf`.

That ordering is not cosmetic. The shared compiler maps an undefined
`TX`, `NR`, `ST` or `VL` reference onto the engine's own built-in lexer
tokens, which is right for ABNF (where a grammar may lean on the lexer)
and wrong for GBNF (where those are ordinary rule names and an undefined
one is a typo). Checking first means the typo is reported as a typo.

## What this changes for AI developers

Constrained decoding made grammars part of AI systems. Offline
validation makes them part of software engineering:

- **A test loop for grammars.** Without it, learning what a `.gbnf`
  file really accepts means loading a multi-gigabyte model and
  sampling — slow, GPU-bound, and nondeterministic, so a quiet grammar
  bug can hide for weeks. Here a grammar compiles in milliseconds and
  is tested like code: golden outputs must parse, near-miss bad ones
  must not. That is precisely how this repo's own corpus suites work.
- **Grammars under CI.** A wrong grammar does not crash anything — it
  silently changes what a model may emit, or blocks what it should.
  The exit code is the API, and each supplied sample is asserted to be
  *accepted* — so gating takes one invocation per direction:
  `gbnf-check grammar.gbnf golden.txt` must exit `0` (still compiles,
  still accepts the goldens), and a rejection gate inverts the
  expectation — `! gbnf-check -q grammar.gbnf bad.txt` — which must
  see exit `1` (still rejects the known bad shapes).
- **A repair loop for agents that write grammars.** A model generating
  GBNF from a description or a JSON schema gets its first correctness
  signal *here*, not after a sampler loads: `gbnf-check --json`
  returns one structured verdict — compile errors carrying
  `line`/`column` or the offending rule when the failure has one (a
  terminal-decoder error carries neither), per-sample accept/reject
  with positions — fast and deterministic enough to sit inside a
  generate → check → repair loop.
- **Separating grammar bugs from model bugs.** When constrained output
  looks wrong there are two suspects. If the output you *expected*
  does not parse offline, the grammar never said what you thought —
  the live corpus's `optional props with empty name` case, where the
  emitted grammar's language is a bare integer, is a real instance.
  If it parses, investigate the sampling side.
- **One grammar, both directions.** A parse returns a
  `{rule, src, kids}` tree, so the grammar that constrained generation
  also extracts structure from the result — no separate regex or
  hand parser to drift out of sync with it.

The boundaries are stated rather than hidden: a rejection here can be
an engine limit for grammars that need backtracking, and this compiler
accepts a superset of llama.cpp's line-break rules — see
[known-gaps.md](known-gaps.md), and check a grammar with
`llama-gbnf-validator` before shipping it to a sampler.

## Rendering, and the ABNF bridge

The notation arrow runs both ways. `renderGbnf` writes a grammar IR
back out as GBNF text — and because `@tabnas/abnf` parses into the
same IR, the pair is an ABNF → GBNF bridge: any grammar a sibling
front-end can read becomes a `.gbnf` file a sampler can consume.

```
ABNF text ──parseAbnf──▶ Grammar IR ──renderGbnf──▶ GBNF text
```

The renderer holds the same standard as the parser, in reverse. For a
grammar that came from GBNF, `parseGbnf(renderGbnf(g))` reproduces the
IR exactly — a fixed point graded over both corpora — so rendering
chooses spellings, never meanings. Constructs GBNF cannot express (an
engine lexer token, an ABNF prose element, a non-class regex) are
refused with `GbnfRenderError` rather than approximated. The one exact
expansion is performed: ABNF's case-insensitive literals become
equivalent class sequences (`"hi"` → `[hH] [iI]`), which accept
precisely the same strings — GBNF's case-sensitivity means the
insensitive direction has to be spelled out, and spelling it out is
faithful where guessing would not be.

Emission lives here, not in `@tabnas/debug`, because it is the
notation's own inverse: this package owns "GBNF text → IR", so it owns
"IR → GBNF text". Debug's renderer works at a different level — it
reconstructs ABNF from a *compiled engine instance* — and its GBNF
counterpart, engine → GBNF, remains possible there for grammars that
never had an IR.

## What is not here yet

- **A Go renderer.** `renderGbnf` (IR → GBNF text) is TypeScript-only,
  `ts/` being canonical; the Go port follows. `markClassesEager` is
  likewise unported — inert where it does not apply, so the corpus
  grades without it.

Go **parse-level parity** used to sit on this list and no longer does,
by way of two upstream changes rather than one. Negotiated lexing
landed in `parser/go` v0.8.5, which was necessary but not sufficient:
the shared compiler's contested-alternative guards (FOLLOW/FOLLOW₂
exits, keyword-shadow guards, left factoring) followed in `bnf/go`
v0.1.4. With both, all eight corpus grammars agree with TypeScript in
both directions.

The validator CLI and the renderer that used to be on this list are
here now: `gbnf-check`
([reference.md](reference.md#command-line-gbnf-check)) and
`renderGbnf` (above).
