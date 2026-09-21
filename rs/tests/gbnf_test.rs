// The in-language suite: the IR shape per construct, the escape family,
// character classes, repetition, the validation refusals, exact lexing,
// end-to-end parses and the public surface. The Rust port of
// `ts/test/gbnf.test.js` and of the cases `go/gbnf_test.go` mirrors from
// it.
//
// IR values are compared STRUCTURALLY and span-free; `spans_test.rs`
// asserts positions on their own terms.

mod common;

use serde_json::json;
use tabnas::Tabnas;
use tabnas_gbnf::{gbnf, gbnf_convert, parse_gbnf, plugin, to_spec, GbnfConvertOptions, GbnfError};

use common::{
    accepts, accepts_with, all_eager, alts, any_eager, compile, convert, first_element, ir,
    match_tokens, options, rule_open,
};

// ---- parser (GBNF text to IR) ---------------------------------------

#[test]
fn parses_a_rule_into_a_production() {
    assert_eq!(
        ir(r#"root ::= "a""#)["productions"],
        json!([{
            "name": "root",
            "alts": [[{ "kind": "term", "literal": "a", "caseSensitive": true }]],
            "nodeKind": "user",
        }])
    );
}

#[test]
fn marks_string_literals_case_sensitive() {
    // GBNF's default is the OPPOSITE of RFC 5234's. Losing the flag would
    // silently accept `TRUE` for `"true"`, so it is asserted on the IR as
    // well as through the parse below.
    assert_eq!(
        first_element(r#"root ::= "true""#)["caseSensitive"],
        json!(true)
    );
}

#[test]
fn parses_alternation_and_sequence() {
    assert_eq!(
        alts(r#"root ::= "a" "b" | "c""#, 0),
        json!([
            [
                { "kind": "term", "literal": "a", "caseSensitive": true },
                { "kind": "term", "literal": "b", "caseSensitive": true },
            ],
            [{ "kind": "term", "literal": "c", "caseSensitive": true }],
        ])
    );
}

#[test]
fn parses_a_group_as_a_nested_alternation() {
    assert_eq!(
        alts(r#"root ::= ("a" | "b") "c""#, 0),
        json!([[
            {
                "kind": "group",
                "alts": [
                    [{ "kind": "term", "literal": "a", "caseSensitive": true }],
                    [{ "kind": "term", "literal": "b", "caseSensitive": true }],
                ],
            },
            { "kind": "term", "literal": "c", "caseSensitive": true },
        ]])
    );
}

#[test]
fn parses_an_empty_alternative() {
    // llama.cpp's own json.gbnf writes optional whitespace this way, so
    // unlike the EBNF front-end this one must NOT refuse it.
    assert_eq!(
        ir("root ::= ws\nws ::= | \" \"")["productions"][1],
        json!({
            "name": "ws",
            "alts": [[], [{ "kind": "term", "literal": " ", "caseSensitive": true }]],
            "nodeKind": "user",
        })
    );
}

#[test]
fn parses_a_rule_reference() {
    assert_eq!(
        ir("root ::= item\nitem ::= \"x\"")["productions"][0],
        json!({
            "name": "root",
            "alts": [[{ "kind": "ref", "name": "item" }]],
            "nodeKind": "user",
        })
    );
}

#[test]
fn accepts_dashed_underscored_and_digit_leading_rule_names() {
    // llama.cpp's is_word_char is [A-Za-z0-9_-], so all three are legal
    // names. japanese.gbnf uses `jp-char`.
    let grammar =
        parse_gbnf("root ::= jp-char\njp-char ::= a_1\na_1 ::= 2nd\n2nd ::= \"x\"").expect("parse");
    let names: Vec<&str> = grammar
        .productions
        .iter()
        .map(|production| production.name.as_str())
        .collect();
    assert_eq!(names, ["root", "jp-char", "a_1", "2nd"]);
}

#[test]
fn drops_an_empty_string_literal() {
    // `""` denotes zero characters, so it contributes no element: the
    // alternative it sits in is the empty sequence.
    assert_eq!(alts(r#"root ::= """#, 0), json!([[]]));
}

#[test]
fn keeps_the_last_of_two_definitions_of_one_rule() {
    // GBNF has no `=/`; llama.cpp stores rules in a map, so a second
    // definition replaces the first rather than extending it.
    let grammar = parse_gbnf("root ::= a\na ::= \"x\"\na ::= \"y\"").expect("parse");
    assert_eq!(grammar.productions.len(), 2);
    assert_eq!(
        alts("root ::= a\na ::= \"x\"\na ::= \"y\"", 1),
        json!([[{ "kind": "term", "literal": "y", "caseSensitive": true }]])
    );
}

// ---- comments --------------------------------------------------------

#[test]
fn drops_a_comment_to_end_of_line() {
    assert_eq!(
        ir("# leading\nroot ::= \"a\" # trailing\n")["productions"],
        json!([{
            "name": "root",
            "alts": [[{ "kind": "term", "literal": "a", "caseSensitive": true }]],
            "nodeKind": "user",
        }])
    );
}

#[test]
fn does_not_treat_hash_inside_a_literal_or_class_as_a_comment() {
    let first = alts(r##"root ::= "#" [+#]"##, 0);
    assert_eq!(
        first[0][0],
        json!({ "kind": "term", "literal": "#", "caseSensitive": true })
    );
    assert_eq!(first[0][1]["pattern"], json!(r"[\u002b\u0023]"));
}

// ---- character classes -----------------------------------------------

#[test]
fn lowers_a_range_to_an_anchored_regex_terminal() {
    assert_eq!(
        first_element("root ::= [a-z]"),
        json!({ "kind": "regex", "pattern": r"[\u0061-\u007a]", "flags": "" })
    );
}

#[test]
fn lowers_an_enumeration() {
    assert_eq!(
        first_element("root ::= [NBKQR]"),
        json!({
            "kind": "regex",
            "pattern": r"[\u004e\u0042\u004b\u0051\u0052]",
            "flags": "",
        })
    );
}

#[test]
fn lowers_negation() {
    // `u` even though no astral code point is written: the class matches
    // the COMPLEMENT of its members, and that complement contains every
    // astral code point.
    assert_eq!(
        first_element(r"root ::= [^\n]"),
        json!({ "kind": "regex", "pattern": r"[^\u000a]", "flags": "u" })
    );
}

#[test]
fn matches_an_astral_code_point_as_one_character() {
    // GBNF terminals are Unicode code points by definition, so a matcher
    // that can reach beyond the BMP has to consume the whole character.
    // The `regex` crate works in scalar values throughout, which is what
    // gives this for free where a UTF-16 runtime needs the `u` flag.
    for src in ["root ::= .", r"root ::= [^\n]"] {
        let element = first_element(src);
        let pattern = format!("^{}", element["pattern"].as_str().expect("a pattern"));
        let regex = regex_lite(&pattern);
        let found = regex
            .find("\u{1F600}")
            .unwrap_or_else(|| panic!("{src} should match an astral character"));
        assert_eq!(
            found.as_str(),
            "\u{1F600}",
            "{src} must consume the whole character, not one surrogate"
        );
    }
}

fn regex_lite(pattern: &str) -> regex::Regex {
    regex::Regex::new(pattern).expect("the emitted pattern compiles")
}

#[test]
fn treats_a_trailing_hyphen_as_a_literal_member() {
    // arithmetic.gbnf's `[-+*/]` is four members, not a range.
    assert_eq!(
        first_element("root ::= [-+*/]")["pattern"],
        json!(r"[\u002d\u002b\u002a\u002f]")
    );
    assert_eq!(
        first_element("root ::= [a-]")["pattern"],
        json!(r"[\u0061\u002d]")
    );
}

#[test]
fn lowers_a_non_ascii_range() {
    // japanese.gbnf's hiragana block.
    assert_eq!(
        first_element("root ::= [\u{3041}-\u{309F}]"),
        json!({ "kind": "regex", "pattern": r"[\u3041-\u309f]", "flags": "" })
    );
}

#[test]
fn sets_the_u_flag_for_an_astral_range() {
    // Above the BMP `\uXXXX` cannot spell the endpoint, so the class
    // switches to `\u{…}`.
    assert_eq!(
        first_element(r"root ::= [\U0001F600-\U0001F64F]"),
        json!({ "kind": "regex", "pattern": r"[\u{1f600}-\u{1f64f}]", "flags": "u" })
    );
}

#[test]
fn lowers_the_dot_to_any_character() {
    assert_eq!(
        first_element("root ::= ."),
        json!({ "kind": "regex", "pattern": r"[\s\S]", "flags": "u" })
    );
}

#[test]
fn accepts_only_llama_cpp_whitespace_inside_repetition_braces() {
    // `parse_space` takes space, tab, CR and LF. A Unicode-aware
    // whitespace class also admits NBSP and friends, which would compile
    // grammars llama.cpp rejects.
    assert!(parse_gbnf("root ::= \"x\"{ 1 }").is_ok());
    assert!(parse_gbnf("root ::= \"x\"{\t1,2\t}").is_ok());
    // U+00A0 NO-BREAK SPACE: Unicode whitespace, not parse_space.
    assert!(parse_gbnf("root ::= \"x\"{\u{a0}1}").is_err());
}

#[test]
fn rejects_an_empty_class() {
    let error = parse_gbnf("root ::= []").expect_err("an empty class is refused");
    assert!(matches!(error, GbnfError::Parse(_)), "{error:?}");
    assert!(
        error.to_string().contains("empty character class"),
        "{error}"
    );
}

#[test]
fn rejects_a_descending_range() {
    let error = parse_gbnf("root ::= [z-a]").expect_err("a descending range is refused");
    assert!(matches!(error, GbnfError::Parse(_)), "{error:?}");
    assert!(error.to_string().contains("descending range"), "{error}");
}

// ---- escapes ---------------------------------------------------------

#[test]
fn decodes_the_control_and_structural_escapes() {
    assert_eq!(
        first_element(r#"root ::= "\n\r\t\\\"\[\]""#)["literal"],
        json!("\n\r\t\\\"[]")
    );
}

#[test]
fn decodes_the_hex_escape_family() {
    assert_eq!(
        first_element(r#"root ::= "\x41B\U00000043""#)["literal"],
        json!("ABC")
    );
}

#[test]
fn decodes_an_astral_escape_to_one_character() {
    // A Rust string holds scalar values, so the astral code point is ONE
    // character where the canonical runtime counts two UTF-16 units. Both
    // denote the same character, which is what the grammar means.
    let literal = first_element(r#"root ::= "\U0001F600""#)["literal"]
        .as_str()
        .expect("a literal")
        .to_string();
    assert_eq!(literal.chars().next().map(|c| c as u32), Some(0x1F600));
    assert_eq!(literal.chars().count(), 1);
    assert_eq!(literal.encode_utf16().count(), 2);
}

#[test]
fn decodes_escapes_inside_a_character_class() {
    assert_eq!(
        first_element(r"root ::= [\x00-\x1F\x7F]")["pattern"],
        json!(r"[\u0000-\u001f\u007f]")
    );
}

#[test]
fn rejects_an_unknown_escape() {
    // llama.cpp throws "unknown escape"; copying the character through
    // instead would quietly change the accepted language.
    let error = parse_gbnf(r#"root ::= "\q""#).expect_err("an unknown escape is refused");
    assert!(matches!(error, GbnfError::Parse(_)), "{error:?}");
    assert!(
        error.to_string().contains(r"unknown escape '\q'"),
        "{error}"
    );
}

#[test]
fn rejects_a_short_hex_escape() {
    let error = parse_gbnf(r#"root ::= "\u12""#).expect_err("a short escape is refused");
    assert!(error.to_string().contains("needs 4 hex digits"), "{error}");
}

#[test]
fn rejects_a_code_point_above_the_unicode_maximum() {
    let error = parse_gbnf(r#"root ::= "\UFFFFFFFF""#).expect_err("out of range is refused");
    assert!(
        error.to_string().contains("not a Unicode code point"),
        "{error}"
    );
}

// ---- repetition ------------------------------------------------------

#[test]
fn lowers_star_plus_and_opt() {
    assert_eq!(
        first_element(r#"root ::= "x"*"#),
        json!({
            "kind": "star",
            "inner": { "kind": "term", "literal": "x", "caseSensitive": true },
        })
    );
    assert_eq!(first_element(r#"root ::= "x"+"#)["kind"], json!("plus"));
    assert_eq!(first_element(r#"root ::= "x"?"#)["kind"], json!("opt"));
}

#[test]
fn lowers_a_closed_rep() {
    assert_eq!(
        first_element(r#"root ::= "x"{3}"#),
        json!({
            "kind": "rep",
            "min": 3,
            "max": 3,
            "inner": { "kind": "term", "literal": "x", "caseSensitive": true },
        })
    );
}

#[test]
fn lowers_a_bounded_rep() {
    let element = first_element(r#"root ::= "x"{2,5}"#);
    assert_eq!(element["kind"], json!("rep"));
    assert_eq!(element["min"], json!(2));
    assert_eq!(element["max"], json!(5));
}

#[test]
fn lowers_an_unbounded_rep() {
    // The canonical runtime spells the unbounded maximum `Infinity`,
    // which JSON carries as `null`; this port spells it `None`. The
    // shared compiler tests for it to choose a star tail over nested
    // optionals, so a large finite number here would unroll into that
    // many helper rules instead.
    let element = first_element(r#"root ::= "x"{2,}"#);
    assert_eq!(element["kind"], json!("rep"));
    assert_eq!(element["min"], json!(2));
    assert_eq!(element["max"], json!(null));
}

#[test]
fn collapses_the_degenerate_brace_forms() {
    assert_eq!(first_element(r#"root ::= "x"{0,}"#)["kind"], json!("star"));
    assert_eq!(first_element(r#"root ::= "x"{1,}"#)["kind"], json!("plus"));
    assert_eq!(first_element(r#"root ::= "x"{0,1}"#)["kind"], json!("opt"));
    assert_eq!(
        first_element(r#"root ::= "x"{1}"#),
        json!({ "kind": "term", "literal": "x", "caseSensitive": true })
    );
}

#[test]
fn applies_a_chained_postfix_run_left_to_right() {
    // `x*?` is `(x*)?`, the order llama.cpp's sequence loop uses.
    assert_eq!(
        first_element(r#"root ::= "x"*?"#),
        json!({
            "kind": "opt",
            "inner": {
                "kind": "star",
                "inner": { "kind": "term", "literal": "x", "caseSensitive": true },
            },
        })
    );
}

#[test]
fn binds_a_postfix_to_a_group() {
    let element = first_element(r#"root ::= ("a" "b")+"#);
    assert_eq!(element["kind"], json!("plus"));
    assert_eq!(element["inner"]["kind"], json!("group"));
}

#[test]
fn rejects_an_inverted_bound() {
    let error = parse_gbnf(r#"root ::= "x"{5,2}"#).expect_err("an inverted bound is refused");
    assert!(matches!(error, GbnfError::Parse(_)), "{error:?}");
    assert!(
        error
            .to_string()
            .contains("upper bound below its lower bound"),
        "{error}"
    );
}

// ---- the root requirement --------------------------------------------

#[test]
fn rejects_a_grammar_with_no_root_rule() {
    // llama.cpp: "grammar does not contain a 'root' symbol". The start
    // symbol is part of the notation, not a convention.
    let error = parse_gbnf(r#"a ::= "x""#).expect_err("no root is refused");
    assert!(matches!(error, GbnfError::Compile(_)), "{error:?}");
    assert_eq!(error.rule(), Some("root"));
    assert!(error.to_string().contains("no 'root' rule"), "{error}");
}

#[test]
fn starts_at_root_wherever_root_is_declared() {
    assert_eq!(
        rule_open("a ::= \"x\"\nroot ::= a", "__start__"),
        json!([{ "p": "root", "g": "gbnf" }])
    );
}

#[test]
fn honours_an_explicit_start_override() {
    let opts = GbnfConvertOptions::default().start("a");
    let spec = gbnf_convert("root ::= a\na ::= \"x\"", Some(&opts)).expect("convert");
    let open = common::strip_actions(
        &spec
            .rule
            .get("__start__")
            .and_then(Option::as_ref)
            .expect("the start wrapper")
            .to_value()["open"],
    );
    assert_eq!(open, json!([{ "p": "a", "g": "gbnf" }]));
}

// ---- tokenizer-token terminals ---------------------------------------
//
// Policy: these parse, so they are not syntax errors, and are then
// rejected by name. There is no faithful text semantics for a construct
// that matches a sampler's vocabulary entries.

#[test]
fn rejects_a_token_terminal_naming_the_rule() {
    let error = parse_gbnf("root ::= think\nthink ::= <think> \"x\"")
        .expect_err("a token terminal is refused");
    assert!(matches!(error, GbnfError::Compile(_)), "{error:?}");
    assert_eq!(error.rule(), Some("think"));
    assert!(
        error
            .to_string()
            .contains("tokenizer-token terminal '<think>'"),
        "{error}"
    );
}

#[test]
fn rejects_a_token_id_terminal() {
    let error = parse_gbnf("root ::= <[1000]>").expect_err("a token id is refused");
    assert!(error.to_string().contains("<[1000]>"), "{error}");
}

#[test]
fn rejects_a_negated_token_terminal() {
    let error = parse_gbnf("root ::= !</think> \"x\"").expect_err("a negated token is refused");
    assert!(error.to_string().contains("!</think>"), "{error}");
}

#[test]
fn rejects_one_nested_inside_a_group() {
    let error = parse_gbnf(r#"root ::= ("a" | <think>)*"#).expect_err("nested is refused");
    assert!(matches!(error, GbnfError::Compile(_)), "{error:?}");
    assert_eq!(error.rule(), Some("root"));
}

#[test]
fn a_token_terminal_is_a_compile_failure_not_a_syntax_one() {
    // The distinction is the point of the policy: the grammar text is
    // well-formed GBNF, and the diagnostic says so.
    let error = parse_gbnf("root ::= <think>").expect_err("refused");
    assert!(matches!(error, GbnfError::Compile(_)), "{error:?}");
    assert_eq!(error.name(), "GbnfCompileError");
}

// ---- undefined references --------------------------------------------

#[test]
fn rejects_a_reference_to_a_rule_that_is_never_defined() {
    let error = parse_gbnf("root ::= nope").expect_err("an undefined reference is refused");
    assert!(matches!(error, GbnfError::Compile(_)), "{error:?}");
    assert_eq!(error.rule(), Some("root"));
    assert!(
        error
            .to_string()
            .contains("references 'nope', which is never defined"),
        "{error}"
    );
}

#[test]
fn does_not_let_a_bareword_fall_through_to_a_builtin_lexer_token() {
    // The shared compiler maps an undefined `TX` / `NR` / `ST` / `VL`
    // reference onto the engine's own lexer tokens. That is right for
    // ABNF and wrong for GBNF, where those are ordinary rule names, so
    // the check above must run first.
    let error = parse_gbnf("root ::= NR").expect_err("NR is an ordinary name here");
    assert!(matches!(error, GbnfError::Compile(_)), "{error:?}");
    assert!(error.to_string().contains("'NR'"), "{error}");
}

// ---- syntax errors ---------------------------------------------------

#[test]
fn reports_a_line_and_column() {
    let error = parse_gbnf("root ::= \"a\"\nbroken ::= ::=").expect_err("a syntax error");
    assert!(matches!(error, GbnfError::Parse(_)), "{error:?}");
    assert_eq!(error.line(), Some(2));
}

#[test]
fn rejects_empty_source() {
    let error = parse_gbnf("   \n").expect_err("empty source is refused");
    assert!(matches!(error, GbnfError::Parse(_)), "{error:?}");
    assert!(
        error.to_string().contains("no productions found"),
        "{error}"
    );
}

// ---- emission --------------------------------------------------------

#[test]
fn emits_a_case_sensitive_literal_as_a_fixed_token() {
    // A fixed token is an exact byte match. An `i`-flagged regex here
    // would be the ABNF lowering, and would accept `TRUE`.
    let options = options(r#"root ::= "true""#);
    assert_eq!(options["fixed"]["token"], json!({ "#TRUE": "true" }));
    assert!(options.get("match").is_none(), "{options}");
}

#[test]
fn emits_a_character_class_as_an_anchored_match_token() {
    let tokens = match_tokens("root ::= [a-z]");
    assert_eq!(tokens, [r"@~/^[\u0061-\u007a]/"]);
}

#[test]
fn tags_every_alt_with_the_gbnf_group() {
    assert_eq!(
        rule_open(r#"root ::= "a""#, "root"),
        json!([{ "s": "#A", "g": "gbnf" }])
    );
}

#[test]
fn honours_a_tag_override() {
    let opts = GbnfConvertOptions::default().tag("custom");
    let spec = gbnf_convert(r#"root ::= "a""#, Some(&opts)).expect("convert");
    let open = common::strip_actions(
        &spec
            .rule
            .get("root")
            .and_then(Option::as_ref)
            .expect("root")
            .to_value()["open"],
    );
    assert_eq!(open, json!([{ "s": "#A", "g": "custom" }]));
}

#[test]
fn does_not_mutate_the_parsed_grammar_so_emitting_twice_agrees() {
    let grammar = parse_gbnf("root ::= \"a\" item\nitem ::= \"b\" \"c\"").expect("parse");
    let first = tabnas_gbnf::emit_grammar_spec(&grammar, None).expect("emit");
    let second = tabnas_gbnf::emit_grammar_spec(&grammar, None).expect("emit");
    let names =
        |spec: &tabnas_gbnf::GrammarSpec| -> Vec<String> { spec.rule.keys().cloned().collect() };
    assert_eq!(names(&second), names(&first));
}

/// `emit_grammar_spec` is the SHARED compiler's emitter under this
/// crate's name, exactly as `ts/src/converter.ts` re-exports
/// `emitGrammarSpec` from `@tabnas/bnf`. It therefore carries the
/// COMPILER's defaults: the first production as the start symbol, and
/// the shared `bnf` tag.
///
/// GBNF's own defaults, `root` and `gbnf`, belong to `gbnf_convert`,
/// which is where the canonical puts them. A wrapper that applied them
/// here would answer a different spec from the canonical export for the
/// same arguments, and nothing would say so.
#[test]
fn the_bare_emitter_keeps_the_shared_compilers_defaults() {
    let grammar = parse_gbnf("a ::= \"x\"\nroot ::= a").expect("parse");
    let spec = tabnas_gbnf::emit_grammar_spec(&grammar, None).expect("emit");
    assert_eq!(
        spec.rule.keys().cloned().collect::<Vec<String>>(),
        vec!["a", "root", "__start__"],
        "the start symbol defaults to the FIRST production, not to root"
    );
    let open = spec
        .rule
        .get("root")
        .and_then(Option::as_ref)
        .expect("root")
        .to_value()["open"]
        .clone();
    assert_eq!(open[0]["g"], json!("bnf"), "the tag is the compiler's");

    // And the notation's entry point is what supplies GBNF's own.
    let spec = gbnf_convert("a ::= \"x\"\nroot ::= a", None).expect("convert");
    assert_eq!(
        spec.rule.keys().cloned().collect::<Vec<String>>(),
        vec!["root", "__start__"],
        "gbnf_convert starts at root"
    );
    let open = spec
        .rule
        .get("root")
        .and_then(Option::as_ref)
        .expect("root")
        .to_value()["open"]
        .clone();
    assert_eq!(open[0]["g"], json!("gbnf"));
}

// ---- exact lexing ----------------------------------------------------
//
// GBNF is scannerless: the grammar describes every character. The
// engine's defaults are JSON-shaped and lenient, so the emitted spec
// turns them off; otherwise `root ::= "a"` would accept `" a "`, and a
// `#` in the INPUT would vanish as a comment.

#[test]
fn emits_an_empty_ignore_set() {
    assert_eq!(
        options(r#"root ::= "a""#)["tokenSet"],
        json!({ "IGNORE": [] })
    );
}

#[test]
fn switches_off_every_default_matcher() {
    let options = options(r#"root ::= "a""#);
    for off in [
        "space", "line", "comment", "string", "number", "text", "value",
    ] {
        assert_eq!(options[off], json!({ "lex": false }), "{off} must be off");
    }
}

#[test]
fn does_not_skip_whitespace_the_grammar_did_not_ask_for() {
    accepts(
        r#"root ::= "a" "b""#,
        &["ab"],
        &["a b", " ab", "ab ", "a\nb"],
    );
}

#[test]
fn matches_whitespace_the_grammar_does_ask_for() {
    accepts(r#"root ::= "a" " " "b""#, &["a b"], &["ab"]);
    accepts(r#"root ::= "a" "\n" "b""#, &["a\nb"], &["ab", "a b"]);
    accepts(
        r#"root ::= "a" [ \t]+ "b""#,
        &["a b", "a\tb", "a \t b"],
        &["ab"],
    );
}

#[test]
fn treats_hash_in_the_input_as_an_ordinary_character() {
    accepts(r##"root ::= "#" "a""##, &["#a"], &["#", "a"]);
    accepts(r#"root ::= "a""#, &["a"], &["a#comment"]);
}

#[test]
fn treats_a_quote_in_the_input_as_an_ordinary_character() {
    accepts(r#"root ::= "\"" "a" "\"""#, &["\"a\""], &["a"]);
}

#[test]
fn lexes_classes_eagerly_when_the_grammar_makes_that_unambiguous() {
    // Rule-directed lexing hides a class token wherever the active rule
    // does not name it, which is exactly where a repetition ends. When
    // the classes are pairwise disjoint AND no class holds the first
    // character of a literal, tokenisation cannot depend on parse state,
    // so the gate is dropped.

    // One class, no literals: trivially unambiguous.
    assert!(all_eager("root ::= sign? [0-9]+\nsign ::= \"-\""));
    // Two disjoint classes.
    assert!(all_eager("root ::= [a-z]? [0-9]"));
    // Overlapping classes: the gate is what tells them apart.
    assert!(!all_eager("root ::= [a-z] [a-z0-9_]*"));
    // A class holding the first character of a literal: an eager class
    // would swallow the literal's opening character, because match
    // matchers run before the fixed matcher.
    assert!(!all_eager("root ::= digit \"0\"\ndigit ::= [0-9]"));
    // `.` is every character, so it overlaps everything.
    assert!(!all_eager("root ::= . [0-9]"));
}

#[test]
fn eager_classes_let_a_repetition_end_on_a_different_class() {
    accepts(
        "root ::= sign? [0-9]+\nsign ::= \"-\"",
        &["1", "42", "-42"],
        &["-", "x"],
    );
    accepts("root ::= [a-z]? [0-9]", &["5", "a5"], &["ab", ""]);
}

#[test]
fn eager_classes_off_keeps_the_engine_rule_directed() {
    let opts = GbnfConvertOptions::default().eager_classes(false);
    let spec = gbnf_convert("root ::= [a-z]? [0-9]", Some(&opts)).expect("convert");
    let tokens: Vec<String> = spec.options["match"]["token"]
        .as_object()
        .expect("match tokens")
        .values()
        .map(|value| value.as_str().unwrap_or_default().to_string())
        .collect();
    assert!(
        tokens.iter().all(|token| !token.starts_with("@~/")),
        "{tokens:?}"
    );
    // The accepted language is unchanged, which is the whole claim the
    // opt-out makes: dropping the rule-directed gate is a lexing
    // decision, never a language one. Measured against the canonical
    // runtime, which answers the same for this grammar with the flag set
    // either way.
    accepts_with(
        "root ::= [a-z]? [0-9]",
        &["5", "a5"],
        &["ab", ""],
        Some(&opts),
    );
}

#[test]
fn a_class_matcher_is_eager_by_default_but_never_a_literal_one() {
    // An eager flag on a class token is this front-end's decision; on
    // anything else it is the shared compiler's, and the front-end must
    // not inherit it wholesale.
    assert!(any_eager("root ::= [0-9]+"));
    assert!(!any_eager("root ::= [a-z] [a-z0-9_]*"));
}

#[test]
fn decides_the_empty_input_from_the_grammar() {
    // The engine short-circuits the empty string before any rule runs, so
    // whether it is in the language is settled at compile time.
    // Negotiated lexing (relex) is always on for GBNF: the notation is
    // scannerless, so one character can be a different token in different
    // parse contexts, and alternatives must be able to re-cut.
    let lex = |src: &str| options(src)["lex"].clone();
    assert_eq!(
        lex(r#"root ::= "x""#),
        json!({ "empty": false, "relex": true })
    );
    assert_eq!(
        lex(r#"root ::= "x"*"#),
        json!({ "empty": true, "relex": true })
    );
    assert_eq!(
        lex(r#"root ::= "x"?"#),
        json!({ "empty": true, "relex": true })
    );
    assert_eq!(
        lex(r#"root ::= "x"{0,3}"#),
        json!({ "empty": true, "relex": true })
    );
    assert_eq!(
        lex("root ::= ws\nws ::= | \" \""),
        json!({ "empty": true, "relex": true })
    );
}

// ---- end-to-end parses ------------------------------------------------

#[test]
fn end_to_end_alternation() {
    accepts(r#"root ::= "a" | "b""#, &["a", "b"], &["c", "ab"]);
}

#[test]
fn end_to_end_sequence_and_grouping() {
    accepts(r#"root ::= ("a" "b") "c""#, &["abc"], &["ac", "abcc"]);
    accepts(r#"root ::= ("a" | "b") "c""#, &["ac", "bc"], &["c", "abc"]);
}

#[test]
fn end_to_end_case_sensitivity() {
    accepts(r#"root ::= "true""#, &["true"], &["TRUE", "True", "tRuE"]);
}

#[test]
fn end_to_end_character_classes() {
    accepts("root ::= [a-z]", &["a", "q", "z"], &["A", "1", "ab"]);
    accepts("root ::= [^a-z]", &["A", "1", "-"], &["a", "z"]);
    accepts("root ::= [NBKQR]", &["N", "B", "R"], &["a", "C"]);
    accepts("root ::= .", &["a", "1", " ", "\n"], &["ab"]);
}

#[test]
fn end_to_end_repetition() {
    accepts(r#"root ::= "x"*"#, &["", "x", "xxx"], &["y", "xy"]);
    accepts(r#"root ::= "x"+"#, &["x", "xxx"], &["", "y"]);
    accepts(r#"root ::= "a" "b"?"#, &["a", "ab"], &["b", "abb"]);
    accepts(r#"root ::= "x"{3}"#, &["xxx"], &["", "xx", "xxxx"]);
    accepts(r#"root ::= "x"{2,}"#, &["xx", "xxxxx"], &["", "x"]);
    accepts(r#"root ::= "x"{1,3}"#, &["x", "xx", "xxx"], &["", "xxxx"]);
    accepts("root ::= [0-9]+", &["0", "4711"], &["", "a"]);
}

#[test]
fn end_to_end_rule_references_across_productions() {
    accepts(
        "root ::= a b\na ::= \"x\"\nb ::= \"y\"",
        &["xy"],
        &["x", "y", "yx"],
    );
}

#[test]
fn end_to_end_an_empty_alternative() {
    accepts(
        "root ::= ws \"a\"\nws ::= | \" \"",
        &["a", " a"],
        &["  a", "a "],
    );
}

#[test]
fn end_to_end_escaped_literals() {
    accepts(
        r#"root ::= "\t" "\x41" "é""#,
        &["\tA\u{e9}"],
        &["tA\u{e9}", " A\u{e9}"],
    );
}

#[test]
fn returns_a_tagged_node_for_the_start_rule() {
    let parser = compile("root ::= \"a\" item\nitem ::= \"b\" \"c\"");
    let tree = parser.parse("abc").expect("abc parses");
    assert_eq!(
        tree.to_json(),
        json!({
            "rule": "root",
            "src": "abc",
            "kids": [{ "rule": "item", "src": "bc", "kids": [] }],
        })
    );
}

#[test]
fn a_comment_in_the_grammar_changes_nothing_about_the_language() {
    accepts(
        "# a list of one\nroot ::= \"a\"  # just a\n",
        &["a"],
        &["b", ""],
    );
}

// ---- the public surface ----------------------------------------------

#[test]
fn gbnf_installs_the_grammar_on_an_instance() {
    let mut parser = Tabnas::new();
    let spec = gbnf(&mut parser, r#"root ::= "a""#, None).expect("install");
    assert_eq!(spec.options["rule"]["start"], json!("__start__"));
    assert_eq!(
        parser.parse("a").expect("a parses").to_json()["rule"],
        json!("root")
    );
}

#[test]
fn to_spec_compiles_without_installing() {
    let mut parser = Tabnas::new();
    to_spec(r#"root ::= "a""#, None).expect("convert");
    // Nothing was installed, so the instance never learned about `root`.
    assert!(!parser.rule_names().iter().any(|name| "root" == name));
    // And it still has no idea what to do with the input.
    assert!(gbnf(&mut parser, r#"root ::= "a""#, None).is_ok());
}

#[test]
fn to_spec_and_gbnf_convert_are_the_same_conversion() {
    let left = to_spec(r#"root ::= "a""#, None).expect("to_spec");
    let right = gbnf_convert(r#"root ::= "a""#, None).expect("gbnf_convert");
    let names =
        |spec: &tabnas_gbnf::GrammarSpec| -> Vec<String> { spec.rule.keys().cloned().collect() };
    assert_eq!(names(&left), names(&right));
}

#[test]
fn the_plugin_installs_the_source_it_is_given() {
    let mut parser = Tabnas::new();
    let options = serde_json::json!({ "src": "root ::= \"hi\"" });
    parser
        .use_plugin(plugin(), Some(tabnas::Value::from_json(&options)))
        .expect("the plugin installs");
    assert!(parser.parse("hi").is_ok());
    assert!(parser.parse("HI").is_err());
}

#[test]
fn the_plugin_with_no_source_installs_nothing() {
    let mut parser = Tabnas::new();
    parser.use_plugin(plugin(), None).expect("a bare install");
    assert!(!parser.rule_names().iter().any(|name| "root" == name));
}

#[test]
fn the_meta_grammar_is_available_as_data() {
    let rules = tabnas_gbnf::gbnf_rules();
    let names: Vec<&String> = rules.as_object().expect("a rule map").keys().collect();
    assert_eq!(names, ["gbnf", "prod", "alts", "seq", "elem", "atom"]);
}

#[test]
fn diagnostics_say_gbnf() {
    // A purely left-recursive rule is the shared compiler's refusal, and
    // it is restamped so a caller sees one error vocabulary.
    let error = convert(r#"root ::= root "x""#).expect_err("left recursion is refused");
    assert!(error.to_string().starts_with("gbnf: "), "{error}");
    assert_eq!(error.rule(), Some("root"));
}
