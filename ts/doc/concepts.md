# Concepts

This document explains how `@tabnas/gbnf` works and why it is built the
way it is. For the API see [reference.md](reference.md); for the places
where it and llama.cpp part company see [known-gaps.md](known-gaps.md).

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
chooses before the parser has said which it wanted. The engine's answer
is rule-directed lexing: a class matcher only fires where the active
rule names it. That resolves overlap, at the cost of making a class
invisible where the rule does *not* name it — which is exactly what
happens at the end of a repetition.

The front-end takes the one out that is provably safe: when a grammar's
classes are pairwise disjoint *and* no class holds the first character
of a literal, overlap cannot arise, so the gate is dropped and every
character has exactly one possible token. When those conditions do not
hold, rule-directed lexing stays, and some grammars compile but cannot
parse. Mis-tokenising can only make a parse **fail**, never wrongly
succeed, which is why this is a usability limit rather than a
correctness one.

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

## What is not here yet

- **A Go port.** The front-end compiles to a pure-data spec, so Go can
  already load a grammar compiled by this package; it cannot read
  `.gbnf` text until the notation parser is ported.
- **A renderer.** Engine → GBNF export, the mirror of
  `@tabnas/debug`'s ABNF round-trip, would turn any tabnas grammar into
  a constraint file for a sampler — and, combined with `@tabnas/abnf`,
  give an ABNF ⇄ GBNF bridge. It belongs beside the ABNF renderer in
  `@tabnas/debug`.
- **A validator CLI.** `gbnf-check <grammar> <sample…>` is a thin
  wrapper over `gbnfConvert` plus `tn.parse`, and is the shape most
  people asking for offline GBNF validation actually want.
