// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

//! The llama.cpp GBNF front-end: GBNF text in, the notation-neutral
//! grammar IR that `tabnas-bnf` compiles out, plus the lexer settings the
//! emitted spec has to carry.
//!
//! ```text
//! GBNF text ──parse_gbnf──▶ Grammar ──bnf::emit_grammar_spec──▶ GrammarSpec
//! ```
//!
//! Everything downstream of that IR (repetition desugaring,
//! left-recursion elimination, tail repeats, probe dispatch, literal
//! lifting, token allocation, first-set analysis, chain emission) lives
//! in `tabnas-bnf` and is shared with the ABNF and EBNF front-ends. What
//! stays here is what is genuinely GBNF: the meta-grammar in
//! [`crate::parser_gbnf`], the mandatory `root` start symbol,
//! case-SENSITIVE quoted strings, the character classes and their escape
//! family, postfix repetition, the tokenizer-token terminals that parse
//! and are then refused, and the exact lexing the emitted spec installs.

use std::fmt;

use indexmap::IndexSet;
use serde_json::{json, Map, Value as Json};
use tabnas::Value;
use tabnas_bnf::{Element, Grammar, Kind, Production, SrcSpan};

use crate::parser_gbnf::{parse_gbnf_raw, RawError};

/// A failure to read GBNF source: a syntax error, or a terminal this
/// notation does not have.
///
/// Carries the line and column the engine reported, where it reported
/// any, so a caller can point at the offending text directly. A
/// terminal-decoder refusal carries neither, by contract: its own wording
/// names the offending escape or class, and `ts/test/cli.test.js` pins
/// that the report has no location for one.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct GbnfParseError {
    /// The rendered diagnostic, always prefixed `gbnf: `.
    pub message: String,
    /// The 1-based line, when the underlying failure named one.
    pub line: Option<usize>,
    /// The 1-based column, when the underlying failure named one.
    pub column: Option<usize>,
    /// The engine's own error code, when the failure came from the engine
    /// rather than from this front-end.
    pub code: Option<String>,
}

impl GbnfParseError {
    pub(crate) fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            ..Self::default()
        }
    }
}

impl fmt::Display for GbnfParseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for GbnfParseError {}

/// A source that parses as GBNF but does not describe a grammar this
/// compiler can build: no `root` rule, a reference to a rule that is
/// never defined, or a tokenizer-token terminal.
///
/// `rule` names the production responsible. `sp` is where in the grammar
/// source, when the offending IR node knew: only ever set from a span the
/// front-end recorded, so it is present exactly when there is a real
/// position to point at.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct GbnfCompileError {
    /// The rendered diagnostic, always prefixed `gbnf: `.
    pub message: String,
    /// The production the diagnostic is about.
    pub rule: Option<String>,
    /// The range that underlines the offender.
    pub sp: Option<SrcSpan>,
}

impl GbnfCompileError {
    pub(crate) fn new(message: impl Into<String>, rule: Option<&str>, sp: Option<SrcSpan>) -> Self {
        Self {
            message: message.into(),
            rule: rule.map(str::to_string),
            sp,
        }
    }
}

impl fmt::Display for GbnfCompileError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for GbnfCompileError {}

// ---- parse -----------------------------------------------------------

/// Parse GBNF source into the grammar IR.
///
/// The returned [`Grammar`] is ready for `emit_grammar_spec`: `root` is
/// present, every reference resolves, and no tokenizer terminals remain.
///
/// The order of the checks is part of the contract, and it mirrors the
/// canonical front-end exactly: duplicate definitions collapse, then
/// tokenizer terminals are refused, then the `root` requirement, then
/// undefined references. Validation runs HERE, before `tabnas-bnf` sees
/// the IR, because the shared compiler maps an undefined `TX` / `NR` /
/// `ST` / `VL` reference onto the engine's own lexer tokens: right for
/// ABNF, wrong for GBNF, where those are ordinary rule names.
pub fn parse_gbnf(src: &str) -> Result<Grammar, GbnfError> {
    let raw = match parse_gbnf_raw(src) {
        Ok(parsed) => parsed,
        Err(RawError::Message(message)) => {
            return Err(GbnfParseError::new(message).into());
        }
        // A terminal decoder's own diagnostic, let through rather than
        // wrapped in a second `gbnf: parse error:` prefix.
        Err(RawError::Decode(message)) => {
            return Err(GbnfParseError::new(message).into());
        }
        Err(RawError::Engine(error)) => {
            let line = error.row;
            let column = error.col;
            let location = if 0 != line && 0 != column {
                format!(" at line {line}, column {column}")
            } else {
                String::new()
            };
            let rendered = error.to_string();
            // `split('\n')[0]`, as the canonical takes it: NOT
            // `str::lines`, which would also drop a carriage return the
            // engine quoted out of the source.
            let raw = match rendered.find('\n') {
                Some(at) => &rendered[..at],
                None => rendered.as_str(),
            };
            return Err(GbnfParseError {
                message: format!("gbnf: parse error{location}: {raw}"),
                line: (0 != line).then_some(line),
                column: (0 != column).then_some(column),
                code: Some(error.code.clone()),
            }
            .into());
        }
    };

    if raw.is_empty() {
        return Err(GbnfParseError::new("gbnf: no productions found").into());
    }

    let productions = dedupe_productions(raw);
    reject_token_terminals(&productions)?;
    require_root(&productions)?;
    require_defined_refs(&productions)?;

    let mut typed = Vec::with_capacity(productions.len());
    for production in &productions {
        typed.push(production_from_value(production)?);
    }
    Ok(Grammar::new(typed))
}

/// llama.cpp stores rules in a map keyed by symbol, so a second
/// `name ::= …` REPLACES the first rather than extending it (GBNF has no
/// equivalent of ABNF's `=/`). Keep the last definition, in the position
/// of the first, so rule order, and therefore the emitted spec, stays
/// stable.
fn dedupe_productions(prods: Vec<Value>) -> Vec<Value> {
    let mut order: Vec<String> = Vec::new();
    let mut by_name: indexmap::IndexMap<String, Value> = indexmap::IndexMap::new();
    for production in prods {
        let name = production_name(&production);
        if !by_name.contains_key(&name) {
            order.push(name.clone());
        }
        by_name.insert(name, production);
    }
    order
        .into_iter()
        .filter_map(|name| by_name.shift_remove(&name))
        .collect()
}

/// Walk every element of every alternative of every production, in
/// source order, calling `visit` on each. The walk descends into groups
/// and through repetition wrappers, which is where a tokenizer terminal
/// or an undefined reference can hide.
fn walk_elements(
    prods: &[Value],
    visit: &mut dyn FnMut(&Value, &str) -> Result<(), GbnfError>,
) -> Result<(), GbnfError> {
    fn one(
        element: &Value,
        rule: &str,
        visit: &mut dyn FnMut(&Value, &str) -> Result<(), GbnfError>,
    ) -> Result<(), GbnfError> {
        visit(element, rule)?;
        match field_str(element, "kind").as_deref() {
            Some("group") => {
                if let Some(Value::Array(alts)) = field(element, "alts") {
                    for alt in alts.iter() {
                        if let Value::Array(elements) = alt {
                            for inner in elements.iter() {
                                one(inner, rule, visit)?;
                            }
                        }
                    }
                }
            }
            Some("opt" | "star" | "plus" | "rep") => {
                if let Some(inner) = field(element, "inner") {
                    one(&inner, rule, visit)?;
                }
            }
            _ => {}
        }
        Ok(())
    }

    for production in prods {
        let name = production_name(production);
        if let Some(Value::Array(alts)) = field(production, "alts") {
            for alt in alts.iter() {
                if let Value::Array(elements) = alt {
                    for element in elements.iter() {
                        one(element, &name, visit)?;
                    }
                }
            }
        }
    }
    Ok(())
}

/// Policy: tokenizer-token terminals parse, but do not compile.
///
/// `<think>`, `<[1000]>` and `!</think>` match entries of a sampler's
/// vocabulary. The model's tokenizer decides what text they cover, so the
/// same grammar means different things on different models, and a text
/// parser has no tokenizer at all. The two available approximations are
/// both wrong in a way that would go unnoticed: treating `<think>` as the
/// literal text accepts strings the sampler would refuse, and dropping it
/// accepts strings with nothing there. Either silently changes the
/// accepted language, which is the one failure mode an offline validator
/// must not have.
///
/// So the syntax layer accepts them, and this pass rejects them by name.
fn reject_token_terminals(prods: &[Value]) -> Result<(), GbnfError> {
    walk_elements(prods, &mut |element, rule| {
        if Some("tokterm") != field_str(element, "kind").as_deref() {
            return Ok(());
        }
        let text = field_str(element, "text").unwrap_or_default();
        Err(GbnfCompileError::new(
            format!(
                "gbnf: rule '{rule}' uses the tokenizer-token terminal '{text}'. These \
                 match a sampler's vocabulary entries rather than characters, so they \
                 have no meaning for a text parser and are not compiled. Remove them, or \
                 describe the same text with a string literal or character class."
            ),
            Some(rule),
            span_from(element),
        )
        .into())
    })
}

/// GBNF's start symbol is `root`, and llama.cpp refuses a grammar without
/// one ("grammar does not contain a 'root' symbol"). The rule is part of
/// the notation, not a convention, so it is enforced here rather than
/// left to the `start` option.
fn require_root(prods: &[Value]) -> Result<(), GbnfError> {
    if prods
        .iter()
        .any(|production| "root" == production_name(production))
    {
        return Ok(());
    }
    let names: Vec<String> = prods.iter().map(production_name).collect();
    Err(GbnfCompileError::new(
        format!(
            "gbnf: no 'root' rule. GBNF requires a rule named 'root'; it is the start \
             symbol, and the whole input must match it. Defined rules: {}.",
            names.join(", ")
        ),
        Some("root"),
        None,
    )
    .into())
}

/// Every reference must name a defined rule. Without this check an
/// undefined name reaches `tabnas-bnf`, where a bare `TX` / `NR` / `ST` /
/// `VL` would be normalised into a built-in lexer token and anything else
/// would emit a push to a rule the engine does not have: a parse-time
/// failure a long way from the typo that caused it. llama.cpp reports the
/// same condition ("Undefined rule identifier") at parse time.
fn require_defined_refs(prods: &[Value]) -> Result<(), GbnfError> {
    let defined: IndexSet<String> = prods.iter().map(production_name).collect();
    walk_elements(prods, &mut |element, rule| {
        if Some("ref") != field_str(element, "kind").as_deref() {
            return Ok(());
        }
        let name = field_str(element, "name").unwrap_or_default();
        if defined.contains(&name) {
            return Ok(());
        }
        Err(GbnfCompileError::new(
            format!("gbnf: rule '{rule}' references '{name}', which is never defined."),
            Some(rule),
            span_from(element),
        )
        .into())
    })
}

// ---- value helpers ---------------------------------------------------

fn field(value: &Value, key: &str) -> Option<Value> {
    match value {
        Value::Object(entries) => entries.get(key).cloned(),
        _ => None,
    }
}

fn field_str(value: &Value, key: &str) -> Option<String> {
    match field(value, key) {
        Some(Value::String(text)) => Some(text),
        _ => None,
    }
}

fn production_name(value: &Value) -> String {
    field_str(value, "name").unwrap_or_default()
}

fn span_from(value: &Value) -> Option<SrcSpan> {
    let sp = field(value, "sp")?;
    let number = |key: &str| match field(&sp, key) {
        Some(Value::Number(number)) if number.is_finite() && 0.0 <= number => Some(number as usize),
        _ => None,
    };
    Some(SrcSpan {
        s: number("s")?,
        e: number("e")?,
        r: number("r"),
        c: number("c"),
    })
}

/// Read one parsed production into the typed IR.
///
/// The parse AST is built as engine values in exactly the shape the IR
/// serializes to, so this is a deserialization rather than a translation,
/// and the two representations cannot drift apart.
fn production_from_value(value: &Value) -> Result<Production, GbnfError> {
    let mut json: Json = value.to_json();
    integral(&mut json);
    let name = production_name(value);
    serde_json::from_value(json).map_err(|error| {
        GbnfError::from(GbnfParseError::new(format!(
            "gbnf: rule '{name}' is malformed: {error}."
        )))
    })
}

/// Rewrite every whole number in a JSON tree as an integer.
///
/// The engine's number is a double, so a span offset and a repetition
/// count both arrive as `8.0`, which serde will not read into a `usize`.
/// Nothing in the IR is a fractional number, so the conversion is total
/// rather than a heuristic.
fn integral(value: &mut Json) {
    match value {
        Json::Number(number) => {
            if let Some(float) = number.as_f64() {
                if 0.0 == float.fract() && float.is_finite() && 0.0 <= float {
                    *value = Json::Number((float as u64).into());
                }
            }
        }
        Json::Array(items) => items.iter_mut().for_each(integral),
        Json::Object(entries) => entries.values_mut().for_each(integral),
        _ => {}
    }
}

// ---- emission --------------------------------------------------------

/// GBNF is scannerless: the grammar describes every character, the spaces
/// included. The engine's defaults are not. It ships
/// `tokenSet.IGNORE = ['#SP', '#LN', '#CM']` and a full complement of
/// JSON-shaped matchers, so `root ::= "a"` would happily accept `" a "`,
/// and a `#` in the input would vanish as a comment. Neither is GBNF.
///
/// The emitted spec therefore carries its own lexer settings: nothing is
/// ignored, and every default matcher that could claim a character the
/// grammar has not spoken for is switched off. What remains is the
/// grammar's own fixed tokens (its string literals) and match tokens (its
/// character classes), so an unmatched character is a lex error rather
/// than a silently skipped one, and a parse is a faithful acceptance test
/// rather than a lenient one.
pub(crate) fn apply_exact_lexing(options: &mut Map<String, Json>) {
    // Add to the map, do not replace it: the compiler puts the
    // character-class partition's token sets here (a contested class
    // becomes a set over one-character atoms), and a bare assignment
    // dropped them, leaving every partitioned class referenced by a rule
    // with nothing to resolve to. Only IGNORE is ours to set.
    if !options.get("tokenSet").is_some_and(Json::is_object) {
        options.insert("tokenSet".into(), json!({}));
    }
    if let Some(token_set) = options.get_mut("tokenSet").and_then(Json::as_object_mut) {
        token_set.insert("IGNORE".into(), json!([]));
    }

    for off in [
        "space", "line", "comment", "string", "number", "text", "value",
    ] {
        options.insert(off.into(), json!({ "lex": false }));
    }

    // Negotiated lexing. GBNF is scannerless, so one character can be a
    // different token in different parse contexts (`"` is an escapable
    // character inside a string body and the closing quote at its end;
    // `\n` is a whitespace-class member and a literal). The engine's
    // relex option lets an alternative re-cut a span under its own token
    // list instead of failing on the first cut's identity.
    //
    // No capability probe here, unlike `ts/src/converter.ts`: the Rust
    // engine resolves `lex.relex` as a typed field, so a version too old
    // to know the option fails the build rather than ignoring it in
    // silence. That is the same reasoning `go/facade.go` records.
    //
    // Set the field, do not replace `lex`: `empty` is the compiler's to
    // set, from the start rule's nullability, and replacing the object
    // dropped it.
    if !options.get("lex").is_some_and(Json::is_object) {
        options.insert("lex".into(), json!({}));
    }
    if let Some(lex) = options.get_mut("lex").and_then(Json::as_object_mut) {
        lex.insert("relex".into(), json!(true));
    }
}

// ---- eager character classes -----------------------------------------
//
// The engine lexes under the ACTIVE RULE's direction: a match-token regex
// is only offered a position when the rule's alternatives list its token
// there (the token-column gate). That is what lets two overlapping
// classes, `[a-z]` and `[a-z0-9_]`, coexist as separate tokens.
//
// It also means a class token is invisible wherever the rule does not
// name it, and the rule that ends a repetition never does:
//
//     root ::= sign? [0-9]+          sign ::= "-"
//
// compiles to an optional helper whose only alternatives are the sign and
// the empty one, so its token column holds the sign alone. Lexing `1`
// there offers nothing that matches, and the parse dies one character in,
// even though the `[0-9]` token is right there in the spec. Every
// `X? C`, `X* C` and `X+ C` where `C` is a class has this shape.
//
// A matcher flagged eager skips the gate: it fires whenever its regex
// matches, and the parser rejects tokens it did not expect. That fixes
// the shape above, but only when it cannot introduce a NEW ambiguity,
// which needs two properties of the whole grammar:
//
//   1. the classes are pairwise disjoint, so at most one can claim any
//      character, and
//   2. no class contains the first character of any string literal, since
//      match matchers run before the fixed matcher and an eager class
//      would otherwise swallow the literal's opening character.
//
// Under both, tokenisation stops depending on parse state altogether:
// every character has exactly one possible token. Getting it wrong cannot
// over-accept (a mis-tokenised character makes the parse FAIL, never
// succeed), but the conditions are checked rather than assumed, and a
// grammar that fails either keeps the engine's rule-directed lexing.

const MAX_CP: u32 = 0x10FFFF;

/// A set of code points as sorted, merged, inclusive ranges.
type Ranges = Vec<(u32, u32)>;

fn normalize_ranges(mut ranges: Ranges) -> Ranges {
    ranges.sort_by_key(|span| span.0);
    let mut out: Ranges = Vec::new();
    for (lo, hi) in ranges {
        match out.last_mut() {
            // `lo <= last.1 + 1` merges adjacent as well as overlapping
            // runs, so `[a][b]` becomes one range and comparisons stay
            // cheap.
            Some(last) if lo <= last.1.saturating_add(1) => last.1 = last.1.max(hi),
            _ => out.push((lo, hi)),
        }
    }
    out
}

fn complement_ranges(ranges: &Ranges) -> Ranges {
    let mut out: Ranges = Vec::new();
    let mut next = 0u32;
    for &(lo, hi) in ranges {
        if next < lo {
            out.push((next, lo - 1));
        }
        next = hi.saturating_add(1);
    }
    if next <= MAX_CP {
        out.push((next, MAX_CP));
    }
    out
}

fn ranges_intersect(a: &Ranges, b: &Ranges) -> bool {
    let (mut i, mut j) = (0usize, 0usize);
    while i < a.len() && j < b.len() {
        if a[i].1 < b[j].0 {
            i += 1;
        } else if b[j].1 < a[i].0 {
            j += 1;
        } else {
            return true;
        }
    }
    false
}

fn ranges_contain(ranges: &Ranges, cp: u32) -> bool {
    for &(lo, hi) in ranges {
        if cp < lo {
            return false;
        }
        if cp <= hi {
            return true;
        }
    }
    false
}

/// Read back the code points of a pattern this crate emitted.
///
/// The format is fixed and tiny (`[`, an optional `^`, then `\uXXXX` /
/// `\u{…}` members and ranges), so reading it is exact rather than a
/// general regex parse. `[\s\S]` is the lowering of `.`, every character.
fn emitted_class_ranges(pattern: &str) -> Option<Ranges> {
    if r"[\s\S]" == pattern {
        return Some(vec![(0, MAX_CP)]);
    }
    let chars: Vec<char> = pattern.chars().collect();
    if chars.first() != Some(&'[') || chars.last() != Some(&']') {
        return None;
    }

    let mut i = 1usize;
    let mut negated = false;
    if chars.get(i) == Some(&'^') {
        negated = true;
        i += 1;
    }
    let end = chars.len() - 1;

    fn read_escape(chars: &[char], i: &mut usize) -> Option<u32> {
        if chars.get(*i) != Some(&'\\') || chars.get(*i + 1) != Some(&'u') {
            return None;
        }
        if chars.get(*i + 2) == Some(&'{') {
            let close = (*i + 3..chars.len()).find(|k| '}' == chars[*k])?;
            let hex: String = chars[*i + 3..close].iter().collect();
            let cp = u32::from_str_radix(&hex, 16).ok()?;
            *i = close + 1;
            return Some(cp);
        }
        if chars.len() < *i + 6 {
            return None;
        }
        let hex: String = chars[*i + 2..*i + 6].iter().collect();
        let cp = u32::from_str_radix(&hex, 16).ok()?;
        *i += 6;
        Some(cp)
    }

    let mut ranges: Ranges = Vec::new();
    while i < end {
        let lo = read_escape(&chars, &mut i)?;
        if chars.get(i) == Some(&'-') {
            i += 1;
            let hi = read_escape(&chars, &mut i)?;
            ranges.push((lo, hi));
        } else {
            ranges.push((lo, lo));
        }
    }

    let merged = normalize_ranges(ranges);
    Some(if negated {
        complement_ranges(&merged)
    } else {
        merged
    })
}

/// Every distinct terminal in the grammar: class patterns with their
/// code-point sets, and literals with their first code point.
fn collect_terminals(grammar: &Grammar) -> (Option<indexmap::IndexMap<String, Ranges>>, Vec<u32>) {
    let mut classes: indexmap::IndexMap<String, Ranges> = indexmap::IndexMap::new();
    let mut literal_heads: Vec<u32> = Vec::new();
    let mut usable = true;

    fn walk(
        element: &Element,
        classes: &mut indexmap::IndexMap<String, Ranges>,
        literal_heads: &mut Vec<u32>,
        usable: &mut bool,
    ) {
        match &element.kind {
            Kind::Regex { pattern, .. } => {
                if !classes.contains_key(pattern) {
                    match emitted_class_ranges(pattern) {
                        Some(ranges) => {
                            classes.insert(pattern.clone(), ranges);
                        }
                        None => *usable = false,
                    }
                }
            }
            Kind::Term { literal, .. } => {
                if let Some(head) = literal.chars().next() {
                    literal_heads.push(head as u32);
                }
            }
            Kind::Group { alts } => {
                for alt in alts {
                    for inner in alt {
                        walk(inner, classes, literal_heads, usable);
                    }
                }
            }
            Kind::Opt { inner }
            | Kind::Star { inner, .. }
            | Kind::Plus { inner }
            | Kind::Rep { inner, .. } => walk(inner, classes, literal_heads, usable),
            _ => {}
        }
    }

    for production in &grammar.productions {
        for alt in &production.alts {
            for element in alt {
                walk(element, &mut classes, &mut literal_heads, &mut usable);
            }
        }
    }

    (usable.then_some(classes), literal_heads)
}

/// The source of a serialized match-token matcher: `@~/source/flags` when
/// eager, `@/source/flags` otherwise. The engine's own reader splits on
/// the LAST slash, and so does this.
fn matcher_source(serialized: &str) -> Option<&str> {
    let rest = serialized
        .strip_prefix("@~/")
        .or_else(|| serialized.strip_prefix("@/"))?;
    let last = rest.rfind('/')?;
    Some(&rest[..last])
}

/// Set or clear the eager sentinel on one serialized matcher.
fn with_eager(serialized: &str, eager: bool) -> String {
    let Some(rest) = serialized
        .strip_prefix("@~/")
        .or_else(|| serialized.strip_prefix("@/"))
    else {
        return serialized.to_string();
    };
    format!("{}{}", if eager { "@~/" } else { "@/" }, rest)
}

/// The names of the spec's match tokens, in order.
fn match_token_names(options: &Map<String, Json>) -> Vec<String> {
    options
        .get("match")
        .and_then(|matchers| matchers.get("token"))
        .and_then(Json::as_object)
        .map(|tokens| tokens.keys().cloned().collect())
        .unwrap_or_default()
}

fn match_token(options: &Map<String, Json>, name: &str) -> Option<String> {
    options
        .get("match")?
        .get("token")?
        .get(name)?
        .as_str()
        .map(str::to_string)
}

fn set_match_token(options: &mut Map<String, Json>, name: &str, serialized: String) {
    if let Some(tokens) = options
        .get_mut("match")
        .and_then(|matchers| matchers.get_mut("token"))
        .and_then(Json::as_object_mut)
    {
        tokens.insert(name.to_string(), Json::String(serialized));
    }
}

/// Flag the emitted class matchers eager when the two conditions above
/// hold. Returns whether it did, so the caller can say so.
pub(crate) fn mark_classes_eager(grammar: &Grammar, options: &mut Map<String, Json>) -> bool {
    let names = match_token_names(options);
    if names.is_empty() {
        return false;
    }

    let (classes, literal_heads) = collect_terminals(grammar);
    let Some(classes) = classes else {
        return false;
    };

    // Every match token must be one of the classes read back above. A
    // token from anywhere else (an insensitive literal, a word-keyword
    // guard, a partition atom) has not been checked for disjointness, so
    // the whole optimisation is off rather than partly applied.
    let sources: IndexSet<String> = classes
        .keys()
        .map(|pattern| format!("^{pattern}"))
        .collect();
    for name in &names {
        let Some(serialized) = match_token(options, name) else {
            return false;
        };
        let Some(source) = matcher_source(&serialized) else {
            return false;
        };
        if !sources.contains(source) {
            return false;
        }
    }

    let sets: Vec<&Ranges> = classes.values().collect();
    for (i, left) in sets.iter().enumerate() {
        for right in sets.iter().skip(i + 1) {
            if ranges_intersect(left, right) {
                return false;
            }
        }
        for &head in &literal_heads {
            if ranges_contain(left, head) {
                return false;
            }
        }
    }

    for name in &names {
        if let Some(serialized) = match_token(options, name) {
            set_match_token(options, name, with_eager(&serialized, true));
        }
    }
    true
}

/// Clear the eager sentinel from every match matcher.
///
/// The shared compiler marks them all eager itself, which is how its
/// TypeScript emitter was brought level with the Go one. Inheriting that
/// wholesale is wrong here: GBNF drops the rule-directed gate only where
/// it has checked that dropping it cannot change which strings parse, and
/// `eager_classes: false` is a documented opt-out. So the decision is
/// applied in both directions rather than only ever being set.
pub(crate) fn clear_classes_eager(options: &mut Map<String, Json>) {
    for name in match_token_names(options) {
        if let Some(serialized) = match_token(options, &name) {
            set_match_token(options, &name, with_eager(&serialized, false));
        }
    }
}

use crate::GbnfError;
