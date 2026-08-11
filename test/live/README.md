# Live GBNF corpus — schema-generated grammars

`json-schema-corpus.json` holds the expected GBNF outputs of
llama.cpp's JSON-schema-to-grammar converter, extracted verbatim from
[`tests/test-json-schema-to-grammar.cpp`](https://github.com/ggml-org/llama.cpp/blob/master/tests/test-json-schema-to-grammar.cpp)
at commit `030ebb558a5820b444a8f836ed5cdd46c9b4bd7a` (fetched
2026-08-11). Each of the 70 cases records the case name, the source
JSON schema, and the grammar the converter is specified to emit.

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
