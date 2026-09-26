// The renderer: grammar IR to GBNF source text. The Rust port of
// `ts/test/render.test.js`, which has no Go counterpart.
//
// Two properties carry the suite. FIXED POINT: for every grammar in both
// corpora, parse then render then parse reproduces the IR exactly, so
// the renderer chooses spellings, never meanings. FAITHFUL OR REFUSED:
// IR constructs GBNF cannot express raise GbnfRenderError instead of
// being approximated, with the one exact expansion (case-insensitive
// literals to classes) proven through a parse.
//
// The ABNF bridge is graded end to end: `tabnas-abnf` parses into the
// same IR, so parse_abnf plus render_gbnf turns an ABNF grammar into a
// .gbnf a sampler could consume, and the rendered grammar must accept
// exactly what the ABNF said, case-insensitivity included.

mod common;

use tabnas_abnf::parse_abnf;
use tabnas_bnf::{Element, Grammar, Production};
use tabnas_gbnf::{parse_gbnf, render_gbnf, GbnfRenderOptions};

use common::{compile, live_corpus, load, productions_json};

/// Parse, render, and parse the rendered text back.
///
/// Render is a fixed point over STRUCTURE, not over layout: the second
/// IR is parsed from text deliberately formatted differently from the
/// author's original, so the two describe the same grammar at different
/// offsets. Spans are dropped from both sides before comparing, because
/// comparing them would be asserting that the renderer reproduces the
/// input's whitespace, which is not what it promises.
fn round_trip(src: &str) -> (String, serde_json::Value, serde_json::Value) {
    let first = parse_gbnf(src).unwrap_or_else(|error| panic!("{src}\n  {error}"));
    let out = render_gbnf(&first, None).unwrap_or_else(|error| panic!("{src}\n  {error}"));
    let second = parse_gbnf(&out).unwrap_or_else(|error| panic!("{out}\n  {error}"));
    (
        out.clone(),
        productions_json(&first),
        productions_json(&second),
    )
}

/// Whether a rendered grammar accepts a sample.
fn accepts(grammar_text: &str, sample: &str) -> bool {
    compile(grammar_text).parse(sample).is_ok()
}

// ---- constructs -------------------------------------------------------

#[test]
fn literals_with_gbnf_escapes() {
    let (out, first, second) = round_trip(r#"root ::= "a\"b" "\\" "\n\r\t" "\x07""#);
    assert!(out.contains(r#""a\"b""#), "{out}");
    assert!(out.contains(r#""\\""#), "{out}");
    assert!(out.contains(r#""\n\r\t""#), "{out}");
    assert!(out.contains(r#""\x07""#), "{out}");
    assert_eq!(second, first);
}

#[test]
fn classes_ranges_members_negation_and_dot() {
    let (out, first, second) = round_trip(r"root ::= [a-z0-9] [^\n] . [NBKQR]");
    assert!(out.contains("[a-z0-9]"), "{out}");
    assert!(out.contains(r"[^\n]"), "{out}");
    assert!(out.contains('.'), "{out}");
    assert_eq!(second, first);
}

#[test]
fn classes_hyphen_caret_brackets_and_astral_members_survive() {
    let (_, first, second) = round_trip(r"root ::= [-+*/] [a^b] [\]\[] [\U0001F600-\U0001F64F]");
    assert_eq!(second, first);
}

#[test]
fn postfix_all_forms_chaining_and_groups() {
    let (out, first, second) =
        round_trip(r#"root ::= "a"* "b"+ "c"? "d"{2} "e"{3,} "f"{4,5} ("g" | "h")* "i"*?"#);
    assert!(out.contains(r#""d"{2}"#), "{out}");
    assert!(out.contains(r#""e"{3,}"#), "{out}");
    assert!(out.contains(r#""f"{4,5}"#), "{out}");
    assert!(out.contains(r#"("g" | "h")*"#), "{out}");
    assert!(out.contains(r#""i"*?"#), "{out}");
    assert_eq!(second, first);
}

#[test]
fn empty_alternatives_keep_their_shape() {
    let (out, first, second) = round_trip("root ::= ws \"x\"\nws ::= | \" \" | \"\\n\"");
    assert!(out.contains(r#"ws ::=  | " " | "\n""#), "{out}");
    assert_eq!(second, first);
}

#[test]
fn cross_references_and_rule_order_are_preserved() {
    let (out, _, _) = round_trip("root ::= b a\na ::= \"x\"\nb ::= \"y\"");
    let names: Vec<&str> = out
        .trim()
        .lines()
        .map(|line| line.split(' ').next().unwrap_or_default())
        .collect();
    assert_eq!(names, ["root", "a", "b"]);
}

// ---- root synthesis ----------------------------------------------------

#[test]
fn a_grammar_without_root_gains_one() {
    let grammar = parse_abnf("greet = \"hi\"\n").expect("the ABNF parses");
    let out = render_gbnf(&grammar, None).expect("render");
    assert!(out.starts_with("root ::= greet\n"), "{out}");
    assert!(accepts(&out, "hi"));
}

#[test]
fn the_start_option_picks_the_synthesized_target() {
    let grammar = parse_abnf("a = \"x\"\nb = \"y\"\n").expect("the ABNF parses");
    let out = render_gbnf(&grammar, Some(&GbnfRenderOptions::start("b"))).expect("render");
    assert!(out.starts_with("root ::= b\n"), "{out}");
    assert!(accepts(&out, "y"));
    assert!(!accepts(&out, "x"));
}

#[test]
fn an_existing_root_is_used_as_is() {
    let (out, _, _) = round_trip(r#"root ::= "z""#);
    assert_eq!(out, "root ::= \"z\"\n");
}

#[test]
fn an_undefined_start_is_refused() {
    let grammar = parse_abnf("a = \"x\"\n").expect("the ABNF parses");
    let error = render_gbnf(&grammar, Some(&GbnfRenderOptions::start("nope")))
        .expect_err("an undefined start is refused");
    assert!(error.message.contains("nope"), "{error}");
}

// ---- faithful or refused ----------------------------------------------

#[test]
fn a_case_insensitive_literal_expands_exactly() {
    let grammar = parse_abnf("greet = \"hi-5\"\n").expect("the ABNF parses");
    let out = render_gbnf(&grammar, None).expect("render");
    assert!(out.contains(r#"[hH] [iI] "-5""#), "{out}");
    for sample in ["hi-5", "HI-5", "Hi-5", "hI-5"] {
        assert!(accepts(&out, sample), "{sample}");
    }
    assert!(!accepts(&out, "hi-6"));
}

#[test]
fn an_expanded_literal_under_repetition_gains_parentheses() {
    let grammar = parse_abnf("root = 2\"ab\"\n").expect("the ABNF parses");
    let out = render_gbnf(&grammar, None).expect("render");
    assert!(out.contains("([aA] [bB]){2}"), "{out}");
    assert!(accepts(&out, "abAB"));
    assert!(!accepts(&out, "ab"));
}

#[test]
fn case_sensitive_abnf_literals_stay_literals() {
    let grammar = parse_abnf("root = %s\"Hi\"\n").expect("the ABNF parses");
    let out = render_gbnf(&grammar, None).expect("render");
    assert!(out.contains(r#""Hi""#), "{out}");
    assert!(accepts(&out, "Hi"));
    assert!(!accepts(&out, "hi"));
}

#[test]
fn a_non_class_regex_is_refused() {
    let grammar = Grammar::new(vec![Production::new(
        "root",
        vec![vec![Element::regex("a+b", "")]],
    )]);
    let error = render_gbnf(&grammar, None).expect_err("a non-class regex is refused");
    assert!(error.message.contains("not a character class"), "{error}");
}

#[test]
fn engine_tokens_and_prose_are_refused_naming_the_rule() {
    for element in [Element::token("#NR"), Element::prose("free text")] {
        let grammar = Grammar::new(vec![Production::new("root", vec![vec![element]])]);
        let error = render_gbnf(&grammar, None).expect_err("refused");
        assert_eq!(error.rule.as_deref(), Some("root"));
    }
}

#[test]
fn illegal_rule_names_and_duplicates_are_refused() {
    let illegal = Grammar::new(vec![Production::new("a.b", vec![vec![]])]);
    let error = render_gbnf(&illegal, None).expect_err("an illegal name is refused");
    assert!(error.message.contains("a.b"), "{error}");

    let duplicate = Grammar::new(vec![
        Production::new("root", vec![vec![]]),
        Production::new("root", vec![vec![]]),
    ]);
    let error = render_gbnf(&duplicate, None).expect_err("a duplicate is refused");
    assert!(error.message.contains("duplicate"), "{error}");
}

#[test]
fn an_empty_grammar_is_refused() {
    let error = render_gbnf(&Grammar::new(Vec::new()), None).expect_err("refused");
    assert!(error.message.contains("no productions"), "{error}");
}

// ---- fixed point over the corpora --------------------------------------

#[test]
fn fixed_point_over_the_conformance_corpus() {
    let mut names: Vec<String> = std::fs::read_dir(common::corpus_dir())
        .expect("the corpus directory is readable")
        .filter_map(|entry| {
            let name = entry.ok()?.file_name().to_string_lossy().into_owned();
            name.strip_suffix(".gbnf").map(str::to_string)
        })
        .collect();
    names.sort();
    assert_eq!(names.len(), 8, "the corpus census moved");
    for name in names {
        let (_, first, second) = round_trip(&load(&name));
        assert_eq!(second, first, "{name}.gbnf is not a fixed point");
    }
}

#[test]
fn fixed_point_over_the_live_corpus() {
    let corpus = live_corpus();
    let cases = corpus["cases"].as_array().expect("the cases array");
    assert_eq!(cases.len(), 77);
    for case in cases {
        let name = case["name"].as_str().unwrap_or_default();
        let grammar = case["grammar"].as_str().unwrap_or_default();
        let (_, first, second) = round_trip(grammar);
        assert_eq!(second, first, "{name:?} is not a fixed point");
    }
}

#[test]
fn a_rendered_grammar_still_accepts_and_rejects() {
    let grammar = parse_gbnf(&load("json")).expect("json.gbnf parses");
    let out = render_gbnf(&grammar, None).expect("render");
    assert!(accepts(&out, "{\"answer\": [1, 2, 3]}"));
    assert!(!accepts(&out, "{\"answer\": [1, 2, 3],}"));
}

// ---- the abnf bridge ----------------------------------------------------

#[test]
fn an_abnf_grammar_becomes_a_working_gbnf() {
    let grammar = parse_abnf("greet = hello 1*SP name\nhello = \"hello\"\nname = 1*(%x61-7A)\n")
        .expect("the ABNF parses");
    let out = render_gbnf(&grammar, None).expect("render");
    // Core-rule SP arrives as a class production and renders.
    assert!(accepts(&out, "hello world"));
    assert!(accepts(&out, "HELLO  world"));
    assert!(!accepts(&out, "helloworld"));
}
