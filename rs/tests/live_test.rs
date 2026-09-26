// The live corpus: schema-generated GBNF, the kind tools actually emit.
// The Rust port of `ts/test/live.test.js` and of `TestLiveCorpusCompiles`
// in `go/gbnf_test.go`.
//
// `test/live/json-schema-corpus.json` holds the 77 expected outputs of
// llama.cpp's JSON-schema-to-grammar converter (see the README there for
// provenance). Two claims are graded:
//
//   1. EVERY case compiles to a GrammarSpec.
//   2. EVERY case is sampled in BOTH directions: valid JSON per the
//      source schema parses, and near-miss invalid JSON does not.
//      Samples are read off the grammar text, which is stricter than
//      intuition in places (the `time` format requires a zone suffix,
//      and optional properties admit only the schema's declared order).
//      Where the emitted grammar and the schema's intent part company,
//      the GRAMMAR is what is sampled: this suite grades fidelity to the
//      bytes a sampler would be fed, not to the schema behind them.
//
// The sample table is the one `ts/test/live.test.js` carries, case for
// case and string for string.

mod common;

use common::{compile, live_corpus, one_line};

/// Hand-written samples per case name: `yes` must parse, `no` must not.
/// The census cases below pin that every corpus case appears here with
/// both directions non-empty.
const SAMPLES: &[(&str, &[&str], &[&str])] = &[
    (
        "min 0",
        &["0", "5", "12", "9007199254740991"],
        &["-1", "00", ""],
    ),
    (
        "min 1",
        &["1", "9", "42"],
        &["0", "-1", "01"],
    ),
    (
        "min 3",
        &["3", "10", "29"],
        &["2", "-3"],
    ),
    (
        "min 9",
        &["9", "10", "89"],
        &["8", "0"],
    ),
    (
        "min 10",
        &["10", "19", "99"],
        &["9", "1"],
    ),
    (
        "min 25",
        &["25", "100", "999"],
        &["24", "0"],
    ),
    (
        "max 30",
        &["30", "29", "0", "-5"],
        &["31", "300"],
    ),
    (
        "min -5",
        &["-5", "-1", "0", "7"],
        &["-6", "-50"],
    ),
    (
        "min -123",
        &["-123", "-99", "0", "5"],
        &["-124", "-1234"],
    ),
    (
        "max -5",
        &["-5", "-99", "-123"],
        &["-4", "0", "5"],
    ),
    (
        "max 1",
        &["1", "0", "-7"],
        &["2", "10"],
    ),
    (
        "max 100",
        &["100", "99", "0", "-12"],
        &["101", "200"],
    ),
    (
        "min -123 max 42",
        &["-123", "-1", "0", "42"],
        &["-124", "43"],
    ),
    (
        "min 0 max 23",
        &["0", "9", "23"],
        &["24", "-1"],
    ),
    (
        "min 15 max 300",
        &["15", "99", "123", "300"],
        &["14", "301"],
    ),
    (
        "min 5 max 30",
        &["5", "9", "10", "30"],
        &["4", "31"],
    ),
    (
        "min -10 max 10",
        &["-10", "-9", "0", "9", "10"],
        &["-11", "11"],
    ),
    (
        "string",
        &["\"a\"", "\"\"", "\"hello world\""],
        &["\"a", "a\""],
    ),
    (
        "string w/ min length 1",
        &["\"a\"", "\"ab\""],
        &["\"\""],
    ),
    (
        "string w/ min length 3",
        &["\"abc\"", "\"abcd\""],
        &["\"ab\"", "\"\""],
    ),
    (
        "string w/ max length",
        &["\"\"", "\"abc\""],
        &["\"abcd\""],
    ),
    (
        "string w/ min & max length",
        &["\"a\"", "\"abcd\""],
        &["\"\"", "\"abcde\""],
    ),
    (
        "boolean",
        &["true", "false"],
        &["null", "1"],
    ),
    (
        "integer",
        &["0", "-5", "123"],
        &["1.5", "\"1\""],
    ),
    (
        "string const",
        &["\"foo\""],
        &["\"bar\""],
    ),
    (
        "non-string const",
        &["123"],
        &["124", "\"123\""],
    ),
    (
        "non-string enum",
        &["\"red\"", "\"amber\"", "\"green\"", "null", "42", "[\"foo\"]"],
        &["\"blue\""],
    ),
    (
        "string array",
        &["[]", "[\"a\"]", "[\"a\", \"b\"]", "[ ]"],
        &["[", "[\"a\",]"],
    ),
    (
        "nullable string array",
        &["null", "[]", "[\"a\", \"b\"]"],
        &["\"a\"", "[null]"],
    ),
    (
        "tuple1",
        &["[\"a\"]"],
        &["[]"],
    ),
    (
        "tuple2",
        &["[\"a\", 1]", "[\"a\", -1.5e3]"],
        &["[\"a\"]"],
    ),
    (
        "number",
        &["0", "-1.5", "1e9", "1.25e-7"],
        &[".5", "\"x\""],
    ),
    (
        "minItems",
        &["[true, false]", "[true, false, true]"],
        &["[]", "[true]"],
    ),
    (
        "maxItems 0",
        &["[]", "[ ]"],
        &["[true]"],
    ),
    (
        "maxItems 1",
        &["[]", "[true]"],
        &["[true, false]"],
    ),
    (
        "maxItems 2",
        &["[]", "[true]", "[true, false]"],
        &["[true, false, true]"],
    ),
    (
        "min + maxItems",
        &["[1, 2, 3]", "[1.5, -2, 3, 4, 5]"],
        &["[1, 2]", "[1, 2, 3, 4, 5, 6]"],
    ),
    (
        "min + max items with min + max values across zero",
        &["[-12, 0, 207]", "[1, 2, 3, 4]"],
        &["[-13, 0, 5]", "[1, 2]"],
    ),
    (
        "min + max items with min + max values",
        &["[12, 99, 207]", "[100, 20, 13, 14]"],
        &["[11, 12, 13]", "[12, 13]"],
    ),
    // Since b11200 an empty `items` schema admits any value, not only an
    // object, so a scalar item is inside the language.
    (
        "array with empty items",
        &["[]", "[{}]", "[{\"a\": 1}, {}]", "[1, \"a\", true, null, [2]]"],
        &["[1,]", "{}"],
    ),
    (
        "array with empty items and prefixItems",
        &["[]", "[{}]", "[true, \"a\"]"],
        &["[true,]", "{}"],
    ),
    (
        "simple regexp",
        &["\"abefgkl\"", "\"abcddefggghijkl\""],
        &["\"ab\""],
    ),
    (
        "regexp quote",
        &["\"\"\""],
        &["\"\"", "\"a\""],
    ),
    (
        "regexp escapes",
        &["\"[]{}()|+*?\""],
        &["\"[]{}()|+*\""],
    ),
    (
        "regexp with top-level alternation",
        &["\"A\"", "\"D\""],
        &["\"E\"", "\"AB\""],
    ),
    (
        "regexp",
        &["\"(123)456-7890 aaand...\"", "\"456-7890 aaaaand...\""],
        &["\"456-7890 aand...\"", "\"45-7890 aaand...\""],
    ),
    (
        "required props in original order",
        &["{\"b\": \"x\", \"c\": \"y\", \"a\": \"z\"}"],
        &["{\"a\": \"z\"}"],
    ),
    (
        "1 optional prop",
        &["{}", "{\"a\": \"x\"}"],
        &["{\"a\": 1}", "{\"b\": \"x\"}"],
    ),
    (
        "N optional props",
        &["{}", "{\"a\": \"x\"}", "{\"b\": \"x\"}", "{\"c\": \"x\"}", "{\"a\": \"1\", \"b\": \"2\"}", "{\"a\": \"1\", \"b\": \"2\", \"c\": \"3\"}", "{\"b\": \"2\", \"c\": \"3\"}", "{\"a\": \"1\", \"c\": \"3\"}"],
        &["{\"c\": \"3\", \"a\": \"1\"}"],
    ),
    (
        "required + optional props each in original order",
        &["{\"b\": \"1\", \"a\": \"2\", \"d\": \"3\"}", "{\"b\": \"1\", \"a\": \"2\", \"d\": \"3\", \"c\": \"x\"}", "{\"b\": \"1\", \"a\": \"2\", \"c\": \"x\"}"],
        &["{\"b\": \"1\", \"a\": \"2\", \"c\": \"x\", \"d\": \"3\"}"],
    ),
    (
        "anyOf",
        &["{\"a\": 1}", "{\"b\": 2}", "{}"],
        &["{\"a\": 1, \"b\": 2}", "{\"c\": 1}"],
    ),
    (
        "anyOf $ref",
        &["{}", "{\"a\": \"x\"}", "{\"a\": 1.5}", "{\"b\": true}", "{\"a\": \"x\", \"b\": \"y\"}"],
        &["{\"b\": 1}"],
    ),
    (
        "allOf with multiple enum schemas",
        &["\"b\"", "\"c\""],
        &["\"a\""],
    ),
    (
        "allOf with enum schema",
        &["\"a\"", "\"b\""],
        &["\"c\"", "\"ab\""],
    ),
    (
        "mix of allOf, anyOf and $ref (similar to https://json.schemastore.org/tsconfig.json)",
        &["{\"a\": 1, \"b\": 2}", "{\"a\": 1, \"b\": 2, \"d\": 3}", "{\"a\": 1, \"b\": 2, \"d\": 3, \"c\": 4}", "{\"a\": 1, \"b\": 2, \"c\": 4}"],
        &["{\"a\": 1}", "{\"a\": 1, \"b\": 2, \"c\": 4, \"d\": 3}"],
    ),
    (
        "top-level $ref",
        &["{\"a\": \"x\"}"],
        &["{}"],
    ),
    (
        "conflicting names",
        &["{\"number\": {\"number\": {\"root\": 1}}}"],
        &["{\"number\": {\"number\": {\"root\": \"x\"}}}", "{}"],
    ),
    (
        "exotic formats",
        &["[\"2024-01-31\", \"01234567-89ab-cdef-0123-456789abcdef\", \"12:34:56Z\", \"2024-01-31T12:34:56+01:00\"]"],
        &["[\"2024-01-31\", \"01234567-89ab-cdef-0123-456789abcdef\", \"12:34:56\", \"2024-01-31T12:34:56+01:00\"]", "[\"2024-13-01\", \"01234567-89ab-cdef-0123-456789abcdef\", \"12:34:56Z\", \"2024-01-31T12:34:56+01:00\"]"],
    ),
    (
        "literal string with escapes",
        &["{\"code\": \" \\r \\n \\\" \\\\ \"}"],
        &["{\"code\": \"x\"}"],
    ),
    (
        "additional props",
        &["{}", "{\"x\": [1, 2]}"],
        &["{\"x\": 1}", "{\"x\": [\"a\"]}"],
    ),
    (
        "additional props (true)",
        &["{}", "{\"any\": [1, {\"k\": \"v\"}]}"],
        &["[]", "{\"a\"}"],
    ),
    (
        "additional props (implicit)",
        &["{}", "{\"x\": null}"],
        &["[]"],
    ),
    (
        "required + additional props",
        &["{\"a\": 1}", "{\"a\": 1, \"b\": \"x\"}"],
        &["{}", "{\"b\": \"x\"}"],
    ),
    (
        "optional + additional props",
        &["{}", "{\"a\": 1}", "{\"a\": 1, \"b\": 2}", "{\"b\": 2}"],
        &["{\"b\": \"x\"}"],
    ),
    (
        "required + optional + additional props",
        &["{\"and\": 1}", "{\"and\": 1, \"also\": 2}", "{\"and\": 1, \"x\": 3}"],
        &["{}", "{\"also\": 2}"],
    ),
    (
        "optional props with empty name",
        &["7", "-3"],
        &["{}", "{\"\": 1}"],
    ),
    (
        "optional props with nested names",
        &["{}", "{\"a\": 1}", "{\"a\": 1, \"aa\": 2}", "{\"aa\": 2}", "{\"a\": 1, \"aa\": 2, \"ab\": 3}"],
        &["{\"aa\": 2, \"a\": 1}"],
    ),
    (
        "optional props with common prefix",
        &["{}", "{\"ab\": 1}", "{\"ab\": 1, \"ac\": 2}", "{\"ac\": 2}"],
        &["{\"ac\": 2, \"ab\": 1}"],
    ),
    (
        "empty w/o additional props",
        &["{}"],
        &["{\"a\": 1}"],
    ),
    (
        "description only (no type) treated as unconstrained",
        &["null", "true", "-1.5e3", "\"x\"", "[1, \"a\"]", "{\"k\": null}"],
        &["nul", "{"],
    ),
    // Added with the b11200 refresh, all string patterns. Where the
    // converter cannot express a pattern (an unanchored one, the `\w`
    // shorthand, a lookahead) it falls back to any string, and it is that
    // grammar, as everywhere here, that is sampled.
    (
        "regexp with non-capturing group",
        &["\"foobaz\"", "\"barbaz\""],
        &["\"baz\"", "\"foobar\"", "foobaz"],
    ),
    (
        "regexp with nested non-capturing groups",
        &["\"d\"", "\"abcd\"", "\"ababcd\""],
        &["\"cd\"", "\"abd\"", "\"abc\"", "\"\""],
    ),
    (
        "unanchored regexp",
        &["\"123\"", "\"no digits\"", "\"\""],
        &["123", "\"unterminated"],
    ),
    (
        "regexp with unsupported shorthand",
        &["\"123a\"", "\"anything\""],
        &["123", "\"\\q\""],
    ),
    (
        "regexp with escaped hyphen in a character class",
        &["\"a-b\"", "\"-\"", "\"abc\""],
        &["\"\"", "\"A\"", "\"a_b\""],
    ),
    (
        "regexp with escaped hyphen outside a character class",
        &["\"a-b\""],
        &["\"ab\"", "\"a\\-b\"", "\"a-bc\""],
    ),
    (
        "unsupported regexp in a property",
        &["{\"a\": \"a\"}", "{\"a\": \"anything\"}", "{ \"a\" : \"\" }"],
        &["{}", "{\"b\": \"a\"}", "{\"a\": 1}"],
    ),
];

/// The corpus cases, as (name, grammar) pairs, in file order.
fn cases() -> Vec<(String, String)> {
    let corpus = live_corpus();
    corpus["cases"]
        .as_array()
        .expect("the corpus has a cases array")
        .iter()
        .map(|case| {
            (
                case["name"].as_str().unwrap_or_default().to_string(),
                case["grammar"].as_str().unwrap_or_default().to_string(),
            )
        })
        .collect()
}

#[test]
fn every_live_case_compiles() {
    let mut wrong: Vec<String> = Vec::new();
    for (name, grammar) in cases() {
        match common::convert(&grammar) {
            Ok(spec) => {
                if !spec.rule.contains_key("root") {
                    wrong.push(format!("{name:?} compiled without a root rule"));
                }
            }
            Err(error) => wrong.push(format!("{name:?} failed to compile: {error}")),
        }
    }
    assert!(wrong.is_empty(), "\n  {}", wrong.join("\n  "));
}

#[test]
fn every_live_case_parses_its_samples_in_both_directions() {
    let mut wrong: Vec<String> = Vec::new();
    for (name, grammar) in cases() {
        let Some((_, yes, no)) = SAMPLES.iter().find(|(sampled, _, _)| *sampled == name) else {
            continue;
        };
        let parser = compile(&grammar);
        for sample in *yes {
            if let Err(error) = parser.parse(sample) {
                wrong.push(format!(
                    "{name:?} rejected its sample {sample:?}: {}",
                    one_line(&error.to_string())
                ));
            }
        }
        for sample in *no {
            if parser.parse(sample).is_ok() {
                wrong.push(format!(
                    "{name:?} accepted {sample:?}, which is outside its language"
                ));
            }
        }
    }
    assert!(wrong.is_empty(), "\n  {}", wrong.join("\n  "));
}

#[test]
fn the_live_corpus_is_exactly_the_seventy_seven_cases_on_record() {
    // The census is pinned, the way corpus_test.rs pins its grammar list.
    // Both loops above iterate the corpus, so a case quietly vanishing
    // from the JSON would leave the suite green while shrinking the
    // coverage this file's headline number claims. The uniqueness half
    // catches a duplicated name, which would otherwise hold the count at
    // seventy-seven while losing a case.
    let cases = cases();
    assert_eq!(cases.len(), 77);
    let names: std::collections::BTreeSet<&str> =
        cases.iter().map(|(name, _)| name.as_str()).collect();
    assert_eq!(names.len(), 77);
}

#[test]
fn every_sampled_case_exists_in_the_corpus() {
    let cases = cases();
    let names: std::collections::BTreeSet<&str> =
        cases.iter().map(|(name, _)| name.as_str()).collect();
    let missing: Vec<&str> = SAMPLES
        .iter()
        .map(|(name, _, _)| *name)
        .filter(|name| !names.contains(name))
        .collect();
    assert!(missing.is_empty(), "not in the corpus: {missing:?}");
}

#[test]
fn every_corpus_case_is_sampled_in_both_directions() {
    let mut holes: Vec<String> = Vec::new();
    for (name, _) in cases() {
        match SAMPLES.iter().find(|(sampled, _, _)| *sampled == name) {
            None => holes.push(format!("{name:?} has no samples")),
            Some((_, [], _)) => holes.push(format!("{name:?} has no yes samples")),
            Some((_, _, [])) => holes.push(format!("{name:?} has no no samples")),
            Some(_) => {}
        }
    }
    assert!(holes.is_empty(), "\n  {}", holes.join("\n  "));
}
