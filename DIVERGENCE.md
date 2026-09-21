# Divergences

Where a port answers differently from the canonical TypeScript in
[`ts/`](ts/), for the same input. Every row below was MEASURED, on
2026-09-21, by running the three implementations over the input in its
first column. Nothing here is inferred from reading the source.

Each entry names who owns the repair. An entry that closes must be
deleted, and the test that pins it fails until it is, so this file
cannot go stale without the suite saying so.

The DIALECT is not a divergence. The IR the Rust front-end builds is
held to the TypeScript front-end's own output over a 212 source corpus
(every construct the notation has, every refusal, all eight llama.cpp
grammars and all seventy schema-generated ones) by
[`rs/tests/oracle_test.rs`](rs/tests/oracle_test.rs), source spans,
rendered text, emitted match tokens and rule names included. What is
below is what that comparison had to set aside, and why.

## Where the divergences are pinned

There is no executable register in `test/spec`: this repository declares
no error codes and has no `test/spec` directory, so no fixture row can
carry a `rust` column (`AGENTS.md`, "Error codes"). The shared data
under `test/` is the two committed corpora, which are graded directly.

So each entry below is pinned by a named Rust test in
[`rs/tests/divergence_test.rs`](rs/tests/divergence_test.rs), asserted
in BOTH directions where a runtime boundary allows it: the behaviour
recorded here, and the behaviour that would mean the entry has closed,
so a port that starts agreeing fails as loudly as one that starts
disagreeing.

Which test pins which entry, so an auditor does not have to guess, and
so a table that grows a row without growing a pin is visible:

| entry | pinned by |
|---|---|
| 1 | `an_unpaired_surrogate_escape_is_refused_by_name`, `a_surrogate_pair_is_the_character_it_names`, `a_surrogate_pair_inside_a_class_is_still_two_members`, and the `unrepresentable` arm of `rs/tests/oracle_test.rs` |
| 2 | `a_span_after_an_astral_character_is_in_this_runtimes_units`, `an_ascii_span_is_the_same_number_in_both_runtimes`, and `the_column_the_engine_reports_counts_characters` in `rs/tests/oracle_test.rs` |
| 3 | `a_repetition_still_parses_in_super_linear_time` |
| 4 | `the_nesting_cap_falls_exactly_where_the_shared_compiler_does`, `nesting_far_past_the_cap_is_a_diagnostic`, `the_nesting_cap_falls_where_the_recorded_table_says` |
| 5 | `an_engine_message_quotes_a_whole_astral_character` |
| 6 | `an_oversized_repetition_count_saturates` |

Each pin was bite-checked: the expectation was altered and the case
watched go red. A row whose expectation is the same as the canonical's
is not a pin.

## 1. An unpaired surrogate escape

`\uD800` names one half of a UTF-16 surrogate pair. A JavaScript string
can hold one on its own; a Rust `String` and a Go `string` cannot,
because both are sequences of Unicode scalar values by definition.

| input | TypeScript | Go | Rust |
|---|---|---|---|
| `root ::= "\uD800"` | `literal` is U+D800 | `literal` is U+FFFD | refused: `gbnf: escape for U+D800 in terminal "\uD800" is an unpaired surrogate code point, which this runtime cannot represent in a string.` |
| `root ::= "\uDFFF"` | `literal` is U+DFFF | `literal` is U+FFFD | refused, the same way |
| `root ::= [\uD800]` | `pattern` is `[\ud800]` | `pattern` is `[\x{d800}]` | refused, the same way |
| `root ::= [\uD800-\uDBFF]` | `pattern` is `[\ud800-\udbff]` | `pattern` is `[\x{d800}-\x{dbff}]` | refused, the same way |
| `root ::= "\uD83D\uDE00"` | `literal` is U+1F600 | `literal` is U+FFFD U+FFFD | `literal` is U+1F600 |

The last row is the one that is NOT a divergence, and it is in the table
because getting it wrong is the obvious way to write this port. A PAIR
of escapes names one astral character. The canonical front-end gets that
for nothing, because it appends UTF-16 code units to a UTF-16 string and
the pair simply is that character; this port combines the halves
explicitly, so `"\uD83D\uDE00"` is one emoji here exactly as
it is there. The Go port does not, and answers two replacement characters.

**Reason.** `String.fromCodePoint(0xD800)` answers a lone surrogate.
`char::from_u32(0xD800)` answers `None`, and the `regex` crate refuses a
surrogate in a character class for the same reason. There is no
representation to port to, so the escape is refused BY NAME rather than
replaced with U+FFFD in silence, which is what an offline validator must
not do: U+FFFD is a different character, and a grammar that accepted it
would accept different strings.

**Owner.** Nobody, unless the notation gains a way to mean this. A
surrogate code point names no character, so a GBNF terminal that matches
one matches nothing a well-formed document can contain. llama.cpp's own
`parse_char` has the same hole and no better answer.

## 2. Source spans are recorded in this runtime's units

A span records where an element came from, in the units the front-end's
own engine tokens use: no arithmetic happens at that boundary, precisely
so that no off-by-one can. Those units are UTF-16 code units in
TypeScript, and bytes in Go and Rust. The COLUMN is the same story one
level down: the engine reports it in UTF-16 code units in TypeScript and
in Unicode scalar values in Go and Rust.

Measured over `root ::= "😀" tail` followed by `tail ::= "!"`, the span
of the `tail` reference:

| field | TypeScript | Go | Rust |
|---|---|---|---|
| `s`, `e` | 14, 18 | 16, 20 | 16, 20 |
| `c` | 15 | 14 | 14 |

Both differences appear only from the first astral character on a line
onwards. Every span in the two committed corpora and in the oracle
agrees exactly.

**Reason.** The engine already records token positions this way, and the
front-end copies every field straight across. Converting would mean
re-deriving a position the engine already knows, in a front-end whose
whole job is not to do arithmetic here.

**Owner.** Nobody: this is the engine's unit, recorded for it. Slicing
the original source with a span gives the same TEXT in every runtime,
which is what a consumer wants and what
[`rs/tests/spans_test.rs`](rs/tests/spans_test.rs) and the oracle both
assert. A consumer that treats a span offset as a UTF-16 index, or a
column as a UTF-16 column, is the case this entry exists to warn.

## 3. A repetition parses in time quadratic in the input length

`root ::= [a-z]+` against a run of `a`, compiled once and parsed
repeatedly. TypeScript and Go are linear in the input length; this port
is quadratic, four times the work for twice the input.

| input | TypeScript | Go | Rust |
|---|---|---|---|
| 250 | 12 ms | 0.5 ms | 60 ms |
| 500 | 20 ms | 1.1 ms | 226 ms |
| 1000 | 41 ms | 2.5 ms | 914 ms |
| 2000 | 128 ms | 35 ms | 3.35 s |
| 4000 | 123 ms | 36 ms | 13.4 s |
| 8000 | 119 ms | 61 ms | 96 s |
| 16000 | 93 ms | 160 ms | 390 s |

Measured on the unoptimised profile, which is what the test suite runs;
an optimised build is faster by a constant and has the same shape. The
last two Rust rows were timed through `gbnf-check` rather than in a test
harness, on a machine doing other work, so read them for their ratio
rather than their absolute value. The ratio is the finding either way,
and it holds from one end of the table to the other: each doubling of
the input multiplies the work by four.

**This is not in this crate.** Three measurements place it below the
front-end:

- the bare engine parsing its OWN default grammar is linear and fast
  (4000 array elements in 0.4 ms), so it is not the engine's core;
- the ABNF front-end, which shares nothing with this one but
  `tabnas-bnf` and the engine, is quadratic on the same shape
  (`top = 1*%x61-7A`, 2000 characters, 3.3 s);
- switching off negotiated lexing (`lex.relex`), which is this
  front-end's own setting and which neither ABNF nor the engine uses,
  changes nothing (2000 characters, 3.43 s against 3.53 s).

What is left is the repetition the shared compiler emits: the helper
rules `tabnas-bnf` desugars `*`, `+` and `{m,n}` into, as the Rust
engine runs them.

**Owner.** [`tabnas-bnf`](https://github.com/tabnas/bnf), in its Rust
port, with [`tabnas`](https://github.com/tabnas/parser) if the cost
turns out to be in how the engine runs those rules rather than in their
shape. This repository cannot fix it: the emission is not its to change
(`AGENTS.md`, "Authority and alignment rules", rule 2).

**What it costs here.** `gbnf-check` on a sample of a few thousand
characters is slow rather than wrong; on a five-figure sample it is
minutes rather than milliseconds, which for a command in a build script
is a hang by any other name. The untrusted-input suite states the ceiling it tests to rather
than pretending the ceiling is not there, and
`rs/tests/divergence_test.rs` measures the ratio so that the day the
emission is fixed, this entry fails and gets deleted.

## 4. Deep nesting is refused, where TypeScript compiles it

Two caps apply, and they count different things. `MAX_GROUP_DEPTH`
counts RULE levels, which is the engine's own stack while the source is
read; `MAX_NEST_DEPTH` counts how deep the IR the parse builds NESTS,
which is what every walk over it recurses through afterwards. A source
can be far past one and nowhere near the other.

Nested groups, measured with `root ::= ( ( … "x" … ) )`:

| nested groups | TypeScript | Go | Rust |
|---|---|---|---|
| 127 | compiles | compiles | compiles |
| 128 | compiles | compiles | refused: `gbnf: grammar nests too deeply (more than 512 rule levels, about 128 nested groups)` |
| 1000 | compiles | compiles | refused, the same way |
| 5000 | `RangeError: Maximum call stack size exceeded` | compiles | refused, the same way |

Stacked postfix operators, measured with `root ::= "x"` and a run of
`?`. A run is ONE token however long it is, so it costs no rule levels
at all and the group cap never sees it:

| operators | TypeScript | Go | Rust |
|---|---|---|---|
| 127 | compiles | compiles | compiles |
| 128 | compiles | compiles | refused by the shared compiler: `gbnf: rule 'root' nests elements more than 128 deep, which is past what this compiler will walk. Split the rule into named rules.` |
| 129 | compiles | compiles | refused the same way |
| 130 | compiles | compiles | refused: `gbnf: grammar nests elements more than 130 deep, which is past what this front-end will build. Split the rule into named rules.` |
| 5000 | `RangeError: Maximum call stack size exceeded` | compiles | refused, the same way |

And the two together, measured with a group closed by two `?` at every
level:

| input | TypeScript | Go | Rust |
|---|---|---|---|
| 43 groups, two operators each | compiles | compiles | parses, at exactly the cap, then refused by the shared compiler for element depth |
| 44 groups, two operators each | compiles | compiles | refused by the front-end, as above |
| 127 groups, two operators each | compiles | compiles | refused by the front-end, as above |

**Reason.** A Rust stack that runs out ABORTS the process rather than
unwinding, so a refusal has to come BEFORE anything that deep is built.
Both caps are MEASURED on this machine, on the unoptimised profile, in a
2 MiB thread, which is Rust's default for a spawned thread:

- 512 RULE levels, a little over half the measured abort. The whole
  pipeline survives 248 nested groups there and aborts at 249; on a
  1 MiB thread it gives out between 90 and 100, and on the 8 MiB main
  thread 1000 nested groups still parse and 1200 abort. A parenthesis
  costs four rule levels, so the cut falls at 128 nested groups.
- 130 NESTING levels, how deep the IR the parse builds may go.
  `root ::= "x"` with 392 question marks nests 393 deep and parses;
  with 394 it nests 395 and aborts. 108 nested groups closed by two
  `?` each nest 325 deep and parse; 110 nest 331 and abort. A group
  level costs more stack than a postfix level, because a group is also
  rule levels the engine is holding at the same time, so the
  group-heavy shape is the worst case for a given nesting depth, and at
  the cap it sits about 2.4 times inside its own measured abort.

Until this was measured only the first cap existed, and it counted
groups alone. `root ::= "x"` followed by four hundred question marks
ABORTED the process, uncatchably, on input a caller had not vetted: the
rule stack it cost was four levels, so nothing looked at it.

128 is where the Rust `tabnas-bnf` refuses a grammar for element depth
on its own, and the nesting cap admits 130, two more, so a grammar at
129 or 130 still meets that compiler's diagnostic, which names the rule.
Every grammar either cap turns away was going to be refused anyway, only
with a worse failure. That second limit is the other half of this entry:
the TypeScript shared compiler has no such limit and compiles a thousand
levels.

**Owner.** The element-depth limit is
[`tabnas-bnf`](https://github.com/tabnas/bnf)'s. Both stack caps are
this crate's and stay: they convert an abort into a diagnostic at a
boundary the layer below already draws. If the shared compiler's limit
moves, the caps move with it, and the measurements above are re-run
rather than copied.

**Nobody writes this.** The deepest grammar in either committed corpus
nests nowhere near either cap, llama.cpp's own parser has a comparable
recursive shape, and llama.cpp does not stack postfix operators at all.

## 5. An engine message quotes an astral character differently

The engine names the characters it could not place. TypeScript slices
its source by UTF-16 code units, so the slice for one astral character
is half of it: a LONE SURROGATE, which is what the message and the
`gbnf-check` report then carry. This runtime slices by scalar values and
carries the whole character.

Measured with `root ::= "hi"` and the sample `hi😀`:

| | TypeScript | Go | Rust |
|---|---|---|---|
| `samples[0].error.message` | `[tabnas/unexpected]: unexpected character(s): \ud800`-shaped: ends in U+D83D alone | ends in U+1F600 | ends in U+1F600 |

**Reason.** The message comes from the engine, not from this crate, and
the difference is the one DIVERGENCE 2 records one level down: the same
position arithmetic in two different string models. A Rust `String`
cannot hold a lone surrogate at all, so there is nothing here to match
even in principle.

**Owner.** [`tabnas`](https://github.com/tabnas/parser). The half worth
repairing is the TypeScript half: a diagnostic that prints half a
character is wrong in any runtime, and cutting the quoted span on a code
POINT boundary would fix it there and close this entry. Nothing in this
crate can.

## 6. An oversized repetition count

`{m}` and `{m,n}` take an unbounded decimal. The canonical carries the
count as a double; this port carries it as a `usize`, because that is
what the shared compiler's IR declares, and Go carries it as an `int`.

What the count becomes, measured through parse and render:

| input | TypeScript | Go | Rust |
|---|---|---|---|
| `root ::= "x"{3}` | renders `{3}` | `min` is 3 | renders `{3}` |
| `root ::= "x"{99999999999999999999}` | renders `{100000000000000000000}` | `min` is 9223372036854775807 | renders `{18446744073709551615}` |
| `root ::= "x"{100000000000000000000000}` | renders `{1e+23}` | `min` is 9223372036854775807 | renders `{18446744073709551615}` |

Every count up to 2^53 is the same number in all three, which is every
count a grammar can mean. Past `usize::MAX` each runtime saturates or
reformats in its own way, and the TypeScript rendering is not even GBNF:
`{1e+23}` does not reparse, because the notation's count is `[0-9]+`.

What compiling one costs. The shared compiler unrolls `{m}` into m
copies, so the count is a work multiplier and a very short grammar can
ask for a great deal:

| input | TypeScript | Go | Rust |
|---|---|---|---|
| `root ::= "x"{100000}` | compiles, 141 ms | compiles, 65 ms | compiles, 476 ms |
| `root ::= "x"{200000}` | `RangeError: Maximum call stack size exceeded` | compiles, 108 ms | compiles, 892 ms |
| `root ::= "x"{1000000}` | the same `RangeError` | compiles, 699 ms | compiles, 4.4 s |
| `root ::= "x"{5000000}` | the same `RangeError` | compiles, 2.7 s | `memory allocation of … failed`, and the process ABORTS |

**Reason.** Neither the count nor the unrolling is this front-end's. The
IR field is `usize` in `tabnas-bnf` and a double in the canonical, and
the desugaring that turns a count into that many helper rules is the
shared compiler's in every runtime. TypeScript meets its own recursion
limit first and raises a catchable error; this port has no limit to meet
and asks the allocator instead, which aborts rather than returning.

**Owner.** [`tabnas-bnf`](https://github.com/tabnas/bnf), in both
halves: the IR's numeric type, and a bound on what a repetition count
may unroll to. This repository cannot fix either without changing which
grammars it accepts relative to the canonical, which is the one thing a
front-end must not do on its own (`AGENTS.md`, "Authority and alignment
rules", rule 2). A cap here would have to sit between the 100000 that
TypeScript compiles and the 5000000 that aborts, and where in that range
is the shared compiler's decision to make, not this crate's.

**What it costs here.** `gbnf-check` on a grammar whose repetition count
is six figures is slow, and on one in the millions the process dies
without a diagnostic. A grammar file is untrusted input, so that is
worth knowing before pointing the command at one.
