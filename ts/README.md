# @tabnas/gbnf

GBNF grammar compiler for the
[`tabnas`](https://github.com/tabnas/parser) parser.

Takes GBNF source (the
[llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)
dialect — `::=` and `|`, case-sensitive literals, a mandatory `root`)
and emits a tabnas `GrammarSpec`. Installed on an engine, the spec
parses inputs in that grammar and builds a `{rule, src, kids}` AST — so
you can answer "does this string match my grammar?" without loading a
model.

## Install

```bash
npm install @tabnas/parser @tabnas/bnf @tabnas/gbnf
```

## Use

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`root ::= "hi" | "hello"`)

tn.parse('hi') // => ({ rule: 'root', src: 'hi', kids: [] })
```

## Exact by construction

GBNF is scannerless: the grammar accounts for every character, including
the spaces. The engine's defaults are JSON-shaped and lenient, so the
emitted spec turns them off — empty ignore set, no space/line/comment/
string/number/text matchers. What is left is the grammar's own fixed
tokens (its literals) and match tokens (its classes).

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`root ::= "a" "b"`)

tn.parse('ab').src // => 'ab'

let rejected = false
try { tn.parse('a b') } catch (e) { rejected = true }
rejected // => true
```

Whether the *empty* input is in the language is settled at compile time,
because the engine short-circuits `''` before any rule runs: the
compiler walks the IR for a derivation of the empty string from `root`
and emits `lex: { empty: … }` to match.

```js
const { gbnfConvert } = require('@tabnas/gbnf')

gbnfConvert(`root ::= "x"`).options.lex  // => ({ empty: false, relex: true })
gbnfConvert(`root ::= "x"*`).options.lex // => ({ empty: true, relex: true })
```

## What this package owns

Only the notation. The compilation itself — desugaring repetition into
helper rules, left-recursion elimination, probe dispatch, literal
lifting, token allocation, first-set analysis, chain emission — lives in
[`@tabnas/bnf`](https://github.com/tabnas/bnf), shared with the ABNF and
EBNF front-ends:

```
GBNF text ──parseGbnf──▶ Grammar IR ──emitGrammarSpec──▶ GrammarSpec
```

`src/converter.ts` is the first arrow (a tabnas grammar that reads GBNF,
plus the terminal decoders and the lexer settings the spec carries);
`src/gbnf.ts` is the plugin facade.

## Documentation

Four-quadrant [Diátaxis](https://diataxis.fr) docs:

- [tutorial.md](doc/tutorial.md) — learning-oriented: zero to a working
  parser, step by step.
- [guide.md](doc/guide.md) — task-oriented recipes for real problems.
- [reference.md](doc/reference.md) — the exact API and GBNF syntax
  supported.
- [concepts.md](doc/concepts.md) — how the compiler works and why.
- [known-gaps.md](doc/known-gaps.md) — where this and llama.cpp diverge,
  and what causes each divergence.

## License

MIT. Copyright (c) Richard Rodger.
