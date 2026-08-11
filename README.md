# @tabnas/gbnf

<!-- tabnas-badges -->
[![npm](https://tabnas.github.io/status/badges/gbnf-npm.svg)](https://www.npmjs.com/package/@tabnas/gbnf)
[![CI](https://github.com/tabnas/gbnf/actions/workflows/ci.yml/badge.svg)](https://github.com/tabnas/gbnf/actions/workflows/ci.yml)
[![tabnas standard](https://tabnas.github.io/status/badges/gbnf-standard.svg)](https://tabnas.github.io/status/)
<!-- /tabnas-badges -->

GBNF grammar compiler for the
[tabnas](https://github.com/tabnas/parser) parser. Takes GBNF source —
the [llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)
dialect, `::=` and `|`, mandatory `root` — and emits a tabnas
`GrammarSpec`. Installed on an engine, the spec parses inputs in that
grammar and builds a `{rule, src, kids}` AST.

**Why you would want this.** GBNF is the grammar notation for
**constrained decoding**: llama.cpp, XGrammar (and therefore vLLM and
SGLang), KoboldCpp, LocalAI and node-llama-cpp all take a `.gbnf` file
and mask the sampler so the model can only emit output the grammar
accepts. What none of them give you is a way to answer *"does this
string match my grammar?"* without loading a model. That question — the
most-asked one around GBNF — is what this package answers: compile the
grammar once, then parse candidate strings against it, offline, in
milliseconds.

```bash
npm install @tabnas/parser @tabnas/bnf @tabnas/gbnf
```

## A first grammar

A grammar is a set of **rules**, `name ::= definition`. Alternatives are
separated by `|`, terminals are double-quoted strings, and the rule
named `root` is the start symbol — the whole input must match it.

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`root ::= "hi" | "hello"`)

tn.parse('hi') // => ({ rule: 'root', src: 'hi', kids: [] })
```

Every rule that matches produces one AST node with three fields:

- **`rule`** — the rule's name, so you can navigate the tree by the names
  you wrote.
- **`src`** — the source text the rule matched.
- **`kids`** — child nodes, one per sub-rule the rule referenced.

## Sequences and sub-rules

Write elements one after another to match them in order, and reference
another rule by its bare name to nest it:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`
root  ::= greet " " name
greet ::= "hello"
name  ::= [a-z]+
`)

const out = tn.parse('hello world')
out.src                     // => 'hello world'
out.kids.map((k) => k.rule) // => ['name']
out.kids[0].src             // => 'world'
```

Two things to notice.

`out.src` is `'hello world'`, spaces and all. **GBNF is scannerless**:
the grammar describes every character, so the space between `greet` and
`name` is there because the grammar asked for it. Nothing is skipped —
`tn.gbnf()` installs an empty ignore set and switches off the engine's
default JSON-shaped matchers, so `tn.parse()` is a faithful acceptance
test rather than a lenient one. Drop the `" "` from the grammar and
`'hello world'` stops parsing.

`greet` does not appear among the children. A rule whose *whole* body is
a single string literal is a lexical definition rather than a rule, so
it compiles to a named lexer token (`greet ::= "hello"` becomes
`#greet`). Multi-alternative rules are real choices and stay rules.

## Terminals

**String literals are case-SENSITIVE** — the opposite of ABNF's default,
and the single most common way to get a GBNF port subtly wrong:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`root ::= "true" | "false"`)

tn.parse('true').src // => 'true'

let rejected = false
try { tn.parse('TRUE') } catch (e) { rejected = true }
rejected // => true
```

Inside a literal, the escapes are `\n`, `\r`, `\t`, `\\`, `\"`, `\[`,
`\]`, `\xXX`, `\uXXXX` and `\UXXXXXXXX`. Anything else is an error, not
a character copied through — an unknown escape silently changing the
accepted language is exactly the failure an offline validator exists to
prevent.

**Character classes** are regex-shaped: `[a-z]` for a range, `[NBKQR]`
for an enumeration, `[^\n]` for negation, and `.` for any character.
They accept the same escapes, so `[\x00-\x1F\x7F]` is the control
characters:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`
root  ::= piece file rank
piece ::= [NBKQR]
file  ::= [a-h]
rank  ::= [1-8]
`)

tn.parse('Ne4').kids.map((k) => k.src) // => ['e', '4']
```

## Repetition

Repetition is **postfix**, regex-style: `x*`, `x+`, `x?`, and the
counted forms `x{m}`, `x{m,}`, `x{m,n}`.

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`root ::= [0-9]+ ("," [0-9]+)*`)

tn.parse('1,2,3').src // => '1,2,3'
tn.parse('7').src     // => '7'
```

`{m,n}` is the form to reach for when writing grammars a sampler will
consume: llama.cpp's own guidance is to bound repetition (`[ \t]{0,20}`)
rather than stack optionals, because unbounded whitespace is a known
sampling anti-pattern.

## The `root` rule is mandatory

GBNF's start symbol is always `root`, and a grammar without one does not
compile — llama.cpp says "grammar does not contain a 'root' symbol", and
so does this:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })

let err = null
try { tn.gbnf(`greeting ::= "hi"`) } catch (e) { err = e }
err.name // => 'GbnfCompileError'
```

Two error classes, and the difference between them matters:
`GbnfParseError` means the text is not GBNF; `GbnfCompileError` means it
is GBNF but does not describe a grammar this compiler can build — no
`root`, a reference to a rule that is never defined, or a tokenizer-token
terminal.

## Tokenizer-token terminals are rejected

`<think>`, `<[1000]>` and `!</think>` match entries of a **sampler's
vocabulary**, not characters. A text parser has no tokenizer, so there
is no faithful semantics to implement. They parse — a grammar containing
one is not a *syntax* error — and are then rejected by name:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })

let rule = null
try { tn.gbnf(`root ::= <think> "x"`) } catch (e) { rule = e.rule }
rule // => 'root'
```

Approximating `<think>` as the literal text `"<think>"` would accept
strings the sampler refuses; dropping it would accept strings with
nothing there at all. Either silently changes the accepted language,
which is the one thing this tool must never do.

## Conformance

The corpus is llama.cpp's own `grammars/` directory, copied verbatim
into [`test/corpus/`](test/corpus/) — `json.gbnf`, `json_arr.gbnf`,
`arithmetic.gbnf`, `c.gbnf`, `chess.gbnf`, `english.gbnf`,
`japanese.gbnf`, `list.gbnf`. All eight **compile**, all eight accept
real input, and all eight reject near-miss invalid input:
`ts/test/corpus.test.js` grades both directions.

A second corpus in [`test/live/`](test/live/) holds the 70 expected
outputs of llama.cpp's JSON-schema-to-grammar converter — the shape
tools actually feed a sampler. All 70 compile and parse.

One sample remains out of reach: chess's `Nf3`, whose stacked optional
prefixes need backtracking. It is asserted as an expected failure, so
if it starts working the suite goes red. The mechanism, and everything
that used to be on this list, is written up in
[`ts/doc/known-gaps.md`](ts/doc/known-gaps.md) — read that before
trusting a "this grammar does not parse" result.

## How it fits together

`@tabnas/gbnf` parses no grammar of its own beyond GBNF's syntax. The
compilation itself — desugaring repetition into helper rules,
eliminating left recursion, probe dispatch, literal lifting, token
allocation, first-set analysis — lives in
[`@tabnas/bnf`](https://github.com/tabnas/bnf) and is shared with
[`@tabnas/abnf`](https://github.com/tabnas/abnf) and
[`@tabnas/ebnf`](https://github.com/tabnas/ebnf):

```
GBNF text ──parseGbnf──▶ Grammar IR ──emitGrammarSpec──▶ GrammarSpec
```

This package owns the first arrow, plus the lexer settings the second
arrow's output needs to behave scannerlessly.

| Path | Description |
|---|---|
| [`ts/`](ts/) | TypeScript / JavaScript (`@tabnas/gbnf`). |
| [`go/`](go/) | Reserved for the Go port. Not implemented yet: Go can load a spec this compiler produced, but cannot read `.gbnf` text. |

## Documentation

Four-quadrant [Diátaxis](https://diataxis.fr) docs:

| | TypeScript |
|---|---|
| **Tutorial** (learning) | [ts/doc/tutorial.md](ts/doc/tutorial.md) |
| **How-to guide** (tasks) | [ts/doc/guide.md](ts/doc/guide.md) |
| **Reference** (API + syntax) | [ts/doc/reference.md](ts/doc/reference.md) |
| **Concepts** (explanation) | [ts/doc/concepts.md](ts/doc/concepts.md) |
| **Known gaps** (limits) | [ts/doc/known-gaps.md](ts/doc/known-gaps.md) |

Per-language hub: [`ts/README.md`](ts/README.md).

## License

MIT. Copyright (c) Richard Rodger.
