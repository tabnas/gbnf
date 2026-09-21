// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

//! The inverse arrow: grammar IR to GBNF source text. The Rust port of
//! `ts/src/render.ts`, which has no Go counterpart.
//!
//! [`crate::parse_gbnf`] reads GBNF into the notation-neutral IR that
//! `tabnas-bnf` compiles; this module writes the IR back out as GBNF.
//! Because `tabnas-abnf` and the EBNF front-end parse into the SAME IR,
//! the pair gives every front-end a bridge into constrained decoding:
//!
//! ```text
//! ABNF text ──parse_abnf──▶ Grammar IR ──render_gbnf──▶ GBNF text
//! ```
//!
//! Two properties are load-bearing, and the test suite pins both:
//!
//! - **Fixed point.** For a grammar that came from GBNF,
//!   `parse_gbnf(render_gbnf(g))` reproduces `g` exactly: same
//!   productions, same element structure, same class patterns. The
//!   renderer chooses surface spellings (which escape form, where the
//!   parentheses go), never meanings.
//! - **Faithful or refused.** IR constructs GBNF cannot express, an
//!   engine lexer token, an ABNF prose element, a regular expression that
//!   is not a character class, raise [`GbnfRenderError`] rather than
//!   being approximated. A case-INSENSITIVE literal is the one construct
//!   with an exact GBNF encoding, and it is expanded rather than refused:
//!   `"hi"` (ABNF, insensitive) becomes `[hH] [iI]`, which accepts
//!   precisely the same strings. Silently changing the accepted language
//!   is the failure mode this crate exists to prevent, on the way out
//!   exactly as on the way in.

use std::fmt;

use indexmap::IndexSet;
use tabnas_bnf::{Element, Grammar, Kind, Sequence};

/// Raised when the IR does not describe a grammar GBNF can express.
/// `rule` names the production being rendered when one is in scope.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct GbnfRenderError {
    /// The rendered diagnostic, always prefixed `gbnf: `.
    pub message: String,
    /// The production being rendered when the refusal was raised.
    pub rule: Option<String>,
}

impl GbnfRenderError {
    fn new(message: impl Into<String>, rule: Option<&str>) -> Self {
        Self {
            message: message.into(),
            rule: rule.map(str::to_string),
        }
    }
}

impl fmt::Display for GbnfRenderError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for GbnfRenderError {}

/// Options for [`render_gbnf`].
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct GbnfRenderOptions {
    /// The production a synthesized `root` should reference when the
    /// grammar has no rule named `root`. Defaults to the first
    /// production. Ignored when `root` exists.
    pub start: Option<String>,
}

impl GbnfRenderOptions {
    /// Options naming the synthesized start rule.
    pub fn start(start: impl Into<String>) -> Self {
        Self {
            start: Some(start.into()),
        }
    }
}

/// llama.cpp's `is_word_char` set, the only names GBNF can spell. Spelled
/// out as ASCII: `char::is_alphanumeric` is Unicode-aware, and a rule
/// named `caf\u{e9}` is not a legal GBNF name however friendly it looks.
fn is_legal_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b'_' == byte || b'-' == byte)
}

// ---- terminal spelling -----------------------------------------------

/// One character inside a `"…"` string literal. `"` and `\` must be
/// escaped; the C0 controls get their short escapes or `\xXX`; DEL and
/// the C1 range are escaped for legibility; everything else, `[`, `]`,
/// non-ASCII, astral, is legal raw inside a literal and stays itself.
fn literal_char(cp: u32) -> String {
    match char::from_u32(cp) {
        Some('"') => return "\\\"".to_string(),
        Some('\\') => return "\\\\".to_string(),
        Some('\n') => return "\\n".to_string(),
        Some('\r') => return "\\r".to_string(),
        Some('\t') => return "\\t".to_string(),
        _ => {}
    }
    if cp < 0x20 || (0x7F..=0x9F).contains(&cp) {
        return format!("\\x{cp:02X}");
    }
    char::from_u32(cp).map(String::from).unwrap_or_default()
}

fn quote_literal(text: &str) -> String {
    let mut out = String::from("\"");
    for character in text.chars() {
        out.push_str(&literal_char(character as u32));
    }
    out.push('"');
    out
}

/// One character inside a `[…]` class. The class metacharacters go
/// through escapes GBNF actually has: `\]`, `\[` and `\\` exist, but
/// there is no `\-` and no `\^`, so the hyphen and the caret are spelled
/// as code-point escapes. A raw `-` is a range operator by position,
/// where the escape is a member wherever it appears. Astral code points
/// force the 8-digit form, since `\uXXXX` cannot reach them.
fn class_char(cp: u32) -> String {
    match char::from_u32(cp) {
        Some(']') => return "\\]".to_string(),
        Some('[') => return "\\[".to_string(),
        Some('\\') => return "\\\\".to_string(),
        Some('-') => return "\\u002D".to_string(),
        Some('^') => return "\\u005E".to_string(),
        Some('\n') => return "\\n".to_string(),
        Some('\r') => return "\\r".to_string(),
        Some('\t') => return "\\t".to_string(),
        _ => {}
    }
    if cp < 0x20 || (0x7F..=0x9F).contains(&cp) {
        return format!("\\x{cp:02X}");
    }
    if 0xFFFF < cp {
        return format!("\\U{cp:08X}");
    }
    char::from_u32(cp).map(String::from).unwrap_or_default()
}

// ---- reading a class pattern back ------------------------------------

/// One member of a class: a single code point when `lo == hi`, a range
/// otherwise.
struct ClassItem {
    lo: u32,
    hi: u32,
}

struct ClassPattern {
    negated: bool,
    items: Vec<ClassItem>,
}

/// The regular-expression elements the BNF-family front-ends emit are
/// character classes whose members are spelled as escapes (`[a-z]`) or
/// safe literal characters, plus `[\s\S]` as the lowering of `.`. This
/// reads that shape back into members and ranges; anything else is not a
/// class, and is refused rather than guessed at.
fn read_class_pattern(pattern: &str) -> Option<ClassPattern> {
    let chars: Vec<char> = pattern.chars().collect();
    if chars.first() != Some(&'[') || chars.last() != Some(&']') {
        return None;
    }

    let mut i = 1usize;
    let end = chars.len() - 1;
    let mut negated = false;
    if chars.get(i) == Some(&'^') {
        negated = true;
        i += 1;
    }

    fn read_one(chars: &[char], i: &mut usize) -> Option<u32> {
        let first = *chars.get(*i)?;
        if '\\' != first {
            *i += 1;
            return Some(first as u32);
        }
        let mark = *chars.get(*i + 1)?;
        if 'u' == mark {
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
            if !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
                return None;
            }
            *i += 6;
            return u32::from_str_radix(&hex, 16).ok();
        }
        if 'x' == mark {
            if chars.len() < *i + 4 {
                return None;
            }
            let hex: String = chars[*i + 2..*i + 4].iter().collect();
            if !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
                return None;
            }
            *i += 4;
            return u32::from_str_radix(&hex, 16).ok();
        }
        let simple = match mark {
            'n' => Some('\n'),
            'r' => Some('\r'),
            't' => Some('\t'),
            'f' => Some('\u{c}'),
            'v' => Some('\u{b}'),
            '0' => Some('\0'),
            _ => None,
        };
        if let Some(simple) = simple {
            *i += 2;
            return Some(simple as u32);
        }
        // An identity escape (`\]`, `\-`, `\\`, …). A class shorthand
        // like `\d` or `\w` is NOT identity: refuse those rather than
        // turning them into the literal letter. ASCII alphanumerics, not
        // `char::is_alphanumeric`, which would let a Unicode letter
        // through as a shorthand and refuse it.
        if !(mark.is_ascii_alphanumeric()) {
            *i += 2;
            return Some(mark as u32);
        }
        None
    }

    let mut items: Vec<ClassItem> = Vec::new();
    while i < end {
        let lo = read_one(&chars, &mut i)?;
        // `-` right before `]` is a literal member, matching how the
        // class was decoded on the way in.
        if chars.get(i) == Some(&'-') && i + 1 < end {
            i += 1;
            let hi = read_one(&chars, &mut i)?;
            if hi < lo {
                return None;
            }
            items.push(ClassItem { lo, hi });
        } else {
            items.push(ClassItem { lo, hi: lo });
        }
    }

    if items.is_empty() {
        None
    } else {
        Some(ClassPattern { negated, items })
    }
}

// ---- elements --------------------------------------------------------

/// How a rendered fragment composes: an `Atom` can take a postfix
/// operator directly, a `Postfix` already carries one (chaining is legal,
/// `x*?` is `(x*)?`), and a `Seq` needs parentheses first.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Form {
    Atom,
    Postfix,
    Seq,
}

struct Fragment {
    text: String,
    form: Form,
}

/// Expand a case-insensitive literal into an exactly-equivalent GBNF
/// sequence: cased letters become two-member classes, runs of caseless
/// characters stay literal chunks. `"a-c"` becomes `[aA] "-" [cC]`.
///
/// Only ASCII letters fold. A non-ASCII character whose upper and lower
/// case differ has no single obviously-right expansion (one-to-many
/// mappings, locale rules), so it is refused. RFC 5234's quoted strings
/// are ASCII anyway.
fn insensitive_fragments(literal: &str, rule: &str) -> Result<Vec<String>, GbnfRenderError> {
    let mut parts: Vec<String> = Vec::new();
    let mut chunk = String::new();
    for character in literal.chars() {
        if character.is_ascii_alphabetic() {
            if !chunk.is_empty() {
                parts.push(quote_literal(&chunk));
                chunk.clear();
            }
            parts.push(format!(
                "[{}{}]",
                character.to_ascii_lowercase(),
                character.to_ascii_uppercase()
            ));
        } else if character.to_lowercase().to_string() != character.to_uppercase().to_string() {
            return Err(GbnfRenderError::new(
                format!(
                    "gbnf: rule '{rule}' has a case-insensitive literal containing \
                     '{character}' (U+{:X}), which has no exact case-insensitive \
                     expansion in GBNF. Use a case-sensitive literal, or spell the \
                     alternatives as a character class.",
                    character as u32
                ),
                Some(rule),
            ));
        } else {
            chunk.push(character);
        }
    }
    if !chunk.is_empty() {
        parts.push(quote_literal(&chunk));
    }
    Ok(parts)
}

fn render_class(pattern: &str, rule: &str) -> Result<Fragment, GbnfRenderError> {
    // `.` lowers to `[\s\S]` on the way in; recover it on the way out.
    if r"[\s\S]" == pattern {
        return Ok(Fragment {
            text: ".".to_string(),
            form: Form::Atom,
        });
    }

    let Some(class) = read_class_pattern(pattern) else {
        return Err(GbnfRenderError::new(
            format!(
                "gbnf: rule '{rule}' has a regex terminal /{pattern}/ that is not a \
                 character class. GBNF's only regex-shaped terminal is […], so this \
                 grammar cannot be rendered faithfully."
            ),
            Some(rule),
        ));
    };

    let mut out = String::from("[");
    if class.negated {
        out.push('^');
    }
    for item in &class.items {
        if item.lo == item.hi {
            out.push_str(&class_char(item.lo));
        } else {
            out.push_str(&class_char(item.lo));
            out.push('-');
            out.push_str(&class_char(item.hi));
        }
    }
    out.push(']');
    Ok(Fragment {
        text: out,
        form: Form::Atom,
    })
}

fn render_element(element: &Element, rule: &str) -> Result<Option<Fragment>, GbnfRenderError> {
    match &element.kind {
        Kind::Term {
            literal,
            case_sensitive,
            ..
        } => {
            // An empty literal denotes zero characters and contributes no
            // element: the same reading `parse_gbnf` gives `""`.
            if literal.is_empty() {
                return Ok(None);
            }
            if Some(true) == *case_sensitive {
                return Ok(Some(Fragment {
                    text: quote_literal(literal),
                    form: Form::Atom,
                }));
            }
            let parts = insensitive_fragments(literal, rule)?;
            Ok(match parts.len() {
                0 => None,
                1 => Some(Fragment {
                    text: parts[0].clone(),
                    form: Form::Atom,
                }),
                _ => Some(Fragment {
                    text: parts.join(" "),
                    form: Form::Seq,
                }),
            })
        }

        Kind::Ref { name, .. } => {
            if !is_legal_name(name) {
                return Err(GbnfRenderError::new(
                    format!(
                        "gbnf: rule '{rule}' references '{name}', which is not a legal \
                         GBNF rule name ([A-Za-z0-9_-]+)."
                    ),
                    Some(rule),
                ));
            }
            Ok(Some(Fragment {
                text: name.clone(),
                form: Form::Atom,
            }))
        }

        Kind::Regex { pattern, .. } => render_class(pattern, rule).map(Some),

        Kind::Group { alts } => Ok(Some(Fragment {
            text: format!("({})", render_alts(alts, rule)?),
            form: Form::Atom,
        })),

        Kind::Opt { .. } | Kind::Star { .. } | Kind::Plus { .. } | Kind::Rep { .. } => {
            let inner_element = match &element.kind {
                Kind::Opt { inner }
                | Kind::Star { inner, .. }
                | Kind::Plus { inner }
                | Kind::Rep { inner, .. } => inner.as_ref(),
                _ => unreachable!("the arm above matches only the repetition kinds"),
            };
            let Some(inner) = render_element(inner_element, rule)? else {
                return Err(GbnfRenderError::new(
                    format!(
                        "gbnf: rule '{rule}' repeats an empty literal, which matches \
                         nothing and cannot carry a repetition."
                    ),
                    Some(rule),
                ));
            };
            let operator = match &element.kind {
                Kind::Opt { .. } => "?".to_string(),
                Kind::Star { .. } => "*".to_string(),
                Kind::Plus { .. } => "+".to_string(),
                Kind::Rep { min, max, .. } => match max {
                    Some(max) if max == min => format!("{{{min}}}"),
                    Some(max) => format!("{{{min},{max}}}"),
                    None => format!("{{{min},}}"),
                },
                _ => unreachable!("the arm above matches only the repetition kinds"),
            };
            let body = if Form::Seq == inner.form {
                format!("({})", inner.text)
            } else {
                inner.text
            };
            Ok(Some(Fragment {
                text: format!("{body}{operator}"),
                form: Form::Postfix,
            }))
        }

        // The two IR kinds with no GBNF meaning. A token is a reference
        // to the ENGINE's lexer (ABNF grammars may lean on it); prose is
        // ABNF's <free text> element. Refuse both: an approximation would
        // silently change the accepted language.
        Kind::Token { name } => Err(GbnfRenderError::new(
            format!(
                "gbnf: rule '{rule}' uses the engine lexer token '{name}'. GBNF has no \
                 lexical level, so there is no faithful rendering; define the token's \
                 language as a rule instead."
            ),
            Some(rule),
        )),
        Kind::Prose { text } => Err(GbnfRenderError::new(
            format!(
                "gbnf: rule '{rule}' contains the prose element <{text}>, which describes \
                 a language informally and cannot be rendered as GBNF."
            ),
            Some(rule),
        )),
    }
}

fn render_seq(seq: &Sequence, rule: &str) -> Result<String, GbnfRenderError> {
    let mut parts: Vec<String> = Vec::new();
    for element in seq {
        if let Some(fragment) = render_element(element, rule)? {
            parts.push(fragment.text);
        }
    }
    Ok(parts.join(" "))
}

/// An empty alternative renders as nothing between the pipes,
/// `ws ::= | " "`, exactly the shape llama.cpp's own json.gbnf uses.
fn render_alts(alts: &[Sequence], rule: &str) -> Result<String, GbnfRenderError> {
    let mut parts: Vec<String> = Vec::new();
    for alt in alts {
        parts.push(render_seq(alt, rule)?);
    }
    Ok(parts.join(" | "))
}

// ---- grammar ---------------------------------------------------------

/// Render a grammar IR as GBNF source.
///
/// GBNF requires a `root` rule. When the grammar has one it is used as
/// is; when it does not, a `root ::= <start>` production is prepended,
/// referencing `opts.start` or the first production. That addition is the
/// one place the output says more than the input: every other production
/// renders one to one.
///
/// ```
/// let grammar = tabnas_gbnf::parse_gbnf("root ::= \"a\"* | [b-d]").unwrap();
/// let text = tabnas_gbnf::render_gbnf(&grammar, None).unwrap();
/// assert_eq!(text, "root ::= \"a\"* | [b-d]\n");
/// ```
pub fn render_gbnf(
    grammar: &Grammar,
    opts: Option<&GbnfRenderOptions>,
) -> Result<String, GbnfRenderError> {
    let productions = &grammar.productions;
    if productions.is_empty() {
        return Err(GbnfRenderError::new("gbnf: no productions to render", None));
    }

    let mut seen: IndexSet<String> = IndexSet::new();
    for production in productions {
        if !is_legal_name(&production.name) {
            return Err(GbnfRenderError::new(
                format!(
                    "gbnf: production '{}' is not a legal GBNF rule name ([A-Za-z0-9_-]+).",
                    production.name
                ),
                Some(&production.name),
            ));
        }
        // GBNF's duplicate semantics are last-wins REPLACEMENT, so two
        // productions with one name cannot both survive a round trip.
        // Front-ends merge their incremental forms (ABNF `=/`) before the
        // IR gets here; a duplicate reaching this point is ill-formed.
        if !seen.insert(production.name.clone()) {
            return Err(GbnfRenderError::new(
                format!(
                    "gbnf: duplicate production '{}'. GBNF replaces a redefined rule, so \
                     rendering both would change the grammar.",
                    production.name
                ),
                Some(&production.name),
            ));
        }
    }

    let mut lines: Vec<String> = Vec::new();

    if !seen.contains("root") {
        let start = opts
            .and_then(|opts| opts.start.clone())
            .unwrap_or_else(|| productions[0].name.clone());
        if !seen.contains(&start) {
            return Err(GbnfRenderError::new(
                format!(
                    "gbnf: start rule '{start}' is not defined, so no 'root' can be \
                     synthesized for it."
                ),
                Some(&start),
            ));
        }
        lines.push(format!("root ::= {start}"));
    }

    for production in productions {
        lines.push(format!(
            "{} ::= {}",
            production.name,
            render_alts(&production.alts, &production.name)?
        ));
    }

    Ok(lines.join("\n") + "\n")
}
