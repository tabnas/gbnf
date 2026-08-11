# Reference

Complete API surface and supported syntax for `@tabnas/gbnf`. For an
introduction see [tutorial.md](tutorial.md); for usage recipes see
[guide.md](guide.md); for the divergences from llama.cpp see
[known-gaps.md](known-gaps.md).

All exports come from the package root:

```js ignore
const {
  VERSION,
  gbnf, gbnfConvert, toSpec, parseGbnf,
  emitGrammarSpec, eliminateLeftRecursion,
  gbnfRules,
  GbnfParseError, GbnfCompileError,
} = require('@tabnas/gbnf')
```

The dialect implemented is llama.cpp's `grammars/README.md` at commit
`dd1ea524333b1e697489067d7a4c39c60d32beee` (2026-08-10).

---

## Conversion

### `gbnfConvert(src, opts?) => GrammarSpec`

Take GBNF source and return a tabnas `GrammarSpec` (a `ref` map of
action closures, an `options` block, and a `rule` table). This is the
primary entry point, and is also exported as `toSpec`.

- `src: string` — the GBNF source.
- `opts?: GbnfConvertOptions` — see below.

Throws `GbnfParseError` when the text is not GBNF, and
`GbnfCompileError` when it is GBNF but does not describe a buildable
grammar.

### `parseGbnf(src) => Grammar`

Parse GBNF source into the grammar IR (`{ productions: [...] }`)
*without* emitting a spec. Each production is `{ name, alts }`, where
`alts` is a list of sequences of IR elements. Useful for inspecting or
transforming a grammar.

Validation runs here, not in the emitter, so the returned `Grammar` is
always one the shared compiler can build: `root` exists, every reference
resolves, and no tokenizer-token terminals remain.

### `emitGrammarSpec(grammar, opts?) => GrammarSpec`

Re-exported from [`@tabnas/bnf`](https://github.com/tabnas/bnf).
Converts an already-parsed `Grammar` into a `GrammarSpec`.
`gbnfConvert(src)` is `emitGrammarSpec(parseGbnf(src), …)` plus the
lexer settings described under "Emitted lexer options" below.

### `eliminateLeftRecursion(grammar) => Grammar`

Re-exported from `@tabnas/bnf`. Rewrites direct and indirect left
recursion via Paull's algorithm, returning a new grammar. Called
internally by `emitGrammarSpec`; exported for inspection.

### `gbnfRules`

The declarative table of tabnas rules that defines the GBNF grammar
itself — the meta-grammar used to read GBNF source. Exported for
introspection and tooling.

### `GbnfConvertOptions`

| Field | Type | Default | Meaning |
|---|---|---|---|
| `start` | `string` | `'root'` | Entry rule. `root` must still be defined either way. |
| `tag` | `string` | `'gbnf'` | Group tag stamped on every emitted alt. |
| `eagerClasses` | `boolean` | `true` | Let character-class tokens fire regardless of what the active rule expects, when the grammar's classes are provably unambiguous. See below. |
| `builtins` | `boolean` | `false` | Emit probe dispatch and tree building as engine `$`-builtin refs, keeping the spec function-free and serializable. |
| `marks` | `boolean` | `false` | Emit a stable `m` mark per user-rule alt, enabling `@<rule>:o\|c:<mark>` action references. |
| `wordKeywords` | `boolean` | `false` | Treat word-like literals as whole-word keywords. Wrong for GBNF (a scannerless notation), and it disables `eagerClasses`; present because the option is the shared compiler's. |

---

## Plugin

### `gbnf` (Plugin)

Install with `new Tabnas({ plugins: [gbnf] })` or `tn.use(gbnf)`. Adds:

- **`tn.gbnf(src, opts?) => GrammarSpec`** — compile and install. The
  spec is applied with `tn.grammar(spec)`, which brings the lexer
  settings with it.
- **`tn.gbnf.toSpec(src, opts?) => GrammarSpec`** — compile only.

Use a fresh instance per grammar (`tn.make()`): installing a grammar
also installs instance-wide lexer settings, so a second grammar layered
onto the same instance inherits the first one's.

---

## Errors

### `GbnfParseError`

The source is not GBNF. Fields:

| Field | Meaning |
|---|---|
| `name` | `'GbnfParseError'` |
| `line` | 1-based line of the failure, when known |
| `column` | 1-based column, when known |
| `cause` | the underlying `TabnasError`, when there is one |

Also raised by the terminal decoders — an unknown escape, a short hex
escape, a code point above `U+10FFFF`, an empty character class, a
descending range, an inverted repetition bound.

### `GbnfCompileError`

The source is GBNF, but does not describe a buildable grammar. Fields:

| Field | Meaning |
|---|---|
| `name` | `'GbnfCompileError'` |
| `rule` | the rule responsible |

Raised for: no rule named `root`; a reference to a rule that is never
defined; a tokenizer-token terminal.

```js
const { parseGbnf } = require('@tabnas/gbnf')

const classify = (src) => { try { parseGbnf(src); return 'ok' } catch (e) { return e.name } }

classify(`root ::= "a"`)     // => 'ok'
classify(`root ::= <think>`) // => 'GbnfCompileError'
classify(`root ::= [z-a]`)   // => 'GbnfParseError'
```

---

## Supported syntax

### Rules

```gbnf
name ::= alternation
```

A rule name is `[A-Za-z0-9_-]+` — llama.cpp's `is_word_char` set, so a
name may start with a digit or a hyphen. `root` is the start symbol and
is mandatory. A second definition of a name **replaces** the first;
GBNF has no incremental-alternative operator.

### Alternation and sequence

`a | b` alternates; elements written side by side are a sequence; `(…)`
groups. An **empty alternative** is legal and meaningful:

```gbnf
ws ::= | " " | "\n" [ \t]{0,20}
```

### Terminals

| Form | Meaning |
|---|---|
| `"text"` | a **case-sensitive** string literal |
| `[a-z]` | one character in a range |
| `[abc]` | one character from an enumeration |
| `[^a-z]` | one character *not* in the set |
| `.` | any one character, newline included |

Ranges and members combine freely (`[a-zA-Z_0-9]`). A `-` immediately
before the closing bracket is a literal hyphen, not a range operator, so
`[-+*/]` is four members.

`""` denotes zero characters and contributes no element.

### Escapes

Valid inside both string literals and character classes:

| Escape | Meaning |
|---|---|
| `\n` `\r` `\t` | newline, carriage return, tab |
| `\\` `\"` `\[` `\]` | the character itself |
| `\xXX` | one byte, 2 hex digits |
| `\uXXXX` | a BMP code point, 4 hex digits |
| `\UXXXXXXXX` | any code point, 8 hex digits |

Any other escape is an error, matching llama.cpp. There is no `\-`: a
hyphen inside a class is positional, not escaped.

### Repetition (postfix)

| Form | Meaning | IR |
|---|---|---|
| `x*` | zero or more | `star` |
| `x+` | one or more | `plus` |
| `x?` | zero or one | `opt` |
| `x{m}` | exactly m | `rep` with `min = max = m` |
| `x{m,}` | m or more | `rep` with `max = Infinity` |
| `x{m,n}` | between m and n | `rep` with `min`/`max` |

Operators may be chained and are applied left to right, so `x*?` is
`(x*)?`. `{0,}`, `{1,}` and `{0,1}` collapse onto `star`, `plus` and
`opt`; `{1}` disappears.

### Comments

`#` to end of line. A `#` inside a string literal or a character class
is an ordinary character — both are lexed whole, before the comment
matcher sees them.

### Not supported

Tokenizer-token terminals (`<think>`, `<[1000]>`, `!</think>`) parse but
are rejected at compile time. See
[known-gaps.md](known-gaps.md#1-tokenizer-token-terminals-are-rejected-by-policy).

---

## Emitted lexer options

GBNF is scannerless, so the spec carries the settings that make the
engine behave that way. They are applied to the instance by
`tn.grammar(spec)`.

| Option | Value | Why |
|---|---|---|
| `tokenSet.IGNORE` | `[]` | Nothing is skipped between tokens. `root ::= "a"` must reject `" a "`. |
| `space.lex` `line.lex` | `false` | Whitespace is grammar, not noise. |
| `comment.lex` | `false` | A `#` in the INPUT is data, not a comment. |
| `string.lex` `number.lex` `text.lex` `value.lex` | `false` | JSON-shaped matchers would claim characters the grammar has already spoken for; without them, an unmatched character is a lex error. |
| `lex.empty` | computed | Whether the empty input is in the language, decided from the IR — see below. |
| `fixed.token` | from the grammar | One entry per distinct string literal. Case-sensitive literals lower to exact fixed tokens. |
| `match.token` | from the grammar | One anchored regex per distinct character class. |

### `lex.empty`

The engine special-cases `''` before any rule runs: it returns
`lex.emptyResult` (`undefined`) when `lex.empty` is set, and throws when
it is not. No rule ever sees the empty input, so the compiler decides at
build time — it walks the IR for a derivation of the empty string from
the start rule.

```js
const { gbnfConvert } = require('@tabnas/gbnf')

gbnfConvert(`root ::= "x"`).options.lex     // => ({ empty: false, relex: true })
gbnfConvert(`root ::= "x"*`).options.lex    // => ({ empty: true, relex: true })
gbnfConvert(`root ::= "x"{0,2}`).options.lex // => ({ empty: true, relex: true })
```

### `eagerClasses`

The engine lexes under the active rule's direction: a class token is
only offered a position when the rule's alternatives name it there. That
is what lets `[a-z]` and `[a-z0-9_]` coexist — and it is also why a
class immediately after a repetition can be invisible.

When two conditions hold over the whole grammar, the front-end drops the
gate by flagging every class matcher `eager$`:

1. the classes are pairwise disjoint, and
2. no class contains the first character of any string literal.

Under both, every character has exactly one possible token, so
tokenisation no longer depends on parse state. Set `eagerClasses: false`
to keep rule-directed lexing. The full account, including what happens
when the conditions do not hold, is in
[known-gaps.md](known-gaps.md#2-overlapping-terminals-and-rule-directed-lexing).

---

## `VERSION`

The package version as a string. Equal to `package.json`'s `version`;
a test fails the build if they drift.
