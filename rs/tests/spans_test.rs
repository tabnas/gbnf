// Source spans. The front-end records where each element and production
// came from, so a compile failure carries a range and a tool can
// underline the offending text. The Rust port of the `source spans`
// block in `ts/test/gbnf.test.js` and of `go/spans_test.go`.
//
// Every assertion slices the ORIGINAL SOURCE with the span and compares
// the TEXT. That is the only check worth making: an offset pair that is
// self-consistent but points at the wrong characters would satisfy any
// assertion about the numbers themselves. It is also what makes the
// cases portable, because the unit a span counts is the engine's own,
// and it differs between runtimes (see DIVERGENCE.md).

mod common;

use tabnas_bnf::{Kind, Production, SrcSpan};
use tabnas_gbnf::{gbnf_convert, parse_gbnf, GbnfError, Grammar};

const SRC: &str = concat!(
    "root ::= item\n",
    "item ::= \"hi\" | [a-z] | . | ref | (alt | two)\n",
    "ref ::= \"r\"\n",
    "alt ::= \"a\"\n",
    "two ::= \"b\"",
);

fn grammar() -> Grammar {
    parse_gbnf(SRC).expect("the span source parses")
}

fn text(span: Option<&SrcSpan>) -> &'static str {
    let span = span.expect("expected a span");
    &SRC[span.s..span.e]
}

fn production(name: &str) -> Production {
    grammar()
        .productions
        .into_iter()
        .find(|production| name == production.name)
        .unwrap_or_else(|| panic!("no production {name}"))
}

#[test]
fn spans_a_production_with_its_name() {
    let item = production("item");
    assert_eq!(text(item.sp.as_ref()), "item");
    let span = item.sp.expect("a span");
    assert_eq!(span.r, Some(2), "row is 1-based, as the engine reports");
    assert_eq!(span.c, Some(1));
}

#[test]
fn spans_literals_classes_the_any_char_dot_and_references() {
    let alts = production("item").alts;
    for (index, want) in [(0, "\"hi\""), (1, "[a-z]"), (2, "."), (3, "ref")] {
        assert_eq!(text(alts[index][0].sp.as_ref()), want, "alt {index}");
    }
}

#[test]
fn spans_a_group_from_its_opening_paren_to_its_closing_one() {
    let group = production("item").alts[4][0].clone();
    let Kind::Group { alts } = &group.kind else {
        panic!("expected a group, got {:?}", group.kind);
    };
    assert_eq!(text(group.sp.as_ref()), "(alt | two)");
    assert_eq!(text(alts[0][0].sp.as_ref()), "alt");
    assert_eq!(text(alts[1][0].sp.as_ref()), "two");
}

#[test]
fn reports_a_row_and_column_that_agree_with_the_offset() {
    // A span whose offset and row or column disagree is worse than no
    // span: a consumer picking either one gets a different answer.
    for production in grammar().productions {
        let Some(span) = production.sp else {
            continue;
        };
        let before = &SRC[..span.s];
        let row = before.matches('\n').count() + 1;
        let column = before.len() - before.rfind('\n').map_or(0, |at| at + 1) + 1;
        assert_eq!(span.r, Some(row), "{}: row disagrees", production.name);
        assert_eq!(
            span.c,
            Some(column),
            "{}: column disagrees",
            production.name
        );
    }
}

#[test]
fn ranges_the_tokenizer_token_rejection() {
    // `<tok>` is not part of the IR: the syntax layer builds it so a
    // grammar containing one is not a *syntax* error, and validation then
    // rejects it by name. Carrying a span on it is what lets that
    // rejection point at the offending text rather than only naming the
    // rule, and it is the diagnostic GBNF authors hit most.
    let src = "root ::= item\nitem ::= \"a\" | <tok>";
    let error = parse_gbnf(src).expect_err("a tokenizer terminal is refused");
    assert_eq!(error.name(), "GbnfCompileError");
    assert_eq!(error.rule(), Some("item"));
    let span = error
        .span()
        .expect("the tokterm rejection carried no range");
    assert_eq!(&src[span.s..span.e], "<tok>");
}

#[test]
fn gives_a_compile_failure_a_range_that_underlines_the_offender() {
    let src = "root ::= item\nitem ::= missing";
    let error = gbnf_convert(src, None).expect_err("an undefined reference is refused");
    let span = error.span().expect("compile failure carried no range");
    assert_eq!(&src[span.s..span.e], "missing");
    assert_eq!(span.r, Some(2));
}

#[test]
fn gives_the_shared_compiler_s_own_refusal_a_range_too() {
    // The purely-left-recursive rejection is the shared compiler's, and
    // it carries the production's span through the restamped diagnostic.
    let src = r#"root ::= root "x""#;
    let error = gbnf_convert(src, None).expect_err("left recursion is refused");
    assert!(matches!(error, GbnfError::Emit(_)), "{error:?}");
    let span = error.span().expect("the emit failure carried no range");
    assert_eq!(&src[span.s..span.e], "root");
}

#[test]
fn does_not_change_the_grammar_a_spanned_parse_compiles_to() {
    let src = "root ::= item\nitem ::= \"hi\" | (a | b)\na ::= \"x\"\nb ::= \"y\"";
    let spec = gbnf_convert(src, None).expect("convert");
    let rules = serde_json::to_string(
        &spec
            .rule
            .iter()
            .map(|(name, rule)| {
                (
                    name.clone(),
                    rule.as_ref()
                        .map(|rule| rule.to_value())
                        .unwrap_or_default(),
                )
            })
            .collect::<serde_json::Map<String, serde_json::Value>>(),
    )
    .expect("the rule block serializes");
    assert!(
        !rules.contains("\"sp\""),
        "a span reached the emitted grammar:\n{rules}"
    );
}

#[test]
fn a_span_slices_the_source_even_where_the_units_are_not_utf16() {
    // This engine counts BYTES where the canonical runtime counts UTF-16
    // code units, which DIVERGENCE.md records. Slicing the original
    // source with the span gives the same TEXT in every runtime, which is
    // what a consumer wants, and this is the case that says so.
    let src = "root ::= a\na ::= \"\u{e9}\u{e9}\"\nb ::= \"x\"\n";
    let grammar = parse_gbnf(src).expect("parse");
    let last = grammar.productions.last().expect("three productions");
    let span = last.sp.as_ref().expect("a span");
    assert_eq!(&src[span.s..span.e], "b");
    assert_eq!(span.r, Some(3));
    assert_eq!(span.c, Some(1));
}
