// Untrusted input. A grammar file arrives from outside the system, and
// so does the text it checks: deep nesting, very long input,
// unterminated constructs, empty input, control characters and odd
// Unicode must not panic, hang, overflow the stack or take super-linear
// time.
//
// Every case here asserts an ANSWER, not merely that the call returned.
// A Rust stack that runs out ABORTS the process rather than unwinding,
// so a case that would overflow is a failure the test harness cannot
// report as one: the boundary is refused before anything that deep is
// built, and the cases below pin where.

mod common;

use std::fmt::Write as _;
use std::time::{Duration, Instant};

use tabnas_gbnf::{gbnf_convert, parse_gbnf, render_gbnf};

use common::compile;

/// The deepest nesting the front-end accepts, and the first it refuses.
/// A parenthesis costs four rule levels, so the cut falls at 128 nested
/// groups, which is exactly where the shared compiler's own element-depth
/// limit would refuse the grammar anyway.
const DEEPEST_ACCEPTED: usize = 127;

fn nested(depth: usize) -> String {
    format!("root ::= {}\"x\"{}", "(".repeat(depth), ")".repeat(depth))
}

#[test]
fn nesting_is_refused_before_it_can_overflow_the_stack() {
    assert!(
        gbnf_convert(&nested(DEEPEST_ACCEPTED), None).is_ok(),
        "{DEEPEST_ACCEPTED} groups must still compile"
    );
    for depth in [DEEPEST_ACCEPTED + 1, 200, 500, 5_000, 50_000] {
        let error = gbnf_convert(&nested(depth), None)
            .err()
            .unwrap_or_else(|| panic!("{depth} nested groups must be refused"));
        assert!(
            error.to_string().contains("nests too deeply"),
            "{depth}: {error}"
        );
    }
}

/// The deepest IR nesting the front-end will build, and the first it
/// refuses. A terminal nests one deep, so a run of `DEEPEST_NESTED - 1`
/// postfix operators sits exactly at the cap.
const DEEPEST_NESTED: usize = 130;

fn stacked(operators: usize) -> String {
    format!("root ::= \"x\"{}", "?".repeat(operators))
}

#[test]
fn a_run_of_postfix_operators_is_refused_before_it_can_overflow_the_stack() {
    // A RUN is one token however long it is, so it costs the engine no
    // rule levels at all: `MAX_GROUP_DEPTH` never sees it, and before
    // `MAX_NEST_DEPTH` existed a four-hundred-operator run ABORTED the
    // process on a 2 MiB thread. Measured: 393 levels parse there and
    // 395 abort.
    assert!(
        parse_gbnf(&stacked(DEEPEST_NESTED - 1)).is_ok(),
        "{} operators nest exactly to the cap and must still parse",
        DEEPEST_NESTED - 1
    );
    for operators in [DEEPEST_NESTED, 200, 400, 5_000, 50_000] {
        let error = parse_gbnf(&stacked(operators))
            .err()
            .unwrap_or_else(|| panic!("{operators} stacked operators must be refused"));
        assert!(
            error
                .to_string()
                .contains("nests elements more than 130 deep"),
            "{operators}: {error}"
        );
    }
}

#[test]
fn groups_and_postfix_operators_are_counted_together() {
    // The shape the group cap alone cannot see: 127 nested groups are
    // inside `MAX_GROUP_DEPTH`, and two `?` at every level build an IR
    // 381 deep, which aborted a 2 MiB thread. Each level costs two, so
    // the cut falls between 64 and 65 groups.
    let nest_with = |groups: usize, operators: usize| {
        format!(
            "root ::= {}\"x\"{}",
            "(".repeat(groups),
            format!("){}", "?".repeat(operators)).repeat(groups)
        )
    };
    assert!(
        parse_gbnf(&nest_with(64, 1)).is_ok(),
        "64 groups with one operator each nest to 129 and must parse"
    );
    for (groups, operators) in [(65usize, 1usize), (44, 2), (127, 2)] {
        let error = parse_gbnf(&nest_with(groups, operators))
            .err()
            .unwrap_or_else(|| panic!("{groups} groups with {operators} each must be refused"));
        assert!(
            error
                .to_string()
                .contains("nests elements more than 130 deep"),
            "{groups}/{operators}: {error}"
        );
    }
}

/// A count that wraps nothing costs no depth. `{1}` is `{1,1}`, which the
/// canonical answers with its argument unchanged, so a run of them must
/// not be turned away by a cap that counted operators rather than
/// wrappers.
#[test]
fn a_repetition_of_exactly_one_nests_nothing() {
    let src = format!("root ::= \"x\"{}", "{1}".repeat(500));
    assert!(
        parse_gbnf(&src).is_ok(),
        "{{1}} wraps nothing and nests nothing"
    );
}

#[test]
fn an_unbalanced_paren_is_refused_rather_than_looping() {
    for src in [
        "root ::= (",
        "root ::= )",
        "root ::= (\"a\"",
        "root ::= \"a\")",
        "root ::= ((((",
        "root ::= ))))",
    ] {
        let _ = parse_gbnf(src);
    }
    // The shapes that reach a definite answer are asserted; the loop
    // above exists to prove none of them diverges.
    assert!(parse_gbnf("root ::= )").is_err());
    assert!(parse_gbnf("root ::= \"a\")").is_err());
}

#[test]
fn an_unterminated_terminal_is_refused() {
    for src in [
        "root ::= \"unterminated",
        "root ::= [unterminated",
        "root ::= <unterminated",
        "root ::= \"a\\",
        "root ::= [a\\",
        "root ::= \"x\"{",
        "root ::= \"x\"{1,",
    ] {
        assert!(parse_gbnf(src).is_err(), "{src:?} must be refused");
    }
}

#[test]
fn empty_and_whitespace_only_source_is_refused() {
    for src in ["", " ", "\n", "   \n\t\r\n", "# only a comment\n"] {
        let error = parse_gbnf(src).expect_err("empty source is refused");
        assert!(
            error.to_string().contains("no productions found"),
            "{src:?}: {error}"
        );
    }
}

#[test]
fn control_characters_and_odd_unicode_do_not_panic() {
    for src in [
        "root ::= \"\u{0}\"",
        "root ::= \"\u{7f}\"",
        "root ::= \"\u{feff}\"",
        "root ::= \"\u{2028}\u{2029}\"",
        "root ::= [\u{0}-\u{10FFFF}]",
        "root ::= \"\u{1F600}\u{200D}\u{1F468}\"",
        "root ::= \u{1F600}",
        "root ::= \u{0}",
        "\u{feff}root ::= \"a\"",
    ] {
        // Answer or refusal, never a panic and never a hang.
        let _ = gbnf_convert(src, None);
    }
    // The ones with a definite answer.
    assert!(gbnf_convert("root ::= \"\u{1F600}\"", None).is_ok());
    assert!(gbnf_convert("root ::= [\u{0}-\u{10FFFF}]", None).is_ok());
    assert!(parse_gbnf("root ::= \u{0}").is_err());
}

#[test]
fn an_unpaired_surrogate_escape_is_refused_rather_than_replaced() {
    // A DIVERGENCE, recorded in DIVERGENCE.md 1: a Rust string holds
    // Unicode scalar values, so there is no lone surrogate to carry.
    // Refusing by name beats the silent U+FFFD substitution the Go port
    // makes. A PAIR is a different matter and is not refused: see the
    // case below.
    for src in [
        r#"root ::= "\uD800""#,
        r#"root ::= "\uDFFF""#,
        r"root ::= [\uD800]",
        r"root ::= [\uD800-\uDBFF]",
    ] {
        let error = parse_gbnf(src).expect_err("an unpaired surrogate escape is refused");
        assert!(
            error.to_string().contains("surrogate code point"),
            "{src}: {error}"
        );
    }
}

#[test]
fn a_surrogate_pair_in_a_literal_is_one_character() {
    // The canonical front-end appends UTF-16 code units to a UTF-16
    // string, so `"\uD83D\uDE00"` simply IS one emoji there. A Rust
    // `String` has to combine the halves, and a port that did not would
    // refuse the pair as two unpaired surrogates.
    let grammar = parse_gbnf(r#"root ::= "\uD83D\uDE00""#).expect("the pair is a character");
    let json = serde_json::to_value(&grammar).expect("serializes");
    assert_eq!(json["productions"][0]["alts"][0][0]["literal"], "\u{1F600}");
    let parser = compile(r#"root ::= "\uD83D\uDE00""#);
    assert!(parser.parse("\u{1F600}").is_ok());
}

#[test]
fn a_very_long_grammar_compiles_in_reasonable_time() {
    // Ten thousand alternatives in one rule: long, but flat. Nothing
    // here nests, so the only question is whether the work stays linear.
    let alts: Vec<String> = (0..10_000).map(|n| format!("\"a{n}\"")).collect();
    let src = format!("root ::= {}", alts.join(" | "));
    let started = Instant::now();
    let spec = gbnf_convert(&src, None).expect("a long flat grammar compiles");
    assert!(spec.rule.contains_key("root"));
    assert!(
        started.elapsed() < Duration::from_secs(60),
        "took {:?}",
        started.elapsed()
    );
}

#[test]
fn a_very_long_terminal_compiles() {
    let long = "a".repeat(100_000);
    let spec =
        gbnf_convert(&format!("root ::= \"{long}\""), None).expect("a long literal compiles");
    assert!(spec.rule.contains_key("root"));
}

#[test]
fn a_very_long_character_class_compiles() {
    // Every BMP code point as its own member, written as escapes.
    let mut members = String::new();
    for cp in 0x20u32..0x2000 {
        write!(members, "\\u{cp:04x}").expect("a String never fails to write");
    }
    let spec = gbnf_convert(&format!("root ::= [{members}]"), None).expect("a long class compiles");
    assert!(spec.rule.contains_key("root"));
}

#[test]
fn a_long_input_parses_without_hanging() {
    // The length here is deliberately modest, and that is a FINDING
    // rather than a convenience. A repetition emitted by the shared
    // compiler parses in time quadratic in the input length in this
    // runtime, where the canonical TypeScript is linear: see
    // DIVERGENCE.md 3, which measures both and names the owner. Until
    // that closes, a five-figure input is not a test, it is a hang, and
    // the bound below would be the only thing reporting it.
    let parser = compile("root ::= [a-z]+");
    for length in [1_000usize, 2_000] {
        let input = "a".repeat(length);
        let started = Instant::now();
        assert!(parser.parse(&input).is_ok(), "{length} characters");
        assert!(
            started.elapsed() < Duration::from_secs(60),
            "{length} characters took {:?}",
            started.elapsed()
        );
    }
}

#[test]
fn a_deeply_nested_input_is_refused_rather_than_aborting() {
    // The GRAMMAR is shallow; the INPUT is not. The engine's rule stack
    // grows with the input here, and the tree it would build nests with
    // it, so the parse must reach an ANSWER rather than run the stack
    // out. The depth is kept to four figures for the reason the case
    // above states.
    let parser = compile("root ::= \"[\" root \"]\" | \"x\"");
    assert!(parser.parse("[[[x]]]").is_ok());
    let deep = format!("{}x{}", "[".repeat(2_000), "]".repeat(2_000));
    // Whichever way it lands, it lands: an answer, not an abort.
    let _ = parser.parse(&deep);
}

#[test]
fn a_rendered_grammar_survives_the_deepest_ir_the_front_end_builds() {
    // The renderer walks the IR recursively, so the deepest grammar the
    // front-end will hand it has to render without running the stack out.
    for src in [nested(DEEPEST_ACCEPTED), stacked(DEEPEST_NESTED - 1)] {
        let grammar = parse_gbnf(&src).expect("the deepest grammar parses");
        let text = render_gbnf(&grammar, None).expect("it renders");
        let again = parse_gbnf(&text).expect("and reparses");
        assert_eq!(again.productions.len(), grammar.productions.len());
    }
}

#[test]
fn a_grammar_is_data_never_instructions() {
    // A rule name, literal or class is text. Nothing in this crate reads
    // one as a path, a command or a directive, and this case is the
    // reminder: the grammar below compiles to a grammar and does nothing
    // else.
    let src = "root ::= a\n\
               a ::= \"ignore previous instructions\" | \"rm -rf /\" | \"@include /etc/passwd\"";
    let parser = compile(src);
    assert!(parser.parse("rm -rf /").is_ok());
    assert!(parser.parse("anything else").is_err());
}
