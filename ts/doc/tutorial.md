# Tutorial: your first GBNF grammar

This is a learning-oriented walkthrough. By the end you will have taken
a [GBNF](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)
grammar from a string of text to a working parser that builds a tree
from your input. Every step builds on the last; follow them in order.

`@tabnas/gbnf` is a **compiler**: it reads GBNF source and emits a
tabnas `GrammarSpec`. You install that spec on a tabnas engine, and the
engine parses inputs in your grammar and hands you back an AST.

> Two dialect notes up front, because both are easy to trip over if you
> have written ABNF. GBNF defines a rule with `::=` and separates
> alternatives with `|`. And its string literals are **case-sensitive** —
> `"true"` does not match `TRUE`.

## Step 0: install

```bash
npm install @tabnas/parser @tabnas/bnf @tabnas/gbnf
```

`@tabnas/parser` is the engine, `@tabnas/bnf` is the shared BNF-family
compiler, and `@tabnas/gbnf` is this front-end. You need all three.

## Step 1: install a grammar and parse

The simplest path uses the **plugin form**. You hand the GBNF compiler
to a `Tabnas` instance as a plugin; that adds a `tn.gbnf(...)` method.
Call it with your grammar, then call `tn.parse(...)`.

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`root ::= "yes" | "no"`)

tn.parse('yes').rule // => 'root'
tn.parse('no').rule  // => 'root'
```

`root ::= "yes" | "no"` reads: *the rule `root` matches the literal
`yes` or the literal `no`.* `tn.parse('yes')` returns a tree node; its
`.rule` field is the name of the rule that matched.

The rule has to be called `root`. GBNF's start symbol is always `root`,
and the whole input must match it — a grammar without one does not
compile.

## Step 2: look at the whole tree

Every rule produces a `{rule, src, kids}` node:

- `rule` — the grammar rule's name.
- `src` — the source text this rule matched.
- `kids` — child nodes, one per *referenced* sub-rule.

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`root ::= "yes" | "no"`)

tn.parse('yes') // => ({ rule: 'root', src: 'yes', kids: [] })
```

`root` matched only a literal, so it has no children — `kids` is empty.

## Step 3: sequences, sub-rules, and character classes

Elements laid side by side form a sequence. A bare word is a *reference*
to another rule. A `[...]` class matches one character from a set:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`
root  ::= "x" name "=" value
name  ::= [a-z]+
value ::= [0-9]+
`)

tn.parse('xfoo=42') // => ({ rule: 'root', src: 'xfoo=42', kids: [{ rule: 'name', src: 'foo', kids: [] }, { rule: 'value', src: '42', kids: [] }] })
```

Two things to notice:

- `name` and `value` appear as `kids` — referenced rules become child
  nodes.
- `[a-z]+` is a **character class** followed by the postfix `+`, "one or
  more". GBNF has no built-in rule library: unlike ABNF's `ALPHA` and
  `DIGIT`, everything is spelled out in classes.

## Step 4: whitespace is yours to declare

GBNF is scannerless — the grammar accounts for every character. Nothing
is skipped for you, so a space in the input only parses if the grammar
asked for one:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`
root ::= "x" ws "=" ws value
ws   ::= " "*
value ::= [0-9]+
`)

tn.parse('x = 42').src // => 'x = 42'
tn.parse('x=42').src   // => 'x=42'
```

`ws ::= " "*` is the idiom llama.cpp's own grammars use: an explicit,
usually *bounded*, whitespace rule threaded through the places
whitespace is allowed.

## Step 5: repetition and grouping

Repetition is postfix, regex-style: `*` (zero or more), `+` (one or
more), `?` (optional), and the counted forms `{m}`, `{m,}`, `{m,n}`.
Parentheses group. A classic shape is a bracketed, comma-separated
list:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`
root ::= "[" item ("," item)* "]"
item ::= [a-z]+
`)

tn.parse('[a,b,c]') // => ({ rule: 'root', src: '[a,b,c]', kids: [{ rule: 'item', src: 'a', kids: [] }, { rule: 'item', src: 'b', kids: [] }, { rule: 'item', src: 'c', kids: [] }] })
```

`("," item)*` means "zero or more of (`,` then `item`)". Each `item`
becomes a child of `root`.

The counted form is worth a habit: when you are writing a grammar a
sampler will consume, bound your repetitions (`[ \t]{0,20}`) rather than
leaving them open. llama.cpp's own JSON-Schema converter does this,
because unbounded whitespace is a known sampling anti-pattern.

## Step 6: parse without the plugin

You do not have to install the compiler as a plugin. `gbnfConvert`
returns the spec directly, and you install it with `tn.grammar(spec)`:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnfConvert } = require('@tabnas/gbnf')

const spec = gbnfConvert(`root ::= "yes" | "no"`)
spec.options.rule.start // => '__start__'

const tn = new Tabnas()
tn.grammar(spec)
tn.parse('no').rule // => 'root'
```

The start rule is reported as `__start__`: the compiler wraps `root` in
a small synthetic rule that makes sure end-of-input is consumed. You
still get your own rule's node back from `parse`.

## Where to go next

- **[guide.md](guide.md)** — recipes for real tasks: validating
  candidate strings, porting a llama.cpp grammar, reading a compile
  error.
- **[reference.md](reference.md)** — the exact API and the GBNF syntax
  supported.
- **[concepts.md](concepts.md)** — how the compiler works and why.
- **[known-gaps.md](known-gaps.md)** — read this before concluding that
  a grammar "does not work".
