// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// The recorded divergences, executable.
//
// `DIVERGENCE.md` at the repository root records every input for which
// this port answers differently from the canonical TypeScript. There is
// no `test/spec` fixture register to carry them (this package declares
// no error codes, and has no `test/spec` directory), so each entry is
// pinned here instead.
//
// Every case asserts BOTH directions where a runtime boundary allows it:
// the behaviour recorded, and the behaviour that would mean the entry
// has closed. An entry that closes must be deleted from `DIVERGENCE.md`,
// and the case below fails until it is, so the document cannot go stale
// without the suite saying so.

mod common;

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use tabnas_gbnf::{gbnf_convert, parse_gbnf};

use common::compile;

// ---- 1. an unpaired surrogate escape ----------------------------------

/// Refused by name. TypeScript carries a lone surrogate through as a
/// one-unit literal, and the Go port replaces it with U+FFFD; a Rust
/// `String` holds Unicode scalar values and can do neither.
#[test]
fn an_unpaired_surrogate_escape_is_refused_by_name() {
    for src in [
        r#"root ::= "\uD800""#,
        r#"root ::= "\uDFFF""#,
        r#"root ::= "a\uD800b""#,
        r"root ::= [\uD800]",
        r"root ::= [\uD800-\uDBFF]",
        r"root ::= [a\uDC00]",
    ] {
        let error = parse_gbnf(src).expect_err("an unpaired surrogate escape is refused");
        let message = error.to_string();
        assert!(
            message.contains("unpaired surrogate code point"),
            "{src}: {message}"
        );
        // Named, not replaced. A U+FFFD anywhere in the answer would be
        // the Go behaviour, and that is the failure this case exists for.
        assert!(!message.contains('\u{FFFD}'), "{src}: {message}");
    }
}

/// A `\uXXXX` escape as source TEXT, assembled from its parts.
///
/// Written this way on purpose: a tool that reads this file and helpfully
/// resolves escape sequences turns `"\uD83D\uDE00"` into one emoji and
/// silently guts the case, which is exactly the confusion these tests are
/// about. Nothing here spells an escape that anything could resolve.
fn escape(hex: &str) -> String {
    format!("{}u{hex}", '\\')
}

/// A GBNF source whose terminal holds the escapes `hex` names.
fn literal_of(parts: &[&str]) -> String {
    let body: String = parts.iter().copied().map(escape).collect();
    format!("root ::= \"{body}\"")
}

/// The other direction, and the half that is NOT a divergence: a PAIR of
/// escapes is one astral character here exactly as it is in TypeScript.
/// A port that refused the pair, or read it as two replacements the way
/// Go does, would fail here.
#[test]
fn a_surrogate_pair_is_the_character_it_names() {
    let src = literal_of(&["D83D", "DE00"]);
    let grammar = parse_gbnf(&src).expect("the pair names a character");
    let json = serde_json::to_value(&grammar).expect("serializes");
    let literal = json["productions"][0]["alts"][0][0]["literal"]
        .as_str()
        .expect("a literal");
    assert_eq!(literal, "\u{1F600}");
    assert_eq!(1, literal.chars().count(), "the pair must be ONE character");

    let parser = compile(&src);
    assert!(parser.parse("\u{1F600}").is_ok());
    assert!(parser.parse("\u{FFFD}\u{FFFD}").is_err());
}

/// A class member is read one at a time on the way in, in both runtimes,
/// so a pair inside `[…]` is two members there and must not be combined
/// here: combining would change the accepted language.
#[test]
fn a_surrogate_pair_inside_a_class_is_still_two_members() {
    let src = format!("root ::= [{}{}]", escape("D83D"), escape("DE00"));
    let error = parse_gbnf(&src).expect_err("two surrogate members, each unpaired");
    assert!(
        error.to_string().contains("unpaired surrogate code point"),
        "{error}"
    );
}

// ---- 2. spans are in this runtime's units ------------------------------

/// Offsets count BYTES and columns count Unicode scalar values, where
/// the canonical runtime counts UTF-16 code units for both. Measured on
/// the entry's own input, so the numbers in `DIVERGENCE.md` are these.
#[test]
fn a_span_after_an_astral_character_is_in_this_runtimes_units() {
    let src = "root ::= \"\u{1F600}\" tail\ntail ::= \"!\"";
    let grammar = parse_gbnf(src).expect("parses");
    let json = serde_json::to_value(&grammar).expect("serializes");
    let span = &json["productions"][0]["alts"][0][1]["sp"];

    // What DIVERGENCE.md 2 records. TypeScript answers 14, 18 and 15.
    assert_eq!(span["s"], 16, "offsets count bytes");
    assert_eq!(span["e"], 20, "offsets count bytes");
    assert_eq!(span["c"], 14, "columns count Unicode scalar values");
    assert_eq!(span["r"], 1);

    // And the property that survives the difference, which is the one a
    // consumer should use: the span slices the same TEXT in either
    // runtime.
    let start = span["s"].as_u64().expect("an offset") as usize;
    let end = span["e"].as_u64().expect("an offset") as usize;
    assert!(src.is_char_boundary(start) && src.is_char_boundary(end));
    assert_eq!(&src[start..end], "tail");
}

/// With no astral character in the source there is nothing to diverge
/// about, which is why every span in both committed corpora agrees.
#[test]
fn an_ascii_span_is_the_same_number_in_both_runtimes() {
    let src = "root ::= \"hi\" tail\ntail ::= \"!\"";
    let grammar = parse_gbnf(src).expect("parses");
    let json = serde_json::to_value(&grammar).expect("serializes");
    let span = &json["productions"][0]["alts"][0][1]["sp"];
    assert_eq!(span["s"], 14);
    assert_eq!(span["e"], 18);
    assert_eq!(span["c"], 15);
}

// ---- 3. a repetition parses in quadratic time --------------------------

/// The shape, measured on one machine in one run: the ratio between two
/// input lengths, never a wall-clock budget, so a slow or busy box
/// cannot make it flaky.
///
/// Four times the input costs about sixteen times the work here and
/// about four times in TypeScript and Go, while the shared compiler
/// spells the repetition as a chain of pushes. The case follows the
/// compiler it is built against, which it reads from the emitted rules:
///
/// - while no alternate replaces (`r`), the chain is what runs, and the
///   assertion is deliberately the WRONG way round for a healthy port:
///   it passes while the divergence is open;
/// - once `tabnas-bnf` emits the repetition as a replace loop, the
///   divergence has closed, and the case asserts the closed side: the
///   loop adds no rule depth, and four times the input costs about four
///   times the work.
///
/// The second arm exists so the fix in `tabnas-bnf` can be tested
/// against this suite before it lands, since each repository tests the
/// other at its default branch. Once `tabnas-bnf`'s main emits the loop,
/// `DIVERGENCE.md` 3 and this case are deleted and the ceilings in
/// `tests/untrusted_test.rs` are raised.
#[test]
fn a_repetition_is_super_linear_until_the_compiler_emits_a_loop() {
    let grammar = "root ::= [a-z]+";
    let spec = gbnf_convert(grammar, None).expect("the grammar compiles");
    let emits_a_loop = spec.rule.values().flatten().any(|rule| {
        rule.open
            .iter()
            .chain(rule.close.iter().flatten())
            .any(|alt| alt.contains("r"))
    });
    if emits_a_loop {
        a_loop_adds_no_depth_and_runs_in_linear_time(grammar);
    } else {
        a_chain_runs_in_super_linear_time(grammar);
    }
}

/// The open side. The two lengths are measured back to back and the
/// ratio taken within the round, so a scheduler slice that lands on one
/// measurement has landed on the other as well. The BEST ratio of several
/// rounds is the one judged, because contention can only spoil a round,
/// never flatter it beyond the noise the threshold already allows:
/// sixteen against four leaves a wide gap to put a threshold in.
fn a_chain_runs_in_super_linear_time(grammar: &str) {
    let parser = compile(grammar);
    let small_input = "a".repeat(250);
    let large_input = "a".repeat(1_000);
    let measure = |input: &str| {
        let started = Instant::now();
        assert!(parser.parse(input).is_ok());
        started.elapsed().as_secs_f64().max(1e-9)
    };

    // Warm the path so the first round does not pay for what the others
    // do not.
    measure(&small_input);
    measure(&large_input);

    let mut best = 0.0f64;
    let mut small = 0.0f64;
    let mut large = 0.0f64;
    for _ in 0..4 {
        let round_small = measure(&small_input);
        let round_large = measure(&large_input);
        let ratio = round_large / round_small;
        if best < ratio {
            best = ratio;
            small = round_small;
            large = round_large;
        }
    }

    assert!(
        8.0 < best,
        "four times the input cost {best:.1} times the work ({small:.4}s against \
         {large:.4}s). Linear would be about four. If this is now linear, the \
         repetition the shared compiler emits has been fixed: delete DIVERGENCE.md 3, \
         raise the ceilings in tests/untrusted_test.rs, and delete this case."
    );
}

/// The closed side, in the order that needs no clock first.
///
/// Depth: the fleet's rule is that a repetition's iterations add no rule
/// depth, so the deepest rule over ten thousand items is the deepest
/// over one. A loop that still pushed per item, or nested its value per
/// item, would fail here however fast it ran.
///
/// Time: each length is timed as a batch of parses run to at least 50 ms,
/// and each length keeps its fastest batch of five rounds. Contention
/// only ever slows a batch, so a length's fastest batch is the nearest
/// to its real cost, and one slowed batch of the short input cannot
/// shrink the ratio the way a single slowed round could.
fn a_loop_adds_no_depth_and_runs_in_linear_time(grammar: &str) {
    let mut probe = compile(grammar);
    let deepest = Arc::new(AtomicUsize::new(0));
    let seen = deepest.clone();
    probe.subscribe_rule_done(move |rule, _context, _done| {
        seen.fetch_max(rule.d, Ordering::Relaxed);
    });
    let depth = |input: &str| {
        deepest.store(0, Ordering::Relaxed);
        assert!(probe.parse(input).is_ok());
        deepest.load(Ordering::Relaxed)
    };
    let one = depth("a");
    let many = depth(&"a".repeat(10_000));
    assert_eq!(
        many, one,
        "the shared compiler emits this repetition as a replace loop, yet ten \
         thousand items reach rule depth {many} where one item reaches {one}: the \
         loop's iterations must add no depth"
    );

    let parser = compile(grammar);
    let small_input = "a".repeat(250);
    let large_input = "a".repeat(1_000);
    let per_parse = |input: &str| {
        let started = Instant::now();
        let mut runs = 0u32;
        loop {
            assert!(parser.parse(input).is_ok());
            runs += 1;
            if started.elapsed() >= Duration::from_millis(50) {
                break;
            }
        }
        started.elapsed().as_secs_f64() / f64::from(runs)
    };
    let mut small = f64::INFINITY;
    let mut large = f64::INFINITY;
    for _ in 0..5 {
        small = small.min(per_parse(&small_input));
        large = large.min(per_parse(&large_input));
    }
    let ratio = large / small;
    assert!(
        ratio < 8.0,
        "the shared compiler emits this repetition as a replace loop, yet four \
         times the input cost {ratio:.1} times the work ({small:.5}s against \
         {large:.5}s per parse). Linear would be about four: the loop is not what \
         makes it quadratic, so look in the engine."
    );
}

// ---- 4. deep nesting is refused ----------------------------------------

fn nested(depth: usize) -> String {
    format!("root ::= {}\"x\"{}", "(".repeat(depth), ")".repeat(depth))
}

/// The cap is AT the boundary, not past it: 127 nested groups compile and
/// 128 are refused, which is where the Rust shared compiler's own
/// element-depth limit falls. TypeScript and Go compile both.
#[test]
fn the_nesting_cap_falls_exactly_where_the_shared_compiler_does() {
    assert!(
        gbnf_convert(&nested(127), None).is_ok(),
        "127 nested groups must still compile"
    );
    let error = gbnf_convert(&nested(128), None).expect_err("128 nested groups are refused");
    assert!(
        error.to_string().contains("nests too deeply"),
        "the refusal must be this crate's named one, not the engine's: {error}"
    );
}

/// Far past the cap: a diagnostic, never an abort, and never a hang.
/// A Rust stack that runs out aborts the process, so a case that reached
/// one could not report it; reaching this assertion at all is the point.
#[test]
fn nesting_far_past_the_cap_is_a_diagnostic() {
    for depth in [200usize, 1_000, 5_000, 50_000] {
        let error = gbnf_convert(&nested(depth), None)
            .err()
            .unwrap_or_else(|| panic!("{depth} nested groups must be refused"));
        assert!(
            error.to_string().contains("nests too deeply"),
            "{depth}: {error}"
        );
    }
}

/// The SECOND cap of DIVERGENCE.md 4, on how deep the IR may nest. The
/// rows of its two tables, each at its own boundary: a run of postfix
/// operators costs no rule levels, so the group cap above cannot see it.
#[test]
fn the_nesting_cap_falls_where_the_recorded_table_says() {
    let stacked = |operators: usize| format!("root ::= \"x\"{}", "?".repeat(operators));
    let combined = |groups: usize, operators: usize| {
        format!(
            "root ::= {}\"x\"{}",
            "(".repeat(groups),
            format!("){}", "?".repeat(operators)).repeat(groups)
        )
    };

    // 127 operators compile. 128 and 129 nest past the SHARED compiler's
    // element-depth limit and meet its diagnostic, which names the rule.
    assert!(gbnf_convert(&stacked(127), None).is_ok(), "127 operators");
    for operators in [128usize, 129] {
        let error = gbnf_convert(&stacked(operators), None)
            .err()
            .unwrap_or_else(|| panic!("{operators} operators must be refused"));
        assert!(
            error
                .to_string()
                .contains("nests elements more than 128 deep"),
            "{operators}: {error}"
        );
    }
    // 130 is where this front-end's own cap falls, and it holds however
    // long the run is.
    for operators in [130usize, 5_000, 50_000] {
        let error = gbnf_convert(&stacked(operators), None)
            .err()
            .unwrap_or_else(|| panic!("{operators} operators must be refused"));
        assert!(
            error
                .to_string()
                .contains("nests elements more than 130 deep"),
            "{operators}: {error}"
        );
    }

    // Groups and operators count together: 43 groups closed by two `?`
    // nest exactly to the cap and the front-end lets them through, 44 do
    // not.
    assert!(
        parse_gbnf(&combined(43, 2)).is_ok(),
        "43 groups with two operators each nest exactly to the cap"
    );
    for (groups, operators) in [(44usize, 2usize), (127, 2), (65, 1)] {
        let error = parse_gbnf(&combined(groups, operators))
            .err()
            .unwrap_or_else(|| panic!("{groups} groups of {operators} must be refused"));
        assert!(
            error
                .to_string()
                .contains("nests elements more than 130 deep"),
            "{groups}/{operators}: {error}"
        );
    }
}

// ---- 5. an engine message quotes an astral character differently -------

/// The engine names the characters it could not place. TypeScript slices
/// its source by UTF-16 code units, so for one astral character it
/// quotes a LONE SURROGATE; this runtime quotes the whole character. The
/// message reaches a caller through the `gbnf-check` report, which is
/// where this asserts it.
#[test]
fn an_engine_message_quotes_a_whole_astral_character() {
    let argv: Vec<String> = ["--json", "-", "--text", "hi\u{1F600}"]
        .iter()
        .map(|argument| argument.to_string())
        .collect();
    let captured = tabnas_gbnf::cli::capture(&argv, "root ::= \"hi\"");
    assert_eq!(captured.code, 1, "{captured:?}");
    let report: serde_json::Value =
        serde_json::from_str(&captured.stdout).expect("the report is JSON");
    let message = report["samples"][0]["error"]["message"]
        .as_str()
        .expect("a message")
        .to_string();

    // What DIVERGENCE.md 5 records for this runtime.
    assert!(
        message.ends_with('\u{1F600}'),
        "the whole character is quoted: {message:?}"
    );
    // And the direction that would mean the entry has closed: a Rust
    // `String` cannot hold the lone surrogate TypeScript quotes, so the
    // closing move is the canonical cutting on a code-point boundary,
    // which would put the same character on both sides. There is no
    // half-character here to find, and the replacement U+FFFD a lossy
    // conversion would leave is the failure this guards.
    assert!(!message.contains('\u{FFFD}'), "{message:?}");
}

// ---- 6. an oversized repetition count ---------------------------------

/// A count past `usize::MAX` saturates here, where the canonical carries
/// a double and renders it in exponent form. Every count a grammar can
/// mean is the same number in both.
#[test]
fn an_oversized_repetition_count_saturates() {
    let render = |src: &str| {
        let grammar = parse_gbnf(src).expect("parses");
        tabnas_gbnf::render_gbnf(&grammar, None).expect("renders")
    };

    // The rows of the first table in DIVERGENCE.md 6.
    assert_eq!(render("root ::= \"x\"{3}"), "root ::= \"x\"{3}\n");
    for src in [
        "root ::= \"x\"{99999999999999999999}",
        "root ::= \"x\"{100000000000000000000000}",
    ] {
        assert_eq!(
            render(src),
            "root ::= \"x\"{18446744073709551615}\n",
            "{src}: TypeScript answers {{1e+23}} and {{100000000000000000000}} here"
        );
    }

    // The boundary the entry turns on, asserted in both directions: up
    // to `usize::MAX` the two runtimes agree exactly, so the day the
    // shared IR carries a double the row above changes and this one does
    // not.
    assert_eq!(
        render("root ::= \"x\"{9007199254740992}"),
        "root ::= \"x\"{9007199254740992}\n"
    );
}
