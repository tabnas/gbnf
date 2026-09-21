// Shared test helpers. Cargo compiles this module into EVERY integration
// test binary, so an item only one binary uses is dead code in the
// others; the allow keeps that from being a warning rather than hiding
// anything real.
#![allow(dead_code)]

use std::path::{Path, PathBuf};

use serde_json::Value as Json;
use tabnas::Tabnas;
use tabnas_gbnf::{gbnf, gbnf_convert, parse_gbnf, GbnfConvertOptions, GbnfError, Grammar};

/// The repository root, one level above this crate.
pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("rs/ has a parent")
        .to_path_buf()
}

/// The llama.cpp conformance corpus, committed verbatim.
pub fn corpus_dir() -> PathBuf {
    repo_root().join("test").join("corpus")
}

/// One corpus grammar's source.
pub fn load(name: &str) -> String {
    std::fs::read_to_string(corpus_dir().join(format!("{name}.gbnf")))
        .unwrap_or_else(|error| panic!("cannot read {name}.gbnf: {error}"))
}

/// The live corpus: the 70 expected outputs of llama.cpp's
/// JSON-schema-to-grammar converter.
pub fn live_corpus() -> Json {
    let path = repo_root()
        .join("test")
        .join("live")
        .join("json-schema-corpus.json");
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read the live corpus: {error}"));
    serde_json::from_str(&raw).expect("the live corpus is JSON")
}

/// An engine carrying only the grammar `src` compiles to.
///
/// A FRESH instance per grammar, exactly as the canonical suite uses
/// `tn.make()`: installing a GBNF grammar also installs its lexer
/// settings, and those are instance-wide.
pub fn compile(src: &str) -> Tabnas {
    compile_with(src, None)
}

/// [`compile`], with explicit conversion options.
pub fn compile_with(src: &str, opts: Option<&GbnfConvertOptions>) -> Tabnas {
    let mut parser = Tabnas::new();
    gbnf(&mut parser, src, opts).unwrap_or_else(|error| panic!("{src}\n  {error}"));
    parser
}

/// Assert a grammar accepts every string in `yes` and rejects every
/// string in `no`.
///
/// Reporting both directions in one message keeps a failure readable:
/// "accepted what it should reject" is as much a bug as the reverse, and
/// a bare `is_err` assertion says neither.
pub fn accepts(src: &str, yes: &[&str], no: &[&str]) {
    accepts_with(src, yes, no, None);
}

/// [`accepts`], with explicit conversion options.
pub fn accepts_with(src: &str, yes: &[&str], no: &[&str], opts: Option<&GbnfConvertOptions>) {
    let parser = compile_with(src, opts);
    let mut wrong: Vec<String> = Vec::new();
    for sample in yes {
        if let Err(error) = parser.parse(sample) {
            wrong.push(format!(
                "should ACCEPT {sample:?}: {}",
                one_line(&error.to_string())
            ));
        }
    }
    for sample in no {
        if parser.parse(sample).is_ok() {
            wrong.push(format!("should REJECT {sample:?}"));
        }
    }
    assert!(wrong.is_empty(), "{src}\n  {}", wrong.join("\n  "));
}

/// An engine diagnostic's first line, with the terminal colouring gone.
pub fn one_line(message: &str) -> String {
    let mut out = String::with_capacity(message.len());
    let chars: Vec<char> = message.chars().collect();
    let mut i = 0usize;
    while i < chars.len() {
        if '\u{1b}' == chars[i] && Some(&'[') == chars.get(i + 1) {
            let mut j = i + 2;
            while j < chars.len() && (chars[j].is_ascii_digit() || ';' == chars[j]) {
                j += 1;
            }
            if j < chars.len() && 'm' == chars[j] {
                i = j + 1;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out.lines().next().unwrap_or_default().to_string()
}

/// Parse GBNF and hand back the IR as JSON with every source span
/// stripped.
///
/// Almost every case compares IR values STRUCTURALLY and has nothing to
/// say about where in the source a node came from, so this is the
/// default view; `spans_test.rs` uses [`parse_gbnf`] directly and asserts
/// positions the only way worth asserting them, by slicing the source and
/// comparing the text.
pub fn ir(src: &str) -> Json {
    no_spans(serde_json::to_value(parse_gbnf(src).expect(src)).expect("the IR serializes"))
}

/// The alternatives of one production, span-free.
pub fn alts(src: &str, index: usize) -> Json {
    ir(src)["productions"][index]["alts"].clone()
}

/// The first element of the first alternative of the first production,
/// span-free.
pub fn first_element(src: &str) -> Json {
    ir(src)["productions"][0]["alts"][0][0].clone()
}

/// Strip every `sp` key from a JSON tree.
pub fn no_spans(value: Json) -> Json {
    match value {
        Json::Array(items) => Json::Array(items.into_iter().map(no_spans).collect()),
        Json::Object(entries) => Json::Object(
            entries
                .into_iter()
                .filter(|(key, _)| "sp" != key)
                .map(|(key, value)| (key, no_spans(value)))
                .collect(),
        ),
        other => other,
    }
}

/// The productions of a grammar as JSON, span-free: what a fixed-point
/// comparison compares.
pub fn productions_json(grammar: &Grammar) -> Json {
    no_spans(serde_json::to_value(&grammar.productions).expect("the IR serializes"))
}

/// Convert with the crate's defaults, for a case that wants the failure
/// rather than the spec.
pub fn convert(src: &str) -> Result<tabnas_gbnf::GrammarSpec, GbnfError> {
    gbnf_convert(src, None)
}

/// The emitted spec's options, as JSON.
pub fn options(src: &str) -> Json {
    Json::Object(convert(src).expect(src).options)
}

/// Every match token's serialized matcher, in order.
pub fn match_tokens(src: &str) -> Vec<String> {
    options(src)
        .get("match")
        .and_then(|matchers| matchers.get("token"))
        .and_then(Json::as_object)
        .map(|tokens| {
            tokens
                .values()
                .map(|value| value.as_str().unwrap_or_default().to_string())
                .collect()
        })
        .unwrap_or_default()
}

/// Whether EVERY match token the grammar emitted is flagged eager. The
/// engine's wire format spells an eager matcher `@~/source/flags` and a
/// gated one `@/source/flags`.
pub fn all_eager(src: &str) -> bool {
    let tokens = match_tokens(src);
    !tokens.is_empty() && tokens.iter().all(|token| token.starts_with("@~/"))
}

/// Whether ANY match token the grammar emitted is flagged eager.
pub fn any_eager(src: &str) -> bool {
    match_tokens(src)
        .iter()
        .any(|token| token.starts_with("@~/"))
}

/// Strip the emitter-injected action references from an alt, so a case
/// can assert the structural shape of a spec without pinning action
/// identities.
pub fn strip_actions(value: &Json) -> Json {
    match value {
        Json::Array(items) => Json::Array(items.iter().map(strip_actions).collect()),
        Json::Object(entries) => Json::Object(
            entries
                .iter()
                .filter(|(key, _)| "a" != key.as_str())
                .map(|(key, value)| (key.clone(), strip_actions(value)))
                .collect(),
        ),
        other => other.clone(),
    }
}

/// The open alternatives of one emitted rule, as JSON with the action
/// references stripped.
pub fn rule_open(src: &str, rule: &str) -> Json {
    let spec = convert(src).expect(src);
    let value = spec
        .rule
        .get(rule)
        .and_then(Option::as_ref)
        .map(|rule| rule.to_value())
        .unwrap_or(Json::Null);
    strip_actions(&value["open"])
}
