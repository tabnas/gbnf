# Known gaps

Where `@tabnas/gbnf` and llama.cpp's own GBNF parser disagree, and why.

Each entry says what the divergence is, what causes it, and where a fix
would have to live. Nothing here is a bug in the notation front-end
alone; most of it is the seam between a **scannerless** notation and a
**tokenising** engine.

The dialect implemented is llama.cpp's `grammars/README.md` at commit
`dd1ea524333b1e697489067d7a4c39c60d32beee` (2026-08-10).

---

## 1. Tokenizer-token terminals are rejected, by policy

`<think>`, `<[1000]>` and `!</think>` match entries of a sampler's
**vocabulary**, not characters. Which text they cover is decided by the
model's tokenizer, so the same grammar means different things on
different models, and a text parser has no tokenizer at all.

The syntax layer parses them — a grammar containing one is not a *syntax*
error — and a validation pass then rejects it with a `GbnfCompileError`
naming the rule:

```
gbnf: rule 'think' uses the tokenizer-token terminal '<think>'. These
match a sampler's vocabulary entries rather than characters, so they
have no meaning for a text parser and are not compiled.
```

The two available approximations are both wrong in a way that would go
unnoticed: treating `<think>` as the literal text `"<think>"` accepts
strings the sampler would refuse, and dropping it accepts strings with
nothing there at all. Silently changing the accepted language is the one
failure mode an offline validator must not have.

**Status:** deliberate, permanent. An opt-in literal-text approximation
could be added later; it would have to be off by default.

---

## 2. Overlapping terminals and rule-directed lexing

This is the big one, and it has two faces. Both come from the same fact:
the engine is a **tokeniser plus a push-down parser**, and GBNF is
**scannerless** — its grammar describes the input one character at a
time, with no lexical level at all.

The engine lexes under the direction of the active rule. A `match.token`
regex — which is how a character class is emitted — is only offered a
position when the rule's own alternatives name its token there (the
"token column", or *tcol*). That gate is what lets `[a-z]` and
`[a-z0-9_]` be two different tokens instead of a contradiction.

### 2a. A class is invisible where the rule does not name it

Repetition compiles to helper rules, and the helper that *ends* a
repetition never names what follows it:

```gbnf
root ::= sign? [0-9]+
sign ::= "-"
```

The `?` becomes a helper whose alternatives are `#sign` and the empty
one, so its token column is `{#sign}`. Lexing `1` there offers nothing
that matches, and the parse fails one character in — even though the
`[0-9]` token is right there in the same spec. Every `X? C`, `X* C` and
`X+ C` where `C` is a character class has this shape.

**Mitigation, and its limits.** When a grammar's classes are provably
unambiguous the front-end drops the gate: it flags every emitted class
matcher `eager$`, so the matcher fires whenever its regex matches and
the parser rejects tokens it did not expect. Tokenisation then does not
depend on parse state at all. Two conditions are checked over the whole
grammar:

1. the classes are **pairwise disjoint**, so at most one can claim any
   character; and
2. **no class contains the first character of any string literal** —
   match matchers run before the fixed matcher, so an eager class would
   otherwise swallow a literal's opening character.

`root ::= sign? [0-9]+` satisfies both and parses. `arithmetic.gbnf`
does not (`[a-z]` and `[a-z0-9_]` overlap; `[ \t\n]` holds the first
character of the literal `"\n"`), so it keeps rule-directed lexing and
`ws ::= [ \t\n]*` still cannot be followed by a term. Pass
`{ eagerClasses: false }` to turn the mitigation off.

Getting eager tokenisation wrong cannot over-accept: a mis-tokenised
character makes the parse **fail**, never succeed. That is why the
conditions are checked rather than assumed.

**Status:** the general fix is a follow-set guard on the empty
alternative of each generated repetition helper, which belongs in
`@tabnas/bnf`'s helper emission — not in this front-end. Until then,
grammars with overlapping classes cannot end a repetition on a class.

### 2b. A class can outrank the literal a rule wanted

Match matchers run at lex order `1e6`, the fixed matcher at `2e6`, so a
class token in the current token column beats a string literal at the
same position. In `json.gbnf`:

```gbnf
string ::= "\"" ( [^"\\\x7F\x00-\x1F] | "\\" (["\\bfnrt] | "u" [0-9a-fA-F]{4}) )* "\"" ws
```

the escape class `["\\bfnrt]` contains `"`. At the closing quote of
`"a"`, that class is in the token column (the loop's other branch could
still be starting), so the closing `"` is lexed as an escape character
and the string never terminates. `{}` and `{ }` parse; `{"a":1}` does
not.

**Status:** inherent to a tokenising lexer with overlapping token
definitions. The same hazard exists for two literals that overlap
(`"a"` beside `"ab"`), because the fixed matcher is global and
longest-match-wins.

### 2c. What this looks like in the corpus

`ts/test/corpus.test.js` grades all seven llama.cpp grammars. Every one
**compiles**. Six of the seven parse real input; the recorded gaps are:

| Grammar | Sample | Cause |
|---|---|---|
| `arithmetic.gbnf` | any input at all | 2a — `ws ::= [ \t\n]*` then a term |
| `json.gbnf` | `{"a":1}` | 2b — escape class matches the closing quote |
| `c.gbnf` | `int a(){//x\n}` | 2a — `statement*` then a comment |

The expected failures are asserted, not skipped. If one starts working,
the suite goes red and this document is what needs updating.

---

## 3. GBNF can express grammars no deterministic parser can run

llama.cpp's sampler explores alternatives nondeterministically at
generation time, so GBNF is free to be ambiguous. The tabnas engine runs
a single rule stack with first-match-wins alternatives and bounded,
grammar-declared lookahead. `chess.gbnf` shows the difference:

```gbnf
nonpawn ::= [NBKQR] [a-h]? [1-8]? "x"? [a-h] [1-8]
```

`Nf3` needs both optionals to be *skipped* so that `f` and `3` land on
the final `[a-h] [1-8]`. That is a backtracking decision; the engine
commits to the first optional as soon as `f` matches, and then fails.
Pawn moves and castling in the same grammar parse fine.

**Status:** inherent. The probe/rewind machinery in `@tabnas/bnf` widens
the deterministic subset for one specific shape (an optional prefix
disambiguated by a single following token), not for general
backtracking.

---

## 4. Line breaks are not significant here, and are in llama.cpp

llama.cpp's `parse_space(pos, newline_ok)` only skips newlines when it
is inside a group or just past a `|`. At the top level a newline **ends**
a rule, so both of these are errors upstream:

```gbnf
root ::= "a"
"b"

root ::= "a"
       | "b"
```

This front-end finds rule boundaries with a two-token `NM ::=`
lookahead, which is exact (`::=` can only follow a name at the start of
a production) but line-insensitive. Both grammars above compile here.

The divergence is one-directional: this compiler accepts a superset, so
a grammar that compiles here may still be rejected by llama.cpp. Check
with `llama-gbnf-validator` before shipping a grammar to a sampler.

**Status:** would need the meta-grammar to track group nesting and treat
`#LN` as significant. Not done because it buys strictness only.

---

## 5. Astral character classes have no cross-runtime encoding

`[\U0001F600-\U0001F64F]` emits `[\u{1f600}-\u{1f64f}]` with the `u`
flag, because `\uXXXX` cannot spell a code point above the BMP and
`\u{…}` is only a code-point escape in Unicode mode.

The serialized-regex form the engines share (`@/pattern/flags`) copies
flags verbatim into Go as an inline `(?flags)` group, and RE2 rejects
`(?u)`. So an astral class works in TypeScript and has no serialisable
form the Go runtime can load.

**Status:** open, and the one place GBNF support may need an engine-side
change rather than a front-end one. Either the front-end expands astral
ranges into surrogate-pair alternations, or the runtimes agree on a
flag-translation convention. BMP classes — everything the llama.cpp
corpus uses, including `japanese.gbnf`'s CJK blocks — are unaffected.

---

## 6. The empty input is decided at compile time

The engine special-cases `''` before any rule runs: it returns
`lex.emptyResult` when `lex.empty` is set, and throws when it is not.
No grammar rule ever sees the empty input.

Whether the empty string is in the language is a property of the
grammar, so the front-end settles it during compilation — it walks the
IR for a derivation of the empty string from `root` and emits
`lex: { empty: … }` to match. `root ::= "x"*` accepts `''`; `root ::=
"x"` rejects it.

The one visible consequence: an accepted empty input parses to
`undefined` rather than to a `{rule, src, kids}` node, because the
short-circuit returns before the start rule is pushed.

**Status:** correct for acceptance, slightly odd for the return value.
Worth knowing if you are using `tn.parse()` as a validator.

---

## 7. Smaller divergences

- **Duplicate rules: last wins.** GBNF has no ABNF-style `=/`, and
  llama.cpp keeps rules in a map, so a second `name ::= …` replaces the
  first. This front-end does the same, keeping the *last* definition in
  the *first* definition's position so rule order stays stable.
- **`""` contributes nothing.** An empty string literal denotes zero
  characters, so it is dropped rather than becoming a zero-width
  terminal. `root ::= ""` therefore accepts the empty input and nothing
  else, and `root ::= "" "a"` is the same grammar as `root ::= "a"`.
- **Undefined references are rejected here, at compile time.** llama.cpp
  reports "Undefined rule identifier" too. The check has to run before
  the shared compiler sees the grammar, because `@tabnas/bnf` maps an
  undefined `TX` / `NR` / `ST` / `VL` reference onto the engine's own
  lexer tokens — right for ABNF, wrong for GBNF, where those are
  ordinary rule names.
- **`[]` is an error.** llama.cpp builds an empty alternate from it;
  here it is rejected, because a class that matches nothing is
  invariably a typo.
- **Whitespace inside `{m,n}` is accepted.** llama.cpp runs
  `parse_space` after each repetition operator, so `x{ 1 , 3 }` and
  `x * ?` are legal there too.
