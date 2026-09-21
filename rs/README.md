# tabnas-gbnf (Rust)

A [GBNF](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)
grammar compiler for the [`tabnas`](https://github.com/tabnas/parser)
parsing engine, crate `tabnas_gbnf`.

GBNF is the notation llama.cpp uses to constrain a sampler, and it is
read by XGrammar (and so by vLLM and SGLang), KoboldCpp, LocalAI and
node-llama-cpp. None of them can answer "does this string match the
grammar?" without a model. This crate can.

```text
GBNF text ──parse_gbnf──▶ Grammar ──emit_grammar_spec──▶ GrammarSpec
```

The first arrow is what this crate adds: the meta-grammar that reads
GBNF syntax, the terminal decoders, the validation passes, and the lexer
settings the emitted spec has to carry. Everything downstream of that IR
lives in [`tabnas-bnf`](https://github.com/tabnas/bnf) and is shared with
the ABNF and EBNF front-ends: repetition desugaring, left-recursion
elimination, tail repeats, probe dispatch, literal lifting, token
allocation and chain emission.

This crate adds two things the front-end alone does not have: a
RENDERER, `render_gbnf`, which is the inverse arrow, and a COMMAND,
`gbnf-check`, which validates a grammar and its samples offline.

This is the Rust port of the canonical TypeScript implementation in
[`../ts`](../ts); the TypeScript version is authoritative and this crate
tracks it. The Go port in [`../go`](../go) reads the same notation.

## Install

The engine and the shared compiler are unpublished, so both are PATH
dependencies on sibling checkouts. Clone
[`tabnas/parser`](https://github.com/tabnas/parser) and
[`tabnas/bnf`](https://github.com/tabnas/bnf) next to this repository,
then:

```toml
[dependencies]
tabnas = { path = "../parser/rs" }
tabnas-gbnf = { path = "../gbnf/rs" }
```

## Compile a grammar and check a string

`gbnf` compiles GBNF text and installs the result on an engine. The
engine then answers the only question GBNF exists to ask.

```rust
use tabnas::Tabnas;
use tabnas_gbnf::gbnf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut parser = Tabnas::new();
    gbnf(&mut parser, "root ::= \"hi\" | \"hello\"", None)?;

    assert!(parser.parse("hello").is_ok());
    assert!(parser.parse("HELLO").is_err());
    Ok(())
}
```

GBNF string literals are case SENSITIVE, which is the opposite of RFC
5234's default, and the second assertion above is the whole reason that
matters.

Installing a grammar also installs its lexer settings, and those are
instance wide. Use a FRESH engine per grammar.

## Read the tree

An accepted input comes back as a `{rule, src, kids}` tree, so a caller
gets the structure as well as the verdict.

```rust
use tabnas::Tabnas;
use tabnas_gbnf::gbnf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut parser = Tabnas::new();
    gbnf(&mut parser, "root ::= greet \"!\"\ngreet ::= \"hi\"", None)?;

    let tree = parser.parse("hi!")?.to_json();
    assert_eq!(tree["rule"], "root");
    assert_eq!(tree["src"], "hi!");
    Ok(())
}
```

## The notation

The dialect is llama.cpp's, at commit
`dd1ea524333b1e697489067d7a4c39c60d32beee`.

| Construct | Spelling |
|---|---|
| definition | `name ::= body` |
| start symbol | `root`, which every grammar must define |
| choice | `\|`, and an EMPTY alternative is legal |
| concatenation | juxtaposition |
| literal | `"text"`, case SENSITIVE |
| character class | `[a-z]`, `[^\n]`, `[-+*/]` |
| any character | `.` |
| escapes | `\t \r \n \\ \" \[ \]`, `\xXX`, `\uXXXX`, `\UXXXXXXXX` |
| repetition | postfix `*`, `+`, `?`, `{m}`, `{m,}`, `{m,n}` |
| grouping | `( a \| b )` |
| comment | `#` to the end of the line |
| rule name | `[A-Za-z0-9_-]+`, so a name may start with a digit |

A rule defined twice is REPLACED, not extended: llama.cpp keeps rules in
a map and GBNF has no equivalent of ABNF's `=/`.

Tokenizer-token terminals (`<think>`, `<[1000]>`, `!</think>`) parse and
are then refused by name. They match entries of a sampler's vocabulary
rather than characters, so the same grammar means different things on
different models and a text parser has no faithful reading of one.

## Render a grammar back out

`render_gbnf` is the inverse arrow. For a grammar that came from GBNF it
is a fixed point: parse, render, parse gives the same IR back.

```rust
use tabnas_gbnf::{parse_gbnf, render_gbnf};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let grammar = parse_gbnf("root ::= \"a\"* | [b-d]")?;
    let text = render_gbnf(&grammar, None)?;
    assert_eq!(text, "root ::= \"a\"* | [b-d]\n");

    let again = parse_gbnf(&text)?;
    assert_eq!(again.productions.len(), grammar.productions.len());
    Ok(())
}
```

Because the ABNF and EBNF front-ends parse into the SAME IR, the
renderer is also a bridge into constrained decoding: read a grammar in
one notation, write it out as GBNF, feed it to a sampler. Anything GBNF
cannot express raises `GbnfRenderError` rather than being approximated,
with one exception: a case-INSENSITIVE literal has an exact GBNF
encoding, so `"hi"` becomes `[hH] [iI]` rather than being refused.

## The command

`gbnf-check` compiles a grammar and checks samples against it, with no
model in the loop. The exit code is the answer for a shell script, and
`--json` is the answer for a tool.

```bash
gbnf-check chess.gbnf                    # does the grammar compile?
gbnf-check json.gbnf --text '{"a":1}'    # does this string match?
gbnf-check json.gbnf --stdin < out.json  # pipe a sample in
gbnf-check json.gbnf --text '{}' --json  # a machine-readable report
```

| Exit | Means |
|---|---|
| 0 | the grammar compiles and every sample was accepted |
| 1 | the grammar compiles but at least one sample was rejected |
| 2 | the grammar does not compile |
| 3 | usage or input failure |

The library is the crate and the binary is a launcher over `cli::run`,
which takes its streams as arguments. A caller that wants the command's
answer without a subprocess uses `cli::capture`.

```rust
use tabnas_gbnf::cli;

fn main() {
    let argv: Vec<String> = ["-", "--text", "hi", "--json"]
        .iter()
        .map(|argument| argument.to_string())
        .collect();
    let report = cli::capture(&argv, "root ::= \"hi\"");

    assert_eq!(report.code, 0);
    assert!(report.stdout.contains("\"ok\": true"));
}
```

Samples are matched in FULL, trailing newline included, because GBNF is
scannerless and every character counts. `echo hi > sample.txt` writes
`"hi\n"`, so a rejection is re-checked without one final newline and a
hint is reported when that would have been accepted;
`--strip-final-newline` makes the stripping explicit.

## Compile without installing

`to_spec` returns the `GrammarSpec` and installs nothing, for a caller
that wants to inspect or store it.

```rust
use tabnas_gbnf::to_spec;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let spec = to_spec("root ::= [0-9]+", None)?;
    assert!(spec.rule.contains_key("root"));
    Ok(())
}
```

## Errors

Three classes, each naming what it can:

| Class | Raised when |
|---|---|
| `GbnfParseError` | the source is not GBNF: a syntax error, an unknown escape, a descending range, an empty class |
| `GbnfCompileError` | the source is GBNF but not a grammar this compiler can build: no `root`, an undefined reference, a tokenizer-token terminal |
| `GbnfRenderError` | the IR describes something GBNF cannot say |

`GbnfError` wraps the first two plus the shared compiler's own refusal,
and carries the rule, the source span, the line and the column where
each is known.

```rust
use tabnas_gbnf::to_spec;

fn main() {
    let error = to_spec("root ::= nope", None).unwrap_err();

    assert_eq!(error.name(), "GbnfCompileError");
    assert_eq!(error.rule(), Some("root"));
    assert!(error.to_string().contains("never defined"));
}
```

## What is checked

Every grammar in llama.cpp's `grammars/` directory compiles, parses real
input, and rejects near-miss input. So do the seventy expected outputs of
llama.cpp's JSON-schema-to-grammar converter. Both corpora are committed
under [`../test`](../test) and graded in both directions.

Parity with the canonical TypeScript is measured rather than asserted:
`tests/oracle_test.rs` holds this crate to what `ts/dist` answered for
212 sources, source spans, rendered text and emitted match tokens
included. Where the two cannot agree, the input is in
[`../DIVERGENCE.md`](../DIVERGENCE.md) with a measured table, and a test
in `tests/divergence_test.rs` fails the day the entry stops being true.

Three limits are worth knowing before feeding this untrusted input. A
grammar nesting more than about 128 groups is refused by name rather
than allowed to run the stack out, and so is one whose elements nest
more than 130 deep, which a run of postfix operators reaches without
nesting a single group. A repetition parses in time quadratic in the
sample length. A repetition COUNT in the millions is not bounded here at
all, and the memory the shared compiler then asks for ends the process.
All three are written up in `../DIVERGENCE.md`, with what causes them
and who owns the repair.

## License

MIT.
