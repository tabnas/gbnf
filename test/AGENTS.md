# Agents Guide — the conformance corpus

`corpus/*.gbnf` holds llama.cpp's own grammars, copied verbatim from
[`ggml-org/llama.cpp`](https://github.com/ggml-org/llama.cpp/tree/master/grammars)
at commit `dd1ea524333b1e697489067d7a4c39c60d32beee` (fetched
2026-08-10). They are the reference for what real GBNF looks like.

Unlike the generated corpora in some sibling repos, these files are
**committed**. There is no fetch script and no `pretest` hook: the whole
point is that the bytes are upstream's, and a network failure must never
be able to turn the conformance suite into a silent no-op.

## The instrument's own rules

- **Never edit a grammar file.** Not to reformat, not to trim trailing
  whitespace, not to "fix" a rule this compiler finds hard. If a grammar
  exposes a limitation, that is the finding — record it in
  [`../ts/doc/known-gaps.md`](../ts/doc/known-gaps.md).
- **The census is pinned.** `ts/test/corpus.test.js` lists all seven
  grammars by name and asserts that the directory contains exactly
  those. A glob would let a deleted grammar pass unnoticed.
- **A gap is an assertion, not an omission.** Samples this compiler
  cannot parse live in `EXPECTED_FAILURES`, asserted with
  `notEqual(err, null)`. If one starts working the suite goes **red**,
  and the message says to update the gap document. Deleting the case
  instead is how a conformance figure stops meaning anything.
- **Do not weaken a case to make it green.** Not by narrowing the
  sample, not by loosening the comparison, not by adding a skip. Compile
  is compile; parse is parse.
- **Adding a grammar means adding its provenance.** New files go in with
  their upstream URL and commit recorded in
  [`corpus/README.md`](corpus/README.md), and their name added to the
  census.

## What is graded

Three claims, in `ts/test/corpus.test.js`:

1. **Compiles** — every file produces a `GrammarSpec` with a `root` rule
   and the `__start__` wrapper. This is the corpus's primary job: it is
   what proves the front-end reads real GBNF rather than a tidied
   dialect of it. All seven pass.
2. **Accepts** — the listed samples parse. Six of the seven grammars
   have samples here; they are small and real, the kind of text the
   grammar exists to constrain a model into producing.
3. **Known gaps** — the listed samples do NOT parse, each labelled with
   the mechanism that stops it.

## Adding a sample

Put it in `ACCEPT` if it parses today, `EXPECTED_FAILURES` if it does
not — and in the second case work out *why* first. The three causes seen
so far are all in `known-gaps.md`:

- a repetition followed by a character class the active rule does not
  name (`§2a`);
- two terminals that can both match at a position, where the class wins
  because match matchers run before the fixed matcher (`§2b`);
- a grammar that needs backtracking over an optional (`§3`).

If a new sample fails for a fourth reason, that is a new finding and
`known-gaps.md` needs a new section — not a fourth line in
`EXPECTED_FAILURES` with a hand-wave.
