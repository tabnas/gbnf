// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

//! The GBNF grammar itself, expressed as a tabnas grammar document and
//! installed on a bare engine. The Rust port of the TypeScript
//! `gbnfRules` table plus `getGbnfParser` in `ts/src/converter.ts`, and
//! of `go/parser_gbnf.go`.
//!
//! The front-end eats its own dog food: GBNF source is read by a tabnas
//! instance whose grammar is the document below, and the parse AST is
//! assembled by the action closures in [`register_refs`].
//!
//! Token vocabulary (mirrors the TypeScript comment):
//!
//! | Token | Means |
//! |---|---|
//! | `#DEF` | `::=`, the rule-definition operator |
//! | `#ALT` | `\|`, alternation |
//! | `#LP` / `#RP` | `(` and `)` |
//! | `#DOT` | `.`, any character |
//! | `#NM` | a rule name, `[A-Za-z0-9_-]+` |
//! | `#GS` | `"…"`, a string literal, raw |
//! | `#CC` | `[…]`, a character class, raw |
//! | `#POST` | a run of postfix repetition operators |
//! | `#TOK` | `<…>` / `!<…>`, a tokenizer-token terminal |
//! | `#ZZ` | end of source |
//!
//! Every free-form terminal is lexed WHOLE by one anchored regex flagged
//! eager, which opts the matcher out of the lexer's token-column gate.
//! GBNF's terminals are unambiguous by their first character, so
//! tokenisation does not need to know what the parser expects. That is
//! why this file has none of the two-token `s:` patterns the ABNF
//! front-end needs.

use std::cell::RefCell;
use std::rc::Rc;
use std::sync::OnceLock;

use indexmap::IndexMap;
use regex::Regex;
use serde_json::Value as JsonValue;
use tabnas::{
    Context, MatchToken, MatchTokenMatcher, Options, Rule, Tabnas, TabnasError, Token, Value,
};

use crate::terminal::{decode_char_class, decode_string};

/// How deep the rule stack may go while reading one GBNF source.
///
/// A grammar file is untrusted input, the parse AST nests once per
/// parenthesis, and the walks over it, the engine's own value drop and
/// the deserialization into the typed IR are all recursive: a Rust stack
/// that runs out ABORTS the process rather than unwinding. Two hundred
/// and fifty nested groups reached that on a 2 MiB thread, so the depth
/// is refused here instead, before anything that deep is built.
///
/// The limit counts RULE levels, which a parenthesis costs four of, so
/// the cut falls at exactly 128 nested groups: 127 compiles, 128 is
/// refused. That is the same boundary the shared compiler's own
/// `MAX_ELEMENT_DEPTH` draws, so every grammar this cap turns away was
/// already going to be refused, only with a worse failure. No GBNF an
/// author writes comes close, and the deepest grammar in either
/// committed corpus nests nowhere near it.
pub(crate) const MAX_GROUP_DEPTH: usize = 512;

/// The diagnostic raised when [`MAX_GROUP_DEPTH`] is exceeded.
pub(crate) const DEPTH_MESSAGE: &str =
    "gbnf: grammar nests too deeply (more than 512 rule levels, about 128 nested groups)";

/// The error code carried by the depth refusal, so the converter can tell
/// it apart from an ordinary engine rejection.
pub(crate) const DEPTH_CODE: &str = "gbnf_group_depth";

/// How deep the IR this front-end builds may NEST.
///
/// [`MAX_GROUP_DEPTH`] counts RULE levels, which is the engine's own
/// stack while the source is read. It is not the same measure, and on
/// its own it is not enough: a group nests the IR once per group, a
/// postfix operator nests it once more, and a RUN of postfix operators
/// is ONE token however long it is. So `root ::= "x"` followed by four
/// hundred question marks costs four rule levels and builds an element
/// four hundred deep, and 127 nested groups each closed by two `?`
/// costs 508 rule levels and builds one 381 deep. Everything downstream
/// of the parse walks that nesting recursively: the deserialization
/// into the typed IR, the shared compiler's passes, the renderer, and
/// the value's own drop.
///
/// MEASURED on this machine, on the unoptimised profile, in a 2 MiB
/// thread, which is Rust's default for a spawned thread:
///
/// | source | element nesting | result |
/// |---|---|---|
/// | `root ::= "x"` and 392 `?` | 393 | parses |
/// | `root ::= "x"` and 394 `?` | 395 | aborts |
/// | 108 nested groups, two `?` each | 325 | parses |
/// | 110 nested groups, two `?` each | 331 | aborts |
///
/// A group level costs more stack than a postfix level, because a group
/// is also rule levels the engine is holding at the same time, so the
/// group-heavy shape is the worst case for a given nesting depth.
///
/// The cut is drawn at 130, two past the 128 the shared compiler's own
/// `MAX_ELEMENT_DEPTH` allows and the same measure it counts, so a
/// grammar at 129 or 130 still meets that compiler's diagnostic, which
/// names the rule. Nothing deeper than 128 was ever going to compile;
/// this cap only decides which refusal a caller sees, and makes sure
/// there is one to see. At the cap the group-heavy shape sits about 2.4
/// times inside the measured abort.
pub(crate) const MAX_NEST_DEPTH: usize = 130;

/// The diagnostic raised when [`MAX_NEST_DEPTH`] is exceeded.
pub(crate) const NEST_MESSAGE: &str =
    "gbnf: grammar nests elements more than 130 deep, which is past what this front-end \
     will build. Split the rule into named rules.";

/// The error code carried by the nesting refusal.
pub(crate) const NEST_CODE: &str = "gbnf_nest_depth";

/// Context register: the nesting depth of the element that just
/// completed, which is what the enclosing postfix run wraps.
const NEST_KEY: &str = "gbnfNest";

/// Context register: the greatest nesting depth completed at the current
/// group level, which is what a group takes one more than when it
/// closes.
const LEVEL_KEY: &str = "gbnfLevel";

// ---- the token patterns ---------------------------------------------

/// Whitespace exactly as llama.cpp's `parse_space` defines it. NOT a
/// wider Unicode notion, and NOT the `regex` crate's `\s`, which is
/// Unicode-aware: using either made `root ::= "x"{ 1}` with a U+00A0
/// compile here while llama.cpp rejects it. For a crate whose purpose is
/// conformance, accepting more than the notation does is the wrong
/// direction to err in.
const SP: &str = r"[ \t\r\n]";

/// `{m}` / `{m,}` / `{m,n}`, with llama.cpp-legal spacing throughout, the
/// counts captured. Used by `apply_postfix`, which needs them.
pub(crate) fn rep_capturing() -> String {
    format!(r"\{{{SP}*([0-9]+){SP}*(?:,{SP}*([0-9]*){SP}*)?\}}")
}

/// The same, with the counts non-capturing: the run matcher only needs
/// the extent.
fn rep_non_capturing() -> String {
    format!(r"\{{{SP}*(?:[0-9]+){SP}*(?:,{SP}*(?:[0-9]*){SP}*)?\}}")
}

// ---- per-parse state -------------------------------------------------

thread_local! {
    /// The first terminal-decoder diagnostic of the parse running on this
    /// thread, or `None`.
    ///
    /// The canonical TypeScript throws out of the alt action that decodes
    /// a string literal or a character class, so the exception propagates
    /// with the decoder's own wording and no engine position bolted on.
    /// An alt action here could return an error, but the engine would
    /// wrap it with a position the TypeScript diagnostic does not carry,
    /// and `ts/test/cli.test.js` pins that a terminal-decoder failure has
    /// NO location.
    ///
    /// So the message is recorded here and read once the parse is
    /// structurally complete, which is what `go/parser_gbnf.go` does with
    /// its `gbnfState`. A thread local rather than the parse context's
    /// `u` bag because `Tabnas::parse` hands the context back to nobody:
    /// this is the only channel out.
    static DECODE_ERR: RefCell<Option<String>> = const { RefCell::new(None) };
}

/// Record a terminal-decoder diagnostic, keeping the FIRST: later actions
/// still run (the engine does not know to stop), and the earliest failure
/// is the one that explains the grammar.
pub(crate) fn record_decode_err(message: String) {
    DECODE_ERR.with(|slot| {
        let mut slot = slot.borrow_mut();
        if slot.is_none() {
            *slot = Some(message);
        }
    });
}

fn clear_decode_err() {
    DECODE_ERR.with(|slot| *slot.borrow_mut() = None);
}

fn taken_decode_err() -> Option<String> {
    DECODE_ERR.with(|slot| slot.borrow_mut().take())
}

// ---- the meta-grammar ------------------------------------------------

/// The GBNF meta-grammar as a tabnas grammar document.
///
/// ```text
/// gbnf = prod*
/// prod = NM '::=' alts
/// alts = seq ('|' seq)*
/// seq  = elem*                 (an EMPTY seq is legal GBNF:
///                               `ws ::= | " " | "\n"`)
/// elem = atom POST?
/// atom = NM | GS | CC | DOT | TOK | '(' alts ')'
/// ```
///
/// Every alternative is the one the canonical `gbnfRules` table carries,
/// in the same order. The order is load-bearing twice over: the engine
/// tries alternatives in order, and the `s` patterns decide which token
/// matchers the lexer is offered at each position.
const GRAMMAR_TEXT: &str = r##"
{
  "rule": {
    "gbnf": {
      "open": [
        { "s": "#ZZ", "g": "empty" },
        { "p": "prod" }
      ],
      "close": [
        { "s": "#ZZ" }
      ]
    },

    "prod": {
      "open": [
        { "s": "#NM #DEF", "a": "@prod-name", "p": "alts" }
      ],
      "close": [
        { "s": "#NM #DEF", "b": 2, "r": "prod" },
        { "b": 1 }
      ]
    },

    "alts": {
      "open": [
        { "p": "seq" }
      ],
      "close": [
        { "s": "#ALT", "p": "seq" },
        { "b": 1 }
      ]
    },

    "seq": {
      "open": [
        { "s": "#NM #DEF", "b": 2, "g": "end" },
        { "s": "#ALT", "b": 1, "g": "end" },
        { "s": "#RP", "b": 1, "g": "end" },
        { "s": "#ZZ", "b": 1, "g": "end" },
        { "p": "elem" }
      ],
      "close": [
        { "s": "#NM #DEF", "b": 2, "g": "end" },
        { "s": "#ALT", "b": 1, "g": "end" },
        { "s": "#RP", "b": 1, "g": "end" },
        { "s": "#ZZ", "b": 1, "g": "end" },
        { "p": "elem" }
      ]
    },

    "elem": {
      "open": [
        { "p": "atom" }
      ],
      "close": [
        { "s": "#POST", "a": "@elem-post" },
        { "a": "@elem-plain" }
      ]
    },

    "atom": {
      "open": [
        { "s": "#GS", "a": "@atom-gs" },
        { "s": "#CC", "a": "@atom-cc" },
        { "s": "#DOT", "a": "@atom-dot" },
        { "s": "#TOK", "a": "@atom-tok" },
        { "s": "#NM", "a": "@atom-nm" },
        { "s": "#LP", "a": "@atom-lp", "p": "alts" }
      ],
      "close": [
        { "s": "#RP", "c": "@atom-group-c", "a": "@atom-group-close" },
        { "b": 1 }
      ]
    }
  }
}
"##;

/// The GBNF meta-grammar's rule table, as data.
///
/// The Rust spelling of the TypeScript `gbnfRules` export: a fresh
/// document each call, so a caller may take it apart without disturbing
/// the parser this crate builds from the same text.
pub fn gbnf_rules() -> JsonValue {
    let document: JsonValue =
        serde_json::from_str(GRAMMAR_TEXT).expect("the embedded GBNF meta-grammar is valid JSON");
    document
        .get("rule")
        .cloned()
        .expect("the embedded GBNF meta-grammar has a rule map")
}

// ---- nesting depth ---------------------------------------------------
//
// Two registers on the parse context are enough, because the parse is
// depth first and a postfix RUN is one token that never contains a
// group:
//
// - `NEST_KEY` is the depth of the element that just completed, which
//   at the moment a postfix run is read is the atom it wraps.
// - `LEVEL_KEY` is the greatest depth completed at the current group
//   level, which is what a group takes one more than when it closes. A
//   group rule saves the enclosing level's value in its OWN `u` bag at
//   open and puts it back at close, so the register is stack
//   disciplined without a stack.

/// Read a `usize` register off the parse context, absent meaning zero.
fn register(context: &Context, key: &str) -> usize {
    match context.u.get(key) {
        Some(Value::Number(number)) if 0.0 <= *number => *number as usize,
        _ => 0,
    }
}

/// Write a `usize` register onto the parse context.
fn set_register(context: &mut Context, key: &str, value: usize) {
    context
        .u
        .insert(key.to_string(), Value::Number(value as f64));
}

/// Refuse a source whose IR would nest past [`MAX_NEST_DEPTH`].
fn check_nest(depth: usize) -> Result<(), tabnas::ActionError> {
    if MAX_NEST_DEPTH < depth {
        return Err(tabnas::ActionError::new(NEST_CODE, NEST_MESSAGE));
    }
    Ok(())
}

/// An element has completed at this level: remember it if it is the
/// deepest one an enclosing group would have to hold.
fn note_level(context: &mut Context) {
    let depth = register(context, NEST_KEY);
    if register(context, LEVEL_KEY) < depth {
        set_register(context, LEVEL_KEY, depth);
    }
}

// ---- node helpers ----------------------------------------------------

/// Replace a rule's node, rebinding the cell rather than writing through
/// it.
///
/// A pushed rule INHERITS its parent's node cell, so writing through the
/// cell would overwrite what the parent is accumulating. This is the Rust
/// spelling of TypeScript's `r.node = …`, which rebinds the property and
/// leaves the parent's own reference alone.
fn set_node(rule: &mut Rule, value: Value) {
    rule.node = Rc::new(RefCell::new(value));
}

/// Append to the array a rule's node holds, through the shared cell, so a
/// parent accumulating into the same array sees it. The TypeScript
/// `r.node.push(…)` on an inherited array.
fn push_node(rule: &Rule, value: Value) {
    if let Some(list) = rule.node.borrow_mut().as_array_mut() {
        list.push(value);
    }
}

/// One named field of an object value, or `None` when there is none.
fn field(value: &Value, key: &str) -> Option<Value> {
    match value {
        Value::Object(entries) => entries.get(key).cloned(),
        _ => None,
    }
}

/// Build an object value from named fields, dropping the absent ones.
pub(crate) fn object(fields: Vec<(&str, Option<Value>)>) -> Value {
    let mut map = IndexMap::new();
    for (key, value) in fields {
        if let Some(value) = value {
            map.insert(key.to_string(), value);
        }
    }
    Value::object(map)
}

/// The source span of a token, as the IR's `SrcSpan` shape.
///
/// Every field is copied straight off the token: the compiler stores
/// whatever units the front-end's own engine tokens use, precisely so
/// that no arithmetic, and so no off-by-one, happens at this boundary.
/// This engine counts bytes where the canonical TypeScript counts UTF-16
/// code units, the divergence the engine already records for token
/// positions.
pub(crate) fn span_of(token: Option<&Token>) -> Option<Value> {
    let token = token?;
    Some(object(vec![
        ("s", Some(Value::Number(token.site.si as f64))),
        ("e", Some(Value::Number((token.site.si + token.len) as f64))),
        ("r", Some(Value::Number(token.site.ri as f64))),
        ("c", Some(Value::Number(token.site.ci as f64))),
    ]))
}

/// One span covering two spans: a group runs from its `(` to its `)`.
/// Falls back to whichever end is known when the other is not.
fn span_to(from: Option<&Value>, to: Option<&Value>) -> Option<Value> {
    match (from, to) {
        (Some(a), Some(b)) => Some(object(vec![
            ("s", field(a, "s")),
            ("e", field(b, "e")),
            ("r", field(a, "r")),
            ("c", field(a, "c")),
        ])),
        (Some(a), None) => Some(a.clone()),
        (None, b) => b.cloned(),
    }
}

/// The token a matched open slot holds, cloned so the rule stays
/// borrowable.
fn open_token(rule: &Rule, index: usize) -> Option<Token> {
    rule.o.get(index).cloned()
}

// ---- the AST-assembly closures ---------------------------------------

/// Register every action and condition the meta-grammar names. The
/// reserved `@<rule>-bo` / `@<rule>-bc` names are wired onto their rule's
/// phase by the grammar loader.
fn register_refs(parser: &mut Tabnas) {
    // --- gbnf (top level): accumulate productions ---
    parser.state_action_ref("@gbnf-bo", |rule, _context| {
        set_node(rule, Value::array(Vec::new()));
        Ok(())
    });

    // --- prod ---
    parser.action_with_context("@prod-name", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        let name = token.src.as_str().to_string();
        let span = span_of(Some(&token));
        let bag = rule.u_mut();
        bag.insert("name".into(), Value::String(name));
        bag.insert("nameSp".into(), span.unwrap_or(Value::Undefined));
        Ok(())
    });
    parser.state_action_ref("@prod-bc", |rule, _context| {
        if rule.child_node.is_undefined() {
            return Ok(());
        }
        let alts = rule.child_node.clone();
        let name = match rule.u.get("name") {
            Some(Value::String(name)) => name.clone(),
            _ => String::new(),
        };
        // The name, not the body: that is what an outline entry,
        // go-to-definition and a whole-rule diagnostic want.
        let span = match rule.u.get("nameSp") {
            Some(value) if !value.is_undefined() => Some(value.clone()),
            _ => None,
        };
        push_node(
            rule,
            object(vec![
                ("name", Some(Value::String(name))),
                ("alts", Some(alts)),
                ("sp", span),
            ]),
        );
        Ok(())
    });

    // --- alts ---
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

    // --- seq ---
    parser.state_action_ref("@seq-bo", |rule, _context| {
        set_node(rule, Value::array(Vec::new()));
        Ok(())
    });

    // --- elem ---
    // `r.c`, not `r.o`: tokens matched by a close-state alternative land
    // in the rule's close-token array.
    parser.action_with_context("@elem-post", |rule, context| {
        let item = rule.child_node.clone();
        if item.is_undefined() {
            return Ok(());
        }
        let Some(run) = rule.c0().map(|token| token.src.as_str().to_string()) else {
            return Ok(());
        };
        // The atom's own depth, which the run wraps. Charged AS each
        // wrapper is built, because a run is one token however long it
        // is: measuring the tower afterwards would mean building it
        // first, and a tall enough one aborts the process on the way
        // back out rather than returning.
        let mut depth = register(context, NEST_KEY);
        match crate::terminal::apply_postfix(item, &run, &mut depth, MAX_NEST_DEPTH) {
            Ok(element) => {
                set_register(context, NEST_KEY, depth);
                note_level(context);
                push_node(rule, element);
            }
            Err(crate::terminal::PostfixError::Decode(message)) => record_decode_err(message),
            Err(crate::terminal::PostfixError::TooDeep) => {
                return Err(tabnas::ActionError::new(NEST_CODE, NEST_MESSAGE))
            }
        }
        Ok(())
    });
    parser.action_with_context("@elem-plain", |rule, context| {
        let item = rule.child_node.clone();
        if !item.is_undefined() {
            note_level(context);
            push_node(rule, item);
        }
        Ok(())
    });

    // --- atom ---
    //
    // `r.node = undefined` in the open hook is load-bearing: an empty
    // string literal (`""`) contributes no element at all, and `elem`
    // skips pushing when the atom left its node unset.
    parser.state_action_ref("@atom-bo", |rule, context| {
        set_node(rule, Value::Undefined);
        // Every atom is a terminal until `@atom-lp` says otherwise, and
        // a terminal nests one deep. `@atom-group-close` overwrites this
        // with the group's own depth.
        set_register(context, NEST_KEY, 1);
        rule.u_mut().insert("grouped".into(), Value::Bool(false));
        Ok(())
    });
    parser.action_with_context("@atom-gs", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        match decode_string(token.src.as_str()) {
            Ok(literal) => {
                // GBNF string literals are CASE-SENSITIVE, the opposite
                // of RFC 5234's default. The flag is what makes the
                // emitter lower this to a plain fixed token instead of a
                // case-folding regex, so dropping it would silently
                // accept `"TRUE"` for `"true"`.
                if !literal.is_empty() {
                    let span = span_of(Some(&token));
                    set_node(
                        rule,
                        object(vec![
                            ("kind", Some(Value::String("term".into()))),
                            ("literal", Some(Value::String(literal))),
                            ("caseSensitive", Some(Value::Bool(true))),
                            ("sp", span),
                        ]),
                    );
                }
            }
            Err(message) => record_decode_err(message),
        }
        Ok(())
    });
    parser.action_with_context("@atom-cc", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        let span = span_of(Some(&token));
        match decode_char_class(token.src.as_str(), span) {
            Ok(element) => set_node(rule, element),
            Err(message) => record_decode_err(message),
        }
        Ok(())
    });
    // `.` is llama.cpp's LLAMA_GRETYPE_CHAR_ANY: any single character,
    // newlines included. `[\s\S]` says that without needing a dot-all
    // flag. The `u` flag makes "one character" mean one code point rather
    // than one UTF-16 unit, so `.` consumes an emoji whole and `.{2}`
    // does not accept a single astral character as two.
    parser.action_with_context("@atom-dot", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        let span = span_of(Some(&token));
        set_node(
            rule,
            object(vec![
                ("kind", Some(Value::String("regex".into()))),
                ("pattern", Some(Value::String(r"[\s\S]".into()))),
                ("flags", Some(Value::String("u".into()))),
                ("sp", span),
            ]),
        );
        Ok(())
    });
    // A tokenizer-token terminal. NOT part of the shared IR: the syntax
    // layer produces it so a grammar containing one is not a *syntax*
    // error, and `reject_token_terminals` then rejects it by name.
    parser.action_with_context("@atom-tok", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        let text = token.src.as_str().to_string();
        let negated = text.starts_with('!');
        let span = span_of(Some(&token));
        set_node(
            rule,
            object(vec![
                ("kind", Some(Value::String("tokterm".into()))),
                ("text", Some(Value::String(text))),
                ("negated", Some(Value::Bool(negated))),
                ("sp", span),
            ]),
        );
        Ok(())
    });
    parser.action_with_context("@atom-nm", |rule, _context| {
        let Some(token) = open_token(rule, 0) else {
            return Ok(());
        };
        let name = token.src.as_str().to_string();
        let span = span_of(Some(&token));
        set_node(
            rule,
            object(vec![
                ("kind", Some(Value::String("ref".into()))),
                ("name", Some(Value::String(name))),
                ("sp", span),
            ]),
        );
        Ok(())
    });
    parser.action_with_context("@atom-lp", |rule, context| {
        if MAX_GROUP_DEPTH < rule.d {
            return Err(tabnas::ActionError::new(DEPTH_CODE, DEPTH_MESSAGE));
        }
        // This group becomes the current nesting level: remember the
        // enclosing level's running maximum on THIS rule, so the close
        // can put it back, and start counting the group's contents from
        // nothing.
        let outer = register(context, LEVEL_KEY);
        set_register(context, LEVEL_KEY, 0);
        let span = open_token(rule, 0).and_then(|token| span_of(Some(&token)));
        let bag = rule.u_mut();
        bag.insert("grouped".into(), Value::Bool(true));
        bag.insert("outerMax".into(), Value::Number(outer as f64));
        bag.insert("openSp".into(), span.unwrap_or(Value::Undefined));
        Ok(())
    });
    // Only a group consumes the `)`. Without the condition this
    // alternative would eat the closing paren of the ENCLOSING group
    // after a simple atom: `( "a" )` would lose its `)`.
    parser.alt_condition("@atom-group-c", |rule, _context| {
        matches!(rule.u.get("grouped"), Some(Value::Bool(true)))
    });
    parser.action_with_context("@atom-group-close", |rule, context| {
        // The group nests one deeper than the deepest element it holds.
        // Put the enclosing level's running maximum back before leaving.
        let inner = register(context, LEVEL_KEY);
        let outer = match rule.u.get("outerMax") {
            Some(Value::Number(number)) if 0.0 <= *number => *number as usize,
            _ => 0,
        };
        set_register(context, LEVEL_KEY, outer);
        check_nest(inner + 1)?;
        set_register(context, NEST_KEY, inner + 1);
        let alts = rule.child_node.clone();
        let open = rule
            .u
            .get("openSp")
            .cloned()
            .filter(|value| !value.is_undefined());
        let close = rule.c0().and_then(|token| span_of(Some(token)));
        let span = span_to(open.as_ref(), close.as_ref());
        set_node(
            rule,
            object(vec![
                ("kind", Some(Value::String("group".into()))),
                ("alts", Some(alts)),
                ("sp", span),
            ]),
        );
        Ok(())
    });
}

// ---- the parser instance ---------------------------------------------

/// The engine options the GBNF meta-grammar needs.
fn gbnf_parser_options() -> Options {
    let mut options = Options::default();

    // Clear the JSON-oriented defaults: `{`, `}`, `[`, `]`, `:` and `,`
    // all belong to GBNF terminals that are lexed whole by the match
    // matchers, and must not be stolen a character at a time.
    for retired in ["#OB", "#CB", "#OS", "#CS", "#CL", "#CA"] {
        options.fixed.tokens.shift_remove(retired);
    }

    // Nothing below is GBNF syntax: numbers, quoted strings, barewords
    // and keyword values are all covered by the match tokens, and leaving
    // the default matchers on would let them claim characters the grammar
    // has already spoken for.
    options.number.lex = false;
    options.string.lex = false;
    options.text.lex = false;
    options.value.lex = false;

    // GBNF comments run from `#` to end of line. A `#` inside a string or
    // a character class is never seen by this matcher: both are match
    // tokens, and the match matcher runs before the comment matcher (lex
    // order 1e6 against 6e6).
    options.comment.definitions.shift_remove("slash");
    options.comment.definitions.shift_remove("multi");
    if let Some(hash) = options.comment.definitions.get_mut("hash") {
        hash.line = true;
        hash.start = "#".to_string();
        hash.end = String::new();
        hash.lex = true;
        hash.eat_line = false;
    }

    options.rule.start = "gbnf".to_string();
    options
}

/// Build the GBNF parser instance: a bare engine carrying only the
/// meta-grammar above.
fn build_gbnf_parser() -> Result<Tabnas, String> {
    let mut parser = Tabnas::with_options(gbnf_parser_options());

    // Fixed tokens. GBNF's operators are exact literals.
    for (name, source) in [
        ("#DEF", "::="),
        ("#ALT", "|"),
        ("#LP", "("),
        ("#RP", ")"),
        ("#DOT", "."),
    ] {
        parser.token_with_source(name, source);
    }

    // Match tokens, in the canonical table's order. Each is flagged
    // eager, which opts it out of the lexer's token-column gate: the
    // matcher fires whenever its regex matches, and the parser rejects
    // tokens it did not expect.
    let rep_nc = rep_non_capturing();
    let patterns: [(&str, String); 5] = [
        // A GBNF string literal, captured RAW: the body is decoded by
        // `decode_string`, not by the engine's string matcher, because
        // GBNF's escape set is its own (`\[`, `\]`, `\UXXXXXXXX`) and
        // differs from both JSON's and the engine's default.
        ("#GS", r#"^"(?:\\[\s\S]|[^"\\])*""#.to_string()),
        // A character class, likewise raw: `[^"\\\x7F\x00-\x1F]` is a
        // single terminal, and letting the fixed matcher see its brackets
        // would shred it.
        ("#CC", r"^\[(?:\\[\s\S]|[^\]\\])*\]".to_string()),
        // A RUN of postfix repetition operators, lexed as one token so
        // `elem` stays a two-alternative rule rather than a loop: a
        // close-state loop needs a push or replace on every iteration,
        // and there is no child rule to push for a `*`. Chaining (`x*?`)
        // moves into `apply_postfix`. Whitespace inside the run is
        // llama.cpp-legal: `parse_space` runs after each operator.
        (
            "#POST",
            format!(r"^(?:[*+?]|{rep_nc})(?:{SP}*(?:[*+?]|{rep_nc}))*"),
        ),
        // Tokenizer-token terminal, optionally negated.
        ("#TOK", r"^!?<(?:\\[\s\S]|[^>\\])*>".to_string()),
        // A rule name. llama.cpp's `is_word_char` is `[A-Za-z0-9_-]`, so
        // a name may start with a digit or a dash.
        ("#NM", r"^[A-Za-z0-9_-]+".to_string()),
    ];
    for (name, pattern) in patterns {
        let tin = parser.token(name);
        let regex = Regex::new(&pattern).map_err(|error| format!("gbnf: {name}: {error}"))?;
        parser.options.match_tokens.insert(
            name.to_string(),
            MatchToken {
                name: name.to_string(),
                tin,
                matcher: MatchTokenMatcher::Regex(regex),
                eager: true,
            },
        );
    }

    // Drop the default rules: they would compete with the meta-grammar
    // for the starting token set.
    for name in parser.rule_names() {
        parser.remove_rule(&name);
    }

    register_refs(&mut parser);
    parser
        .grammar_json(GRAMMAR_TEXT)
        .map_err(|error| error.to_string())?;
    Ok(parser)
}

/// The cached GBNF parser instance, built once.
///
/// `Tabnas` parses through `&self` and is `Send + Sync`, so one instance
/// serves every caller and every thread; per-parse state lives on the
/// rules and the context.
fn gbnf_parser() -> Result<&'static Tabnas, String> {
    static PARSER: OnceLock<Result<Tabnas, String>> = OnceLock::new();
    PARSER
        .get_or_init(build_gbnf_parser)
        .as_ref()
        .map_err(String::clone)
}

/// How a raw GBNF parse failed.
pub(crate) enum RawError {
    /// The engine rejected the source.
    Engine(Box<TabnasError>),
    /// The parser itself could not be built, or the source nests past
    /// [`MAX_GROUP_DEPTH`] or [`MAX_NEST_DEPTH`].
    Message(String),
    /// A terminal decoder refused an escape, a class or a repetition
    /// count. Its own wording already names the offender, so it carries
    /// no engine position: `ts/test/cli.test.js` pins that.
    Decode(String),
}

/// Run the meta-grammar over `src` and return the raw production list.
///
/// A terminal decoder's own diagnostic wins over the engine's positional
/// complaint about the token it could not place: the decoder already
/// names the offending escape or class, which is far more use.
pub(crate) fn parse_gbnf_raw(src: &str) -> Result<Vec<Value>, RawError> {
    let parser = gbnf_parser().map_err(RawError::Message)?;
    clear_decode_err();
    let parsed = parser.parse(src);
    let decode_err = taken_decode_err();
    if let Some(message) = decode_err {
        return Err(RawError::Decode(message));
    }
    match parsed {
        Ok(value) => Ok(match value {
            Value::Array(items) => items.as_ref().clone(),
            Value::Undefined | Value::Null => Vec::new(),
            other => vec![other],
        }),
        Err(error) if DEPTH_CODE == error.code => Err(RawError::Message(DEPTH_MESSAGE.to_string())),
        Err(error) if NEST_CODE == error.code => Err(RawError::Message(NEST_MESSAGE.to_string())),
        Err(error) => Err(RawError::Engine(Box::new(error))),
    }
}
