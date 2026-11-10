// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

//! A GBNF document read as the schema `grammar-rules`: its rules as the
//! text writes them, uncompiled and in source order (tabnas/bnf's
//! `docs/grammar-rules.md`, and section 13.1 of alchemy's
//! `docs/streaming-plan.md`). The Rust port of `ts/src/tree.ts`: the tree
//! a host translates, whose events the part, `alchemy/transduce.alc`,
//! makes from the rule passes of [`make`].
//!
//! The tree parser reads GBNF with the meta-grammar the IR parser reads it
//! with, its lexer and every alternate as they are, and actions of its own
//! under the names the IR parser's take, so the rule passes a part reads
//! are the meta-grammar's. A token whose text needs reading (a string, a
//! class, a tokenizer terminal, a run of postfix operators) is given what
//! it reads as its value by the action that reads it, since a part reads
//! a token's value and never the work an action does with it.
//!
//! GBNF starts from the rule named root, wherever the text defines it, so
//! the grammar's `start` is "root", before any rule.
//!
//! The tree holds what the schema allows, so the parser refuses what it
//! cannot hold, each with a code of its own: an escape GBNF does not have,
//! one past U+10FFFF, or, in a string, half of a surrogate pair standing
//! alone (`gbnf_escape`), a class range that ends below where it starts
//! (`gbnf_class_range`), an empty class (`gbnf_empty_class`), a repetition
//! whose most is below its least (`gbnf_reversed_repetition`), a count
//! past 2^53 - 1 (`gbnf_count`) and a group left open (`gbnf_unclosed`).
//! The IR parser's cap on nested groups holds here too
//! (`gbnf_group_depth`, DIVERGENCE.md 4).

use std::rc::Rc;
use std::sync::OnceLock;

use indexmap::IndexMap;
use tabnas::{ActionError, Rule, Tabnas, Value};

use crate::converter::GbnfParseError;
use crate::parser_gbnf::{
    build_parser, open_token, push_node, set_node, DEPTH_CODE, DEPTH_MESSAGE, MAX_GROUP_DEPTH,
};
use crate::terminal::{decode_string, operator_pattern, read_char};

/// The largest repetition count the tree holds exactly: 2^53 - 1.
const MAX_COUNT: u64 = 9_007_199_254_740_991;

/// The codes the tree parser refuses a source with, beside the engine's:
/// each with its message and its hint.
const TREE_ERRORS: [(&str, &str, &str); 6] = [
    (
        "gbnf_escape",
        "the terminal {src} holds an escape GBNF does not have, or one that names no character",
        "GBNF escapes are \\t \\r \\n \\\\ \\\" \\[ \\] \\- \\xXX \\uXXXX \\UXXXXXXXX, naming a \
         code point up to \\U0010FFFF, and a surrogate in a string is half of a pair, \
         \\uD83D\\uDE00.",
    ),
    (
        "gbnf_class_range",
        "the character class {src} has a range that ends below where it starts",
        "Write a range from its lower end to its higher, as [a-z].",
    ),
    (
        "gbnf_empty_class",
        "the character class {src} is empty, and matches nothing",
        "A class holds a character or a range at least.",
    ),
    (
        "gbnf_reversed_repetition",
        "the repetition {src} allows fewer than it requires: its most is below its least",
        "In {m,n} the n is the most and the m the least, so n is not below m.",
    ),
    (
        "gbnf_count",
        "a repetition count in {src} is past 9007199254740991, the largest whole number the \
         tree holds",
        "A repetition count is a whole number no larger than 9007199254740991.",
    ),
    (
        "gbnf_unclosed",
        "a group is not closed",
        "Close the group with ).",
    ),
];

/// An object of the tree, its members in the order given.
fn tree_object(fields: Vec<(&str, Value)>) -> Value {
    let mut map = IndexMap::new();
    for (key, value) in fields {
        map.insert(key.to_string(), value);
    }
    Value::object(map)
}

/// The error a code raises, with its message as the detail.
fn refuse(code: &str) -> ActionError {
    let message = TREE_ERRORS
        .iter()
        .find(|(name, _, _)| *name == code)
        .map_or(code, |(_, message, _)| message);
    ActionError::new(code, message.to_string())
}

/// A class's member, its bounds code points.
fn member(from: u32, to: u32) -> Value {
    tree_object(vec![
        ("from", Value::Number(f64::from(from))),
        ("to", Value::Number(f64::from(to))),
    ])
}

/// A class's negation and members, read as the IR parser reads them (`^`
/// first negates it, `a-b` is a range, and a `-` before the closing
/// bracket is a member), or the code it is refused with. A member is a
/// code point, so a surrogate is one, and the two escapes of a pair are
/// two members, as the canonical runtime reads them.
fn class_value(raw: &str) -> Result<(bool, Vec<Value>), &'static str> {
    let bytes = raw.as_bytes();
    let end = raw.len().saturating_sub(1);
    let mut i = 1;
    let mut negated = false;
    if bytes.get(i) == Some(&b'^') {
        negated = true;
        i += 1;
    }
    let mut members = Vec::new();
    while i < end {
        let (lo, next) = read_char(raw, i).map_err(|_| "gbnf_escape")?;
        i = next;
        if bytes.get(i) == Some(&b'-') && i + 1 < end {
            let (hi, next) = read_char(raw, i + 1).map_err(|_| "gbnf_escape")?;
            i = next;
            if hi < lo {
                return Err("gbnf_class_range");
            }
            members.push(member(lo, hi));
        } else {
            members.push(member(lo, lo));
        }
    }
    if members.is_empty() {
        return Err("gbnf_empty_class");
    }
    Ok((negated, members))
}

/// A repetition count, if the tree holds it exactly.
fn count(digits: &str) -> Result<f64, &'static str> {
    match digits.parse::<u64>() {
        Ok(n) if n <= MAX_COUNT => Ok(n as f64),
        _ => Err("gbnf_count"),
    }
}

/// A repetition, `min` and, where it has one, `max`.
fn repetition(min: f64, max: Option<f64>) -> Value {
    let mut fields = vec![("min", Value::Number(min))];
    if let Some(max) = max {
        fields.push(("max", Value::Number(max)));
    }
    tree_object(fields)
}

/// A run of postfix operators as its repetitions, in the order written,
/// or the code it is refused with.
fn postfix_value(src: &str) -> Result<Value, &'static str> {
    let mut out = Vec::new();
    for found in operator_pattern().captures_iter(src) {
        let op = found.get(0).map_or("", |m| m.as_str());
        match op.as_bytes().first() {
            Some(b'*') => out.push(repetition(0.0, None)),
            Some(b'+') => out.push(repetition(1.0, None)),
            Some(b'?') => out.push(repetition(0.0, Some(1.0))),
            _ => {
                let min = count(found.get(1).map_or("", |m| m.as_str()))?;
                // `{m}` is exactly m, `{m,}` m or more and `{m,n}` the
                // closed range.
                if !op.contains(',') {
                    out.push(repetition(min, Some(min)));
                    continue;
                }
                match found.get(2).map(|m| m.as_str()).filter(|m| !m.is_empty()) {
                    None => out.push(repetition(min, None)),
                    Some(digits) => {
                        let max = count(digits)?;
                        if max < min {
                            return Err("gbnf_reversed_repetition");
                        }
                        out.push(repetition(min, Some(max)));
                    }
                }
            }
        }
    }
    Ok(Value::array(out))
}

/// Append the element an atom built, its repetitions appended, onto the
/// alternative; or refuse a group the source ended inside.
fn tree_element(rule: &mut Rule, repeat: Option<Value>) -> Result<(), ActionError> {
    let mut element = rule.child_node.clone();
    if element.is_undefined() {
        return Err(refuse("gbnf_unclosed"));
    }
    if let Some(repeat) = repeat {
        if let Some(members) = element.as_object_mut() {
            members.insert("repeat".into(), repeat);
        }
    }
    push_node(rule, element);
    Ok(())
}

/// Give the first token a rule matched in its open state its value.
fn set_open_val(rule: &mut Rule, val: Value) {
    if let Some(first) = Rc::make_mut(&mut rule.o).first_mut() {
        first.val = val;
    }
}

/// Register the tree parser's actions under the names the meta-grammar's
/// document gives them.
fn register_tree_refs(parser: &mut Tabnas) {
    parser.state_action_ref("@gbnf-bo", |rule, _context| {
        set_node(
            rule,
            tree_object(vec![
                ("type", Value::String("grammar".into())),
                ("start", Value::String("root".into())),
                ("rules", Value::array(Vec::new())),
            ]),
        );
        Ok(())
    });

    parser.action_with_context("@prod-name", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        rule.u_mut()
            .insert("name".into(), Value::String(token.src.as_str().to_string()));
        Ok(())
    });
    parser.state_action_ref("@prod-bc", |rule, _context| {
        if rule.child_node.is_undefined() {
            return Ok(());
        }
        let name = match rule.u.get("name") {
            Some(Value::String(name)) => name.clone(),
            _ => String::new(),
        };
        let entry = tree_object(vec![
            ("type", Value::String("rule".into())),
            ("name", Value::String(name)),
            ("alternatives", rule.child_node.clone()),
        ]);
        if let Some(grammar) = rule.node.borrow_mut().as_object_mut() {
            if let Some(rules) = grammar.get_mut("rules").and_then(Value::as_array_mut) {
                rules.push(entry);
            }
        }
        Ok(())
    });

    parser.state_action_ref("@alts-bo", |rule, _context| {
        set_node(rule, Value::array(Vec::new()));
        Ok(())
    });
    parser.state_action_ref("@alts-bc", |rule, _context| {
        if rule.child_node.is_undefined() {
            return Ok(());
        }
        let sequence = rule.child_node.clone();
        push_node(rule, sequence);
        Ok(())
    });

    parser.state_action_ref("@seq-bo", |rule, _context| {
        set_node(rule, Value::array(Vec::new()));
        Ok(())
    });

    // The run's repetitions, which its token carries from here.
    parser.action_with_context("@elem-post", |rule, _context| {
        let Some(run) = rule.c0().map(|token| token.src.as_str().to_string()) else {
            return Ok(());
        };
        let reps = postfix_value(&run).map_err(refuse)?;
        if let Some(first) = Rc::make_mut(&mut rule.c).first_mut() {
            first.val = reps.clone();
        }
        tree_element(rule, Some(reps))
    });
    parser.action_with_context("@elem-plain", |rule, _context| tree_element(rule, None));

    parser.state_action_ref("@atom-bo", |rule, _context| {
        set_node(rule, Value::Undefined);
        rule.u_mut().insert("grouped".into(), Value::Bool(false));
        Ok(())
    });
    parser.action_with_context("@atom-gs", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        let text = decode_string(token.src.as_str()).map_err(|_| refuse("gbnf_escape"))?;
        set_open_val(rule, Value::String(text.clone()));
        set_node(
            rule,
            tree_object(vec![
                ("type", Value::String("literal".into())),
                ("text", Value::String(text)),
                ("caseSensitive", Value::Bool(true)),
            ]),
        );
        Ok(())
    });
    parser.action_with_context("@atom-cc", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        let (negated, members) = class_value(token.src.as_str()).map_err(refuse)?;
        set_open_val(
            rule,
            tree_object(vec![
                ("negated", Value::Bool(negated)),
                ("members", Value::array(members.clone())),
            ]),
        );
        set_node(
            rule,
            tree_object(vec![
                ("type", Value::String("class".into())),
                ("negated", Value::Bool(negated)),
                ("members", Value::array(members)),
            ]),
        );
        Ok(())
    });
    parser.action_with_context("@atom-dot", |rule, _context| {
        set_node(
            rule,
            tree_object(vec![("type", Value::String("any".into()))]),
        );
        Ok(())
    });
    parser.action_with_context("@atom-tok", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        let src = token.src.as_str();
        let negated = src.starts_with('!');
        let text = src
            .get(if negated { 2 } else { 1 }..src.len().saturating_sub(1))
            .unwrap_or_default()
            .to_string();
        set_open_val(
            rule,
            tree_object(vec![
                ("negated", Value::Bool(negated)),
                ("text", Value::String(text.clone())),
            ]),
        );
        set_node(
            rule,
            tree_object(vec![
                ("type", Value::String("token".into())),
                ("negated", Value::Bool(negated)),
                ("text", Value::String(text)),
            ]),
        );
        Ok(())
    });
    parser.action_with_context("@atom-nm", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        set_node(
            rule,
            tree_object(vec![
                ("type", Value::String("reference".into())),
                ("name", Value::String(token.src.as_str().to_string())),
            ]),
        );
        Ok(())
    });
    parser.action_with_context("@atom-lp", |rule, _context| {
        if MAX_GROUP_DEPTH < rule.d {
            return Err(ActionError::new(DEPTH_CODE, DEPTH_MESSAGE));
        }
        rule.u_mut().insert("grouped".into(), Value::Bool(true));
        Ok(())
    });
    // Only a group consumes the `)`, as in the IR parser.
    parser.alt_condition("@atom-group-c", |rule, _context| {
        matches!(rule.u.get("grouped"), Some(Value::Bool(true)))
    });
    parser.action_with_context("@atom-group-close", |rule, _context| {
        let alternatives = rule.child_node.clone();
        set_node(
            rule,
            tree_object(vec![
                ("type", Value::String("group".into())),
                ("alternatives", alternatives),
            ]),
        );
        Ok(())
    });
}

/// A fresh parser that reads a GBNF document as the tree: the parser a
/// host streams a document through with the part, whose rule passes the
/// part reads, and whose value is the tree (`Undefined` for an empty
/// source, which makes no pass).
///
/// ```
/// let tree = tabnas_gbnf::make().parse("root ::= a").unwrap();
/// assert_eq!(tree.to_json()["rules"][0]["name"], "root");
/// ```
#[must_use]
pub fn make() -> Tabnas {
    // The meta-grammar is this crate's own, so it always installs.
    build_parser(register_tree_refs, &TREE_ERRORS)
        .expect("gbnf: the tree parser installs its own meta-grammar")
}

/// A GBNF document read whole as the tree. A source the meta-grammar
/// refuses, or the tree cannot hold, fails with a [`GbnfParseError`]
/// naming the line and column, its `code` the engine's.
///
/// ```
/// let tree = tabnas_gbnf::parse_gbnf_tree("root ::= [a-z]+\n").unwrap();
/// let element = &tree.to_json()["rules"][0]["alternatives"][0][0];
/// assert_eq!(element["members"][0]["to"], 122.0);
/// assert_eq!(element["repeat"][0]["min"], 1.0);
/// ```
pub fn parse_gbnf_tree(src: &str) -> Result<Value, GbnfParseError> {
    static PARSER: OnceLock<Tabnas> = OnceLock::new();
    let parser = PARSER.get_or_init(make);
    match parser.parse(src) {
        Ok(Value::Undefined) | Ok(Value::Null) => Ok(tree_object(vec![
            ("type", Value::String("grammar".into())),
            ("start", Value::String("root".into())),
            ("rules", Value::array(Vec::new())),
        ])),
        Ok(tree) => Ok(tree),
        Err(error) => {
            let line = error.row;
            let column = error.col;
            let location = if 0 != line && 0 != column {
                format!(" at line {line}, column {column}")
            } else {
                String::new()
            };
            let rendered = error.to_string();
            let raw = match rendered.find('\n') {
                Some(at) => &rendered[..at],
                None => rendered.as_str(),
            };
            Err(GbnfParseError {
                message: format!("gbnf: parse error{location}: {raw}"),
                line: (0 != line).then_some(line),
                column: (0 != column).then_some(column),
                code: Some(error.code.clone()),
            })
        }
    }
}
