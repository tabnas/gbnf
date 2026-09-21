# Agents Guide — rs/

The Rust port of the canonical TypeScript in [`../ts`](../ts). Read
[`../AGENTS.md`](../AGENTS.md) first: it holds the cross-runtime rules
(TypeScript wins, what the notation is and why, the conformance claim
over the two corpora, the three things that are easy to get wrong, the
repo-specific gotchas, the version sites, and how to treat untrusted
input). This file only covers what is specific to this crate.

## What is here, and what is not

This crate is the GBNF front-end, plus two things the ABNF and EBNF
front-ends do not have: a RENDERER and a COMMAND.

```text
GBNF text ──parse_gbnf──▶ tabnas_bnf::Grammar ──emit_grammar_spec──▶ GrammarSpec
                     ◀──render_gbnf──
```

Everything downstream of the IR (desugaring, left-recursion elimination,
tail repeats, probe dispatch, literal lifting, token allocation,
first-set analysis, chain emission) lives in
[`tabnas-bnf`](../../bnf/rs). A defect in the emitted grammar is almost
always a defect there, not here, and the fix belongs there, proven
against the ABNF suite, which exercises the shared compiler hardest.
`../AGENTS.md` rule 2 says the same and it applies to this crate
unchanged.

What belongs here: the meta-grammar, the terminal decoders, the four
validation passes, the exact-lexing settings, the eager-class decision,
the renderer, and the command.

## Layout

| Path | Mirrors |
|---|---|
| `src/lib.rs` | `ts/src/gbnf.ts` and `go/facade.go`: `VERSION`, `gbnf`, `gbnf_convert`, `to_spec`, `emit_grammar_spec`, `plugin`, `GbnfError`, and the IR re-exports under this package's own names |
| `src/parser_gbnf.rs` | the `gbnfRules` table plus `getGbnfParser` in `ts/src/converter.ts`, and `go/parser_gbnf.go`: the meta-grammar as a tabnas grammar document, its engine options, and the AST-assembly closures |
| `src/converter.rs` | the rest of `ts/src/converter.ts` and `go/validate_gbnf.go`: `parse_gbnf`, the validation passes, `apply_exact_lexing`, `mark_classes_eager` |
| `src/terminal.rs` | the `Terminals` and `Repetition` sections of `ts/src/converter.ts` |
| `src/render.rs` | `ts/src/render.ts`, which has no Go counterpart |
| `src/cli.rs` | `ts/src/cli.ts`, which has no Go counterpart |
| `src/bin/gbnf-check.rs` | the `require.main === module` block at the foot of `ts/src/cli.ts` |
| `tests/oracle_test.rs` | no twin: the canonical TypeScript, recorded |
| `tests/parity_test.rs` | the guard that says there are no shared `.tsv` fixtures to run, and fails when some land |
| `tests/gbnf_test.rs` | `ts/test/gbnf.test.js` and `go/gbnf_test.go` |
| `tests/corpus_test.rs` | `ts/test/corpus.test.js` |
| `tests/live_test.rs` | `ts/test/live.test.js` |
| `tests/render_test.rs` | `ts/test/render.test.js` |
| `tests/cli_test.rs` | `ts/test/cli.test.js` |
| `tests/spans_test.rs` | `go/spans_test.go` and the `describe('source spans')` block |
| `tests/divergence_test.rs` | no twin: the entries of `../DIVERGENCE.md`, executable |
| `tests/untrusted_test.rs` | no twin: the boundaries a Rust port has to state, because a stack that runs out aborts rather than unwinding |
| `tests/perf_test.rs` | no twin: ratio comparisons, measured on one machine in one run |
| `tests/version_test.rs` | the five version sites must agree |
| `README.md` | the crate front page; its `rust` fences run as doctests |

## The port follows the TypeScript, not the Go

`go/parser_gbnf.go` is a hand-written recursive-descent scanner. This
crate does NOT follow it. The meta-grammar here is a tabnas grammar
document parsed by the engine itself, which is what
`ts/src/converter.ts` does, so a defect in one is far more likely to
show up in the other.

That choice has two consequences worth knowing:

- The Go port's diagnostics for a syntax failure are its scanner's
  words. This crate's are the ENGINE's, wrapped as
  `gbnf: parse error at line L, column C: …` exactly as the canonical
  front-end wraps them, and `oracle_test.rs` compares the WHOLE
  sentence: the two engines turn out to word a refusal identically, so
  there is nothing there to excuse. Both colour it for a terminal, and
  both sides of the comparison strip the escapes, which is what the
  command's report does too.
- The Go port's messages for the validation passes are shorter than the
  canonical ones (compare `go/validate_gbnf.go` with
  `requireRoot` in `ts/src/converter.ts`). This crate carries the
  TypeScript wording, word for word, because TypeScript is canonical.

## The parity oracle

`tests/oracle/gbnf-oracle.json` records what `ts/dist` answered for 212
sources. Regenerate it from a BUILT `ts/`:

```bash
(cd ts && npm install && npm run build)
node rs/tests/oracle/gen-oracle.js > rs/tests/oracle/gbnf-oracle.json
```

Regenerate it when the canonical implementation changes, never to make a
red test green. A diff in that file is a change in the canonical
answers, and it needs the same scrutiny as a change to `ts/src`.

Three details of its format matter:

- A SPAN is recorded as the text it covers plus its row and column, not
  as a raw offset, because the offsets are runtime-native (see
  `../DIVERGENCE.md` 2) and because slicing the source is the only
  comparison worth making. The COLUMN is converted on the Rust side, and
  `the_column_the_engine_reports_counts_characters` pins the conversion
  rather than hiding behind it.
- `nodeKind: "user"` is dropped before comparing. It is the shared
  compiler's annotation slot and `user` is its default; TypeScript omits
  the field and this runtime spells the default out.
- An entry whose canonical answer holds an UNPAIRED SURROGATE carries
  `unrepresentable` and no answer, because JSON cannot hold one. Those
  four sources are `../DIVERGENCE.md` 1 and are pinned by
  `divergence_test.rs` instead.

## Things this crate gets wrong if you are not careful

**A surrogate PAIR is one character; a lone surrogate is refused.** The
canonical front-end appends UTF-16 code units to a UTF-16 string, so a
high-surrogate escape followed by a low one simply IS one emoji there.
`decode_string` combines the halves explicitly to match. `decode_char_class` does NOT, because a
class member is read one at a time in both runtimes and combining would
change the accepted language. Both halves are pinned in
`divergence_test.rs`.

**Whitespace and character classes are ASCII.** `SP` in
`src/parser_gbnf.rs` is `[ \t\r\n]`, exactly llama.cpp's `parse_space`,
not the `regex` crate's `\s`, which is Unicode-aware. `is_legal_name` in
`src/render.rs` spells out `[A-Za-z0-9_-]` rather than calling
`char::is_alphanumeric`, which is Unicode-aware too. A grammar that
compiled here and not in llama.cpp would be a conformance failure in the
direction that matters least to notice and most to fix.

**A terminal decoder's diagnostic travels through a thread local.** The
canonical front-end throws out of the rule action, so the exception
carries the decoder's own wording with no engine position bolted on, and
`ts/test/cli.test.js` pins that such a failure has NO location. An alt
action here could return an error, but the engine would wrap it with a
position. `DECODE_ERR` in `src/parser_gbnf.rs` is the channel out, and
`perf_test.rs` pins both that a failure does not leak into the next
parse on the same thread and that the shared meta-parser answers
correctly from several threads at once.

**Byte offsets are not character offsets.** Every computed offset into a
`&str` in this crate lands on a character boundary by construction (the
class and string scanners only ever step by a decoded character, or past
an ASCII `-` or `"`), and every test that slices a source with a span
checks `is_char_boundary` first. Keep both properties: a slice at a
computed offset is a panic on a multibyte tail.

## The two nesting caps

`src/parser_gbnf.rs` carries two, and they count DIFFERENT things. Both
numbers are MEASURED, not inherited.

`MAX_GROUP_DEPTH` (512 rule levels, about 128 nested groups) bounds the
ENGINE's own stack while the source is read. On this machine, on the
unoptimised profile, the whole pipeline survives 248 nested groups on a
2 MiB thread (Rust's default for a spawned thread) and aborts at 249,
gives out between 90 and 100 on a 1 MiB thread, and survives 1000 on the
8 MiB main thread, aborting at 1200. The cap is a little over half the
2 MiB figure, and it coincides with where the Rust `tabnas-bnf` refuses
a grammar for element depth anyway.

`MAX_NEST_DEPTH` (130) bounds how deep the IR the parse BUILDS nests,
which is what every walk over it recurses through afterwards: the
deserialization into the typed IR, the shared compiler's passes, the
renderer, and the value's own drop. The group cap cannot stand in for
it, because a RUN of postfix operators is one token however long it is:
`root ::= "x"` with four hundred `?` costs four rule levels and builds
an element four hundred deep, and it ABORTED the process until this cap
existed. Measured on a 2 MiB thread: 393 levels of postfix nesting parse
and 395 abort; 325 levels built from groups carrying two operators each
parse and 331 abort. A group level costs more stack than a postfix one,
so the group-heavy shape is the worst case, and at the cap it sits about
2.4 times inside its own abort.

The two are charged in different places, and both places matter.
`MAX_GROUP_DEPTH` is charged where a group OPENS, so a run of thousands
of `(` never builds a rule stack. `MAX_NEST_DEPTH` is charged inside
`apply_postfix` as each wrapper is built and at each group's close, so a
run of thousands of `?` never builds the tower either. Charging either
one after the fact would mean building the thing first.

If the shared compiler's element-depth limit moves, re-measure rather
than copying a number from a sibling crate. The measurement is a loop
over depths, running the pipeline on a thread with an explicit
`stack_size`, in a child process per depth: a stack that runs out aborts,
and an aborted process is the only way the result reports itself.

## Build and test

From `rs/`:

```bash
cargo build --all-targets
cargo test --all-targets     # does NOT include doctests
cargo test --doc             # README.md is doctested
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --check
```

`make test-rs` from the repository root runs the first four.
`ci/rust/run.sh` is the full gate, including the lockfile check, and is
what `ci/workflows/rust.yml` runs.

The suite is slower than its siblings and the reason is
`../DIVERGENCE.md` 3: a repetition parses in quadratic time here, so the
corpus and live suites, which parse real samples against real grammars,
cost seconds rather than milliseconds. Do not "fix" that by shrinking a
corpus case.

## Untrusted input

`../AGENTS.md` has the policy; this crate has the boundaries.
`tests/untrusted_test.rs` states each one and pins it AT the limit as
well as past it. Two are load-bearing and both are written up in
`../DIVERGENCE.md`:

- nesting is refused before it can overflow the stack, in BOTH the
  measures above, because a Rust stack that runs out aborts the process
  rather than unwinding, and `Value::to_json` and the default drop of a
  `Value` both recurse;
- a repetition COUNT is not bounded here and the shared compiler unrolls
  it, so `root ::= "x"{5000000}` aborts on an allocation. That one is
  `../DIVERGENCE.md` 6, and it is the shared compiler's to fix: a cap
  here would change which grammars this crate accepts;
- input length is bounded by the quadratic parse, so the cases there
  test to a four-figure sample and say why, rather than pretending a
  five-figure one would return.
