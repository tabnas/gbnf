// The llama.cpp conformance corpus. The Rust port of
// `ts/test/corpus.test.js` and of the corpus block in `go/gbnf_test.go`.
//
// `test/corpus/*.gbnf` holds llama.cpp's own grammars, verbatim (see the
// README there for provenance). Three claims are graded:
//
//   1. EVERY grammar compiles to a GrammarSpec. This is the corpus's
//      primary job: it is what proves the front-end reads real GBNF, not
//      a tidied dialect of it.
//   2. The ACCEPT samples parse, and the REJECT samples do not. Both
//      directions matter: a validator that accepts everything is not
//      validating. Expectations are read off the grammar text itself
//      (c.gbnf's `ws` is `[ \t\n]+`, so `int x=1;` really is outside its
//      language; json_arr's separator is literally `",\n"`).
//   3. The EXPECTED_FAILURES fail, exactly as recorded.
//
// The samples are the ones `ts/test/corpus.test.js` grades, character
// for character. Never narrow a case to make it green, and an expected
// failure that starts passing is red too: update
// `ts/doc/known-gaps.md`, do not delete the case.

mod common;

use common::{compile, corpus_dir, load, one_line};

/// Every file in the corpus, named explicitly. A glob would let a deleted
/// grammar pass unnoticed; the census is the point.
const GRAMMARS: [&str; 8] = [
    "arithmetic",
    "c",
    "chess",
    "english",
    "japanese",
    "json",
    "json_arr",
    "list",
];

/// Samples that must parse. Kept small and real: each is text the grammar
/// is meant to constrain a model into producing.
const ACCEPT: &[(&str, &[&str])] = &[
    (
        "arithmetic",
        &[
            "a=b\n",
            "x = 1\n",
            "a = b\n",
            "a=b\nc=d\n",
            // operators live in the left-hand-side expression
            "a+b=c\n",
            "long_name/3 = x\n",
            "(b+c)*d = x\n",
            "a=1\nb=2\nc=3\n",
            // ident's trailing whitespace eats the first newline
            "a=b\n\n",
        ],
    ),
    (
        "c",
        &[
            "int a(){}",
            "float b(){}",
            "char c(){}",
            "int a(){//x\n}",
            "int a(){int x = 1;}",
            "int f(){//c1\n//c2\n}",
            "int f(int y){while(x<1){x = x+1;}}",
            "int f(){return x;}",
            "int f(){return 1;}",
            "int f(){for(x = 1; x<9; x = x+1){}}",
            "int f(){if(x<1){}}",
            "int f(){if(x<1){}else{}}",
            // funcCall statement: whitespace before "("
            "int f(){f (1);}",
            // funcCall expression: no whitespace needed
            "int f(){x = g(1);}",
            "int f(){/*m*/}",
            // keyword-prefixed identifiers
            "int intx(){intx = 3;}",
            "int whilex(){whilex = 1;}",
        ],
    ),
    (
        "chess",
        &[
            "1. e4 e5\n2. e4 e5\n",
            "1. e4 e5\n2. O-O e5\n",
            "1. e4 e5\n10. exd5 e5\n",
            // piece capture: "x" disambiguates
            "1. e4 e5\n2. Nxe4 d5\n",
            // promotion, check marker
            "1. e4 e5\n2. e8=Q e4+\n",
            "1. e4 e5\n2. O-O-O d5\n10. a1 h8\n",
        ],
    ),
    ("english", &["Hello, world!", "a b c", "(x)", "one\ntwo"]),
    // japanese.gbnf's classes are pairwise disjoint and it has no string
    // literals, so its class tokens are lexed eagerly, which is what lets
    // `jp-char+ ([ \t\n] jp-char+)*` cross the space.
    (
        "japanese",
        &[
            "\u{3053}\u{3093}\u{306b}\u{3061}\u{306f}",
            "\u{30a2}",
            "\u{4e00}",
            "\u{3001}",
            "\u{3053}\u{3093} \u{306b}\u{3061}\u{306f}",
            "\u{30a2}\u{4e00}",
            "\u{3053}\u{3093}\n\u{306b}\u{3061}\u{306f}",
        ],
    ),
    (
        "json",
        &[
            "{}",
            "{ }",
            "{\n}",
            "{\"a\":1}",
            "{ \"a\" : 1 }",
            "{\"a\":\"b\"}",
            "{\"a\":[1,2]}",
            "{\"a\":{\"b\":true}}",
            "{\"s\":\"\\n\"}",
            "{\"s\":\"\\u0041\"}",
            "{\"a\":1,\"b\":2}",
            "{\"a\":null}",
            "{\"a\":-1.5e3}",
            "{\"a\":[{\"b\":[]}]}",
        ],
    ),
    (
        "json_arr",
        &[
            "[\n]",
            "[\n ]",
            "[\n1,\n2]",
            "[\n1,\n2\n]",
            "[\n\"a\",\n{\"b\": 1}]",
        ],
    ),
    (
        "list",
        &["- a\n", "- hello\n- world\n", "- hello\n- world\n- x\n"],
    ),
];

/// Samples that must NOT parse: each is just outside its grammar's
/// language, usually by one character. These pin the validator half of
/// the product, so the grammars above are read literally and c.gbnf's
/// mandatory whitespace around `=` and json_arr's exact `",\n"`
/// separator are enforced, not smoothed over.
const REJECT: &[(&str, &[&str])] = &[
    (
        "arithmetic",
        &[
            "a=b",
            "a=\n",
            "=b\n",
            "A=b\n",
            // the right-hand side of `=` is a bare term
            "a=b+c\n",
            "x1 = long_name / 3\n",
        ],
    ),
    (
        "c",
        &[
            "int a(){",
            "int (){}",
            "a(){}",
            // whitespace around `=` is mandatory
            "int a(){int x=1;}",
            // funcCall statement without whitespace
            "int f(){f(1);}",
        ],
    ),
    ("chess", &["1. e4\n", "e4 e5\n", "1. e4 e5\n2. i4 e5\n"]),
    (
        "english",
        &["\u{3053}\u{3093}\u{306b}\u{3061}\u{306f}", "a\n"],
    ),
    (
        "japanese",
        &["abc", "\u{3053}\u{3093}\u{306b}\u{3061}\u{306f}\n"],
    ),
    (
        "json",
        &["{", "{\"a\"}", "{\"a\":}", "{a:1}", "{\"a\":1,}", "[1]"],
    ),
    ("json_arr", &["[", "[]", "[\n1, 2\n]"]),
    ("list", &["a\n", "- a", "-a\n"]),
];

/// The one shape still out of reach, asserted as FAILING so this suite
/// notices the day it is not. See `ts/doc/known-gaps.md` section 3.
const EXPECTED_FAILURES: &[(&str, &str, &str)] = &[(
    "chess",
    "1. e4 e5\n2. Nf3 e5\n",
    "stacked optional prefixes: [a-h]? greedily takes the f that [a-h] needs",
)];

#[test]
fn every_corpus_grammar_compiles() {
    let mut wrong: Vec<String> = Vec::new();
    for name in GRAMMARS {
        match common::convert(&load(name)) {
            Ok(spec) => {
                if !spec.rule.contains_key("root") {
                    wrong.push(format!("{name}.gbnf compiled without a root rule"));
                }
                if spec.options["rule"]["start"] != serde_json::json!("__start__") {
                    wrong.push(format!("{name}.gbnf has no __start__ wrapper"));
                }
                if spec.rule.is_empty() {
                    wrong.push(format!("{name}.gbnf compiled to an empty spec"));
                }
            }
            Err(error) => wrong.push(format!("{name}.gbnf failed to compile: {error}")),
        }
    }
    assert!(wrong.is_empty(), "\n  {}", wrong.join("\n  "));
}

#[test]
fn every_accept_sample_parses() {
    let mut wrong: Vec<String> = Vec::new();
    for (name, samples) in ACCEPT {
        let parser = compile(&load(name));
        for sample in *samples {
            if let Err(error) = parser.parse(sample) {
                wrong.push(format!(
                    "{name}.gbnf rejected its own sample {sample:?}: {}",
                    one_line(&error.to_string())
                ));
            }
        }
    }
    assert!(wrong.is_empty(), "\n  {}", wrong.join("\n  "));
}

#[test]
fn every_reject_sample_is_refused() {
    // The direction that matters just as much: a validator that accepts
    // everything is not validating.
    let mut wrong: Vec<String> = Vec::new();
    for (name, samples) in REJECT {
        let parser = compile(&load(name));
        for sample in *samples {
            if parser.parse(sample).is_ok() {
                wrong.push(format!(
                    "{name}.gbnf accepted {sample:?}, which is outside its language"
                ));
            }
        }
    }
    assert!(wrong.is_empty(), "\n  {}", wrong.join("\n  "));
}

#[test]
fn the_known_gaps_are_still_gaps() {
    for (name, sample, why) in EXPECTED_FAILURES {
        let parser = compile(&load(name));
        assert!(
            parser.parse(sample).is_err(),
            "{name}.gbnf now accepts {sample:?}. That is good news, and it means \
             ts/doc/known-gaps.md (\"{why}\") is out of date: update the document and \
             move this case into ACCEPT."
        );
    }
}

#[test]
fn the_corpus_on_disk_is_exactly_the_census() {
    let mut found: Vec<String> = std::fs::read_dir(corpus_dir())
        .expect("the corpus directory is readable")
        .filter_map(|entry| {
            let name = entry.ok()?.file_name().to_string_lossy().into_owned();
            name.strip_suffix(".gbnf").map(str::to_string)
        })
        .collect();
    found.sort();
    let mut want: Vec<String> = GRAMMARS.iter().map(|name| name.to_string()).collect();
    want.sort();
    assert_eq!(found, want);
}

#[test]
fn every_census_grammar_is_sampled_in_both_directions() {
    // A grammar with no reject samples asserts nothing about what it
    // excludes, and one with no accept samples says nothing about its
    // language at all. This pin is what keeps a future corpus addition
    // from quietly shipping compile-only.
    let mut holes: Vec<String> = Vec::new();
    for name in GRAMMARS {
        let accept = ACCEPT
            .iter()
            .find(|(sampled, _)| *sampled == name)
            .map_or(0, |(_, samples)| samples.len());
        let reject = REJECT
            .iter()
            .find(|(sampled, _)| *sampled == name)
            .map_or(0, |(_, samples)| samples.len());
        if 0 == accept {
            holes.push(format!("{name}.gbnf has no accept samples"));
        }
        if 0 == reject {
            holes.push(format!("{name}.gbnf has no reject samples"));
        }
    }
    assert!(holes.is_empty(), "\n  {}", holes.join("\n  "));
}
