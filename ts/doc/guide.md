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

## Validate from the shell, CI, or an AI agent

The same check without writing a script: `gbnf-check` ships with the
package. Point it at a grammar and some samples; the exit code is the
answer (`0` all accepted, `1` something rejected, `2` the grammar does
not compile, `3` usage error).

```bash
npx gbnf-check chess.gbnf                    # does the grammar compile?
npx gbnf-check json.gbnf out.txt             # does the file match it?
npx gbnf-check json.gbnf --text '{"a": 1}'   # does this string match?
```

For a tool or agent loop, `--json` swaps the prose for one stable JSON
document — grammar status, per-sample verdicts with `line`/`column`,
and a `hint` when a rejection is only a trailing newline:

```bash
npx gbnf-check json.gbnf --text '{"a":1,}' --json
```

This is the loop that matters when a model *writes* the grammar:
generate `.gbnf`, run `gbnf-check` on it with known-good and known-bad
samples, and repair from the reported error before ever loading a
sampler. See [reference.md](reference.md#command-line-gbnf-check) for
the full report shape, and keep the two cautions above in mind — they
apply to the CLI exactly as much as to `tn.parse()`.

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

## Turn an ABNF grammar into a `.gbnf` for a sampler

Many formats are already specified in RFC-grade ABNF. `@tabnas/abnf`
parses ABNF into the same grammar IR this package renders, so the
bridge is one line — and the output is a constraint file any
GBNF-consuming sampler can load:

```js
const { parseAbnf } = require('@tabnas/abnf')
const { renderGbnf } = require('@tabnas/gbnf')

const gbnfText = renderGbnf(parseAbnf('greet = "hi"\n'))
gbnfText // => 'root ::= greet\ngreet ::= [hH] [iI]\n'
```

Three things to know. GBNF needs a `root`, so one is synthesized to
reference the first production (pick another with
`{ start: 'name' }`). ABNF's case-insensitive literals are expanded
into exactly-equivalent classes (`[hH] [iI]`), because GBNF literals
are case-sensitive. And anything GBNF cannot express faithfully — a
grammar leaning on the engine's lexer tokens, a prose element — raises
`GbnfRenderError` instead of being approximated. Check the result with
`gbnf-check` (and `llama-gbnf-validator`, for the line-break rules)
before shipping it.

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

Compilation checks the notation; parsing exercises the engine, and that
is where the remaining limits live. Overlapping terminals — classes
that overlap each other, a literal's first character inside a class,
keywords shadowed by identifier classes, alternatives sharing an
unbounded prefix — are handled: the engine renegotiates token cuts per
alternative and the compiler emits exit guards, keyword guards and
left-factored helpers
([known-gaps.md](known-gaps.md#2-overlapping-terminals-and-rule-directed-lexing--resolved)).
What remains:

1. **Ambiguity that needs backtracking.** If the grammar must backtrack
   over an optional to succeed (`[a-h]? [1-8]? [a-h] [1-8]` — chess's
   `Nf3`), no lexer tuning helps: the engine runs one rule stack and
   commits to an optional as soon as it matches.
2. **An identifier exactly equal to a keyword**, in a position where
   the keyword's statement is also viable (`return = 1;` where `return`
   is a variable). The guards decide keyword-vs-identifier with two
   tokens of lookahead, which covers `returnx` but not this.

Both shapes still constrain a sampler correctly; they just cannot be
validated offline here. If a parse fails and neither applies, that is a
bug — report it with the grammar and the input.
