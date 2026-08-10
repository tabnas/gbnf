# How-to guide

Task-oriented recipes. Each one is self-contained; skip to the problem
you have. If you are new to GBNF here, start with
[tutorial.md](tutorial.md).

## Validate candidate strings against a grammar

This is the reason the package exists: answer *"would the sampler have
been allowed to emit this?"* without a model in the loop. Compile once,
then test as many strings as you like.

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`
root   ::= int frac?
int    ::= "-"? [0-9]+
frac   ::= "." [0-9]+
`)

const accepts = (s) => { try { tn.parse(s); return true } catch (e) { return false } }

accepts('-12.75') // => true
accepts('12.')    // => false
accepts('1,5')    // => false
```

Two cautions. A `false` here means *this compiler* could not parse the
string — check [known-gaps.md](known-gaps.md) before concluding the
grammar rejects it. And the empty string is decided at compile time
rather than by a parse, so `accepts('')` reports whether `root` derives
the empty string; when it does, `tn.parse('')` returns `undefined`
rather than a node.

## Port a grammar file from llama.cpp

Read the file and hand it over; there is nothing else to do. GBNF has
no include mechanism and no options, so a `.gbnf` file is
self-contained.

```js ignore
const Fs = require('node:fs')
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(Fs.readFileSync('grammars/json.gbnf', 'utf8'))
```

Use a **fresh instance per grammar** (`tn.make()`). Installing a grammar
also installs its lexer settings — the empty ignore set, the disabled
default matchers, the `lex.empty` decision — and those are instance-wide,
so a second grammar layered onto the same instance inherits the first
one's.

## Compile once, install many times

`gbnfConvert` (also exported as `toSpec`) returns the `GrammarSpec`
without touching an instance. The spec is plain data apart from its
RegExp matchers, so it can be built once at startup and installed on as
many engines as you need.

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnfConvert } = require('@tabnas/gbnf')

const spec = gbnfConvert(`root ::= "yes" | "no"`)

const a = new Tabnas().grammar(spec)
const b = new Tabnas().grammar(spec)

a.parse('yes').rule // => 'root'
b.parse('no').rule  // => 'root'
```

## Match case-insensitively

GBNF has no case-insensitive literal — that is an ABNF feature, and it
is the difference most likely to bite when porting a grammar in either
direction. Spell the alternatives out as character classes:

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnf } = require('@tabnas/gbnf')

const tn = new Tabnas({ plugins: [gbnf] })
tn.gbnf(`root ::= [yY] [eE] [sS]`)

tn.parse('yes').src // => 'yes'
tn.parse('YES').src // => 'YES'
tn.parse('Yes').src // => 'Yes'
```

## Handle whitespace

Nothing is skipped for you. Declare an explicit whitespace rule and
thread it through the places whitespace is allowed — the idiom
llama.cpp's own grammars use:

```gbnf
ws ::= | " " | "\n" [ \t]{0,20}
```

That reads: nothing, or one space, or a newline followed by up to twenty
spaces or tabs. The first alternative is empty, which is legal and
deliberate. Prefer the **bounded** `{0,20}` over an unbounded `*` in any
grammar you will hand to a sampler; unbounded whitespace is a documented
sampling anti-pattern, and it makes the grammar harder for a
deterministic parser too.

## Test one rule instead of the whole grammar

`start` picks a different entry point, which is useful when you are
debugging a sub-rule. `root` must still be defined — that is part of the
notation — but it does not have to be where the parse begins.

```js
const { Tabnas } = require('@tabnas/parser')
const { gbnfConvert } = require('@tabnas/gbnf')

const spec = gbnfConvert(`
root ::= item+
item ::= [a-z]+
`, { start: 'item' })

const tn = new Tabnas().grammar(spec)
tn.parse('abc').rule // => 'item'
```

## Read a compile error

Three things can go wrong, and the class tells you which.

**`GbnfParseError`** — the text is not GBNF. Carries `.line` and
`.column` where the underlying parse failed, and `.cause` with the
engine's own error.

**`GbnfCompileError`** — the text *is* GBNF, but does not describe a
grammar this compiler can build. Carries `.rule`, the rule responsible.
Three causes:

- no rule named `root`;
- a reference to a rule that is never defined;
- a tokenizer-token terminal (`<think>`, `<[1000]>`, `!</think>`).

```js
const { parseGbnf } = require('@tabnas/gbnf')

const classify = (src) => { try { parseGbnf(src); return 'ok' } catch (e) { return e.name } }

classify(`root ::= "a"`)      // => 'ok'
classify(`greeting ::= "hi"`) // => 'GbnfCompileError'
classify(`root ::= nope`)     // => 'GbnfCompileError'
classify(`root ::= <think>`)  // => 'GbnfCompileError'
classify(`root ::= "\\q"`)    // => 'GbnfParseError'
```

The tokenizer-token case is a policy, not an oversight: those terminals
match a sampler's vocabulary entries rather than characters, so there is
no faithful text semantics. See
[known-gaps.md](known-gaps.md#1-tokenizer-token-terminals-are-rejected-by-policy).

## Inspect the intermediate representation

`parseGbnf` stops after the notation layer and hands back the grammar
IR — the same `Grammar` that `@tabnas/bnf` compiles. Useful for writing
your own analysis, or for seeing exactly how a construct lowered.

```js
const { parseGbnf } = require('@tabnas/gbnf')

const g = parseGbnf(`root ::= [a-z]+`)
g.productions[0].name              // => 'root'
g.productions[0].alts[0][0].kind   // => 'plus'
```

## When a grammar compiles but will not parse

Compilation checks the notation; parsing exercises the engine's
tokenising lexer, and that is where the remaining limits live. The
failure almost always has one of two shapes, both covered in
[known-gaps.md](known-gaps.md#2-overlapping-terminals-and-rule-directed-lexing):

- a repetition (`X?`, `X*`, `X+`) followed by a **character class**, in a
  grammar whose classes overlap each other or a literal's first
  character;
- two terminals that can both match at the same position, where the
  class wins because match matchers run before the fixed matcher.

Things worth trying, in order:

1. **Make the classes disjoint.** `[a-z]` beside `[a-z0-9_]` is the
   usual culprit; rewriting the second as `([a-z] | [0-9_])` costs
   nothing and lets the compiler lex classes eagerly, which removes the
   first failure shape entirely.
2. **Give the repetition a literal terminator** the class does not
   contain. Literals are matched by the fixed matcher, which is not
   gated by the active rule.
3. **Check for ambiguity.** If the grammar needs to backtrack over an
   optional to succeed (`[a-h]? [1-8]? [a-h] [1-8]`), no amount of
   lexer tuning will help — the engine runs one rule stack.

If none of that applies, the honest answer may be that the grammar is
outside the deterministic subset. It will still constrain a sampler
correctly; it just cannot be validated offline here.
