# GBNF conformance corpus

The `.gbnf` files here are llama.cpp's own grammars, copied verbatim from
[`ggml-org/llama.cpp`](https://github.com/ggml-org/llama.cpp/tree/master/grammars)
at commit `dd1ea524333b1e697489067d7a4c39c60d32beee` (fetched 2026-08-10).
They are the reference for what real GBNF looks like, so they are
tracked as-is: no reformatting, no trimming, no "fixing" a grammar that
this compiler finds hard.

| File | What it constrains | Constructs it exercises |
|---|---|---|
| `arithmetic.gbnf` | infix arithmetic | grouping, `*`, `+`, a class starting with `-` (`[-+*/]`) |
| `c.gbnf` | a small C subset | nine-way alternation, nested groups, `[^\n]`, `[^*]` |
| `chess.gbnf` | PGN algebraic notation | `?` on groups and classes, `#` inside a class (`[+#]`) |
| `japanese.gbnf` | kana and CJK text | non-ASCII class ranges, dashed rule names |
| `json.gbnf` | strict JSON | empty first alternative, `{m,n}`, negated classes, `\xXX` escapes |
| `json_arr.gbnf` | a JSON array | the same, plus multi-character literals containing `\n` |
| `list.gbnf` | a bulleted list | `\uXXXX` escapes in a negated class |

`ts/test/corpus.test.js` asserts that every file compiles to a
`GrammarSpec`, and parses the samples that the engine's tokenising lexer
can handle. Where a grammar compiles but does not parse, the mechanism
is recorded in [`ts/doc/known-gaps.md`](../../ts/doc/known-gaps.md) —
the test is never narrowed to make a gap disappear.

Copyright for these grammar files stays with the llama.cpp project (MIT).
