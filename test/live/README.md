# Live GBNF corpus — schema-generated grammars

`json-schema-corpus.json` holds the expected GBNF outputs of
llama.cpp's JSON-schema-to-grammar converter, extracted verbatim from
[`tests/test-json-schema-to-grammar.cpp`](https://github.com/ggml-org/llama.cpp/blob/master/tests/test-json-schema-to-grammar.cpp)
at commit `81bc6b83f827df746eb129235488d325c49cae52` (release b11200,
fetched 2026-09-26). Each of the 77 cases records the case name, the
source JSON schema, and the grammar the converter is specified to emit.

A case is taken from each `test({…})` call that expects `SUCCESS` and
writes both the schema and the grammar as raw strings (`R"""(…)"""`),
in file order. Each string is kept verbatim, except that the grammar
drops the newline that opens its raw string. At b11200 the rule leaves
out one such call, `empty schema (any value)`, whose schema is the plain
string `"{}"`, and the `sub-schema $ref` case that `main()` builds
directly. The 70 cases at `030ebb558a5820b444a8f836ed5cdd46c9b4bd7a`
follow the same rule, so a refresh can be checked by extracting the old
pin and comparing.

These are the most common GBNF in the wild: `llama-cpp-python`,
`node-llama-cpp` and llama.cpp's own server all generate this shape
whenever a caller asks for JSON-schema-constrained output. A parser
that reads them handles what tools actually feed a sampler — bounded
integers spelled as digit-range alternations, `space`-interleaved
object machinery, optional-property chains, string escapes, `{m,n}`
bounds, and `$ref`/`anyOf` lowering.

`ts/test/live.test.js` asserts that every case compiles, and that a
hand-written spread of samples (valid JSON per schema, plus near-miss
invalid ones) parses or fails accordingly.

Copyright for the extracted grammars stays with the llama.cpp project
(MIT).
