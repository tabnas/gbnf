// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

//! GBNF's terminals and its postfix repetition, decoded into the shared
//! IR. The Rust port of the `Terminals` and `Repetition` sections of
//! `ts/src/converter.ts`.
//!
//! Every diagnostic here is the canonical wording, prefix included, and
//! every one of them names the terminal it came from: a decoder failure
//! is the error a GBNF author hits most, and the offending escape is
//! what makes it actionable.

use std::sync::OnceLock;

use regex::Regex;
use tabnas::Value;

use crate::parser_gbnf::{object, rep_capturing};

/// The GBNF escape set, exactly as llama.cpp's `parse_char` reads it:
/// `\t \r \n \\ \" \[ \] \-`. Anything outside this and the hex family
/// is an error there and here. A silently copied unknown escape would
/// change the accepted language. `\-` is a literal hyphen, in a string or
/// a class alike; a class reads it as a member, never as a range operator.
fn simple_escape(mark: char) -> Option<char> {
    match mark {
        't' => Some('\t'),
        'r' => Some('\r'),
        'n' => Some('\n'),
        '\\' => Some('\\'),
        '"' => Some('"'),
        '[' => Some('['),
        ']' => Some(']'),
        '-' => Some('-'),
        _ => None,
    }
}

/// `\xXX`, `\uXXXX`, `\UXXXXXXXX`, by digit count.
fn hex_escape(mark: char) -> Option<usize> {
    match mark {
        'x' => Some(2),
        'u' => Some(4),
        'U' => Some(8),
        _ => None,
    }
}

/// Read one character, plain or escaped, starting at byte offset `i`.
/// Returns the code point and the offset just past it. `whole` is only
/// used to build an error message that shows the terminal the character
/// came from.
///
/// Byte offsets, with UTF-8 decoding for the plain case, are the Rust
/// equivalent of the canonical `codePointAt` plus the surrogate-pair
/// step: both advance by exactly one code point.
pub(crate) fn read_char(whole: &str, i: usize) -> Result<(u32, usize), String> {
    let rest = &whole[i..];
    let mut chars = rest.chars();
    let Some(first) = chars.next() else {
        return Err(format!("gbnf: trailing backslash in terminal {whole}"));
    };
    if first != '\\' {
        return Ok((first as u32, i + first.len_utf8()));
    }

    let Some(mark) = chars.next() else {
        return Err(format!("gbnf: trailing backslash in terminal {whole}"));
    };

    if let Some(simple) = simple_escape(mark) {
        return Ok((simple as u32, i + 1 + mark.len_utf8()));
    }

    let Some(digits) = hex_escape(mark) else {
        return Err(format!(
            "gbnf: unknown escape '\\{mark}' in terminal {whole}. GBNF escapes are \
             \\t \\r \\n \\\\ \\\" \\[ \\] \\- \\xXX \\uXXXX \\UXXXXXXXX."
        ));
    };

    // The escape body is ASCII hex or it is not an escape body at all, so
    // a byte slice is exact here; a shorter tail is reported as a short
    // escape, which is what it is.
    let body_start = i + 1 + mark.len_utf8();
    let bytes = whole.as_bytes();
    let body_end = (body_start + digits).min(bytes.len());
    let hex = &whole[body_start..body_end];
    if hex.len() < digits || !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(format!(
            "gbnf: escape '\\{mark}' in terminal {whole} needs {digits} hex digits, \
             found '{hex}'"
        ));
    }
    let cp = u32::from_str_radix(hex, 16).unwrap_or(u32::MAX);
    if 0x10FFFF < cp {
        return Err(format!(
            "gbnf: escape '\\{mark}{hex}' in terminal {whole} is {cp}, which is not a \
             Unicode code point (the maximum is \\U0010FFFF)"
        ));
    }
    // A surrogate is returned as it was written. It is the CALLER's to
    // judge: inside a string literal a high surrogate followed by a low
    // one is a pair naming one astral character, which is how the
    // canonical UTF-16 front-end reads it, and only a surrogate left
    // unpaired has no character to name. See `decode_string`.
    Ok((cp, body_start + digits))
}

/// Whether `cp` is either half of a UTF-16 surrogate pair.
fn is_surrogate(cp: u32) -> bool {
    (0xD800..=0xDFFF).contains(&cp)
}

/// Whether `cp` is the leading half of a UTF-16 surrogate pair.
fn is_high_surrogate(cp: u32) -> bool {
    (0xD800..=0xDBFF).contains(&cp)
}

/// Whether `cp` is the trailing half of a UTF-16 surrogate pair.
fn is_low_surrogate(cp: u32) -> bool {
    (0xDC00..=0xDFFF).contains(&cp)
}

/// The astral code point a surrogate pair names, by the UTF-16 rule.
fn combine_surrogates(high: u32, low: u32) -> u32 {
    0x10000 + ((high - 0xD800) << 10) + (low - 0xDC00)
}

/// The diagnostic for a surrogate with no partner. A DIVERGENCE,
/// recorded in DIVERGENCE.md: a JavaScript string is UTF-16 code units,
/// so `String.fromCodePoint(0xD800)` answers a lone surrogate and the
/// canonical front-end carries it through as a one-unit literal. A Rust
/// `String` holds Unicode scalar values and cannot, and neither can the
/// `regex` crate's character classes, so the escape is refused BY NAME
/// rather than silently replaced with U+FFFD the way the Go port does.
pub(crate) fn lone_surrogate(cp: u32, whole: &str) -> String {
    format!(
        "gbnf: escape for U+{cp:04X} in terminal {whole} is an unpaired surrogate code \
         point, which this runtime cannot represent in a string. Write the character \
         itself, or the pair of escapes that names it."
    )
}

/// Decode a raw `"…"` literal into the string it denotes.
pub(crate) fn decode_string(raw: &str) -> Result<String, String> {
    let mut out = String::new();
    let end = raw.len().saturating_sub(1);
    let mut i = 1;
    while i < end {
        let (cp, next) = read_char(raw, i)?;
        i = next;
        // A surrogate PAIR names one astral character. The canonical
        // front-end gets this for nothing, because it appends UTF-16 code
        // units to a UTF-16 string and the pair simply is that character;
        // a Rust `String` has to combine the halves explicitly, or
        // `"\uD83D\uDE00"` would be two refusals where TypeScript has
        // one emoji.
        if is_high_surrogate(cp) && i < end {
            if let Ok((low, after)) = read_char(raw, i) {
                if is_low_surrogate(low) {
                    let combined = combine_surrogates(cp, low);
                    out.push(char::from_u32(combined).ok_or_else(|| {
                        format!(
                            "gbnf: terminal {raw} names U+{combined:04X}, which is not a character"
                        )
                    })?);
                    i = after;
                    continue;
                }
            }
        }
        out.push(char::from_u32(cp).ok_or_else(|| lone_surrogate(cp, raw))?);
    }
    Ok(out)
}

/// Spell one code point as it appears inside an emitted character class.
///
/// `\uXXXX` below the BMP ceiling and `\u{…}` above it, exactly as the
/// canonical front-end spells them. The `regex` crate reads both, so
/// unlike the Go port there is no `\x{…}` translation here and the
/// emitted pattern is byte-identical to the TypeScript one.
pub(crate) fn class_escape(cp: u32) -> String {
    if 0xFFFF < cp {
        format!("\\u{{{cp:x}}}")
    } else {
        format!("\\u{cp:04x}")
    }
}

/// Decode a raw `[…]` character class into an IR `regex` element.
///
/// The class is re-emitted rather than passed through: GBNF and the
/// regular-expression dialects agree on `[`, `]`, `^` and `-` and on
/// nothing else, so a verbatim copy would hand the matcher a pattern in
/// which `\d`, `\b` or a stray `$` mean something GBNF never said. Every
/// member is written back as a `\uXXXX` (or `\u{…}`) escape, which has
/// exactly one meaning inside a character class and needs no further
/// quoting.
pub(crate) fn decode_char_class(raw: &str, sp: Option<Value>) -> Result<Value, String> {
    let bytes = raw.as_bytes();
    let end = raw.len().saturating_sub(1);
    let mut i = 1;

    let mut negated = false;
    if bytes.get(i) == Some(&b'^') {
        negated = true;
        i += 1;
    }

    let mut parts = String::new();
    let mut members = 0usize;
    let mut astral = false;

    while i < end {
        let (lo, next) = read_char(raw, i)?;
        i = next;
        // A surrogate is refused HERE rather than combined. The canonical
        // front-end reads a class member at a time too, so `[\uD83D\uDE00]`
        // is two members there, not one emoji: pairing would change the
        // accepted language. What cannot be carried is the member itself,
        // so it is named. DIVERGENCE.md 1.
        if is_surrogate(lo) {
            return Err(lone_surrogate(lo, raw));
        }
        // `-` immediately before the closing bracket is a literal hyphen,
        // not a range operator: llama.cpp checks `pos[1] != ']'` the same
        // way, which is what makes `[-+*/]` in its own arithmetic.gbnf a
        // four-member class rather than a syntax error.
        if bytes.get(i) == Some(&b'-') && i + 1 < end {
            let (hi, next) = read_char(raw, i + 1)?;
            i = next;
            if is_surrogate(hi) {
                return Err(lone_surrogate(hi, raw));
            }
            if hi < lo {
                return Err(format!(
                    "gbnf: character class {raw} has a descending range (U+{:X} to U+{:X})",
                    lo, hi
                ));
            }
            astral = astral || 0xFFFF < lo || 0xFFFF < hi;
            parts.push_str(&class_escape(lo));
            parts.push('-');
            parts.push_str(&class_escape(hi));
        } else {
            astral = astral || 0xFFFF < lo;
            parts.push_str(&class_escape(lo));
        }
        members += 1;
    }

    if 0 == members {
        return Err(format!("gbnf: empty character class {raw} matches nothing"));
    }

    let pattern = format!("[{}{}]", if negated { "^" } else { "" }, parts);
    // Unicode mode is decided by what the matcher can MATCH, not by what
    // was written in the class. A negated class matches the complement of
    // its members, and that complement always contains every astral code
    // point, so `[^\n]` needs `u` just as much as a class with an astral
    // member does. GBNF terminals are Unicode code points by definition.
    let flags = if negated || astral { "u" } else { "" };
    Ok(object(vec![
        ("kind", Some(Value::String("regex".into()))),
        ("pattern", Some(Value::String(pattern))),
        ("flags", Some(Value::String(flags.into()))),
        ("sp", sp),
    ]))
}

// ---- repetition ------------------------------------------------------

/// The individual operators within a postfix run, left to right.
fn operator_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(&format!(r"[*+?]|{}", rep_capturing()))
            .expect("the postfix operator pattern is valid")
    })
}

/// How a run of postfix operators failed.
pub(crate) enum PostfixError {
    /// A repetition count the notation does not allow. Carries its own
    /// wording, which names the offending operator.
    Decode(String),
    /// The run would nest the IR past what this front-end will build.
    TooDeep,
}

/// Apply a run of postfix operators, left to right, so `x*?` is `(x*)?`:
/// the same order llama.cpp's sequence loop applies them in.
///
/// `depth` is the nesting depth of `item` on the way in and of the
/// answer on the way out, and no operator is applied that would take it
/// past `max`. The count is kept HERE, as each wrapper is built, rather
/// than measured afterwards: a run is one token however long it is, so a
/// source of thousands of operators would otherwise have built the whole
/// tower before anything could look at it, and the walks over that tower
/// (the deserialization into the typed IR, the compiler's passes, the
/// renderer, and the value's own drop) all recurse.
///
/// Only an operator that really wraps counts. `{1}` is `{1,1}`, which
/// `repeat` answers with its argument unchanged, so a run of them nests
/// nothing and is not refused.
pub(crate) fn apply_postfix(
    item: Value,
    src: &str,
    depth: &mut usize,
    max: usize,
) -> Result<Value, PostfixError> {
    // One more level, refused rather than built when it would pass `max`.
    fn deeper(depth: &mut usize, max: usize) -> Result<(), PostfixError> {
        *depth += 1;
        if max < *depth {
            return Err(PostfixError::TooDeep);
        }
        Ok(())
    }

    let mut out = item;
    for captures in operator_pattern().captures_iter(src) {
        let whole = captures.get(0).map_or("", |found| found.as_str());
        match whole.as_bytes().first() {
            Some(b'*') => {
                deeper(depth, max)?;
                out = wrap("star", out);
            }
            Some(b'+') => {
                deeper(depth, max)?;
                out = wrap("plus", out);
            }
            Some(b'?') => {
                deeper(depth, max)?;
                out = wrap("opt", out);
            }
            _ => {
                let min: f64 = captures
                    .get(1)
                    .and_then(|found| found.as_str().parse().ok())
                    .unwrap_or(0.0);
                // `{m}` (no comma) is exactly m; `{m,}` is m or more;
                // `{m,n}` is the closed range. A capture group that did
                // not participate is `None`, which is what tells `{3}`
                // from `{3,}` without re-reading the source.
                let upper = match captures.get(2) {
                    None => min,
                    Some(found) if found.as_str().is_empty() => f64::INFINITY,
                    Some(found) => found.as_str().parse().unwrap_or(0.0),
                };
                // The count is validated BEFORE the depth is charged, so
                // a grammar that is both too deep and malformed still
                // gets the canonical diagnostic for the malformed count.
                out = repeat(out, min, upper, whole).map_err(PostfixError::Decode)?;
                // `{1}` is `{1,1}`, which `repeat` answers with its
                // argument unchanged: it wraps nothing, so it nests
                // nothing. Asked here rather than by comparing the
                // answer with its input, which would be a deep
                // comparison per operator.
                if !(1.0 == min && 1.0 == upper) {
                    deeper(depth, max)?;
                }
            }
        }
    }
    Ok(out)
}

fn wrap(kind: &str, inner: Value) -> Value {
    object(vec![
        ("kind", Some(Value::String(kind.into()))),
        ("inner", Some(inner)),
    ])
}

/// Lower a repetition count onto the IR. `star` / `plus` / `opt` are the
/// shapes the shared compiler desugars into paired helper rules; `rep`
/// covers everything else. An unbounded upper limit is spelled
/// `Infinity`, the same sentinel `*` and `1*` lower to: the compiler's
/// `rep` branch tests for it to choose a star tail over nested optionals,
/// so a large finite number here would unroll into that many helper rules
/// instead.
pub(crate) fn repeat(inner: Value, min: f64, max: f64, src: &str) -> Result<Value, String> {
    if max < min {
        return Err(format!(
            "gbnf: repetition {src} has an upper bound below its lower bound"
        ));
    }
    if 1.0 == min && 1.0 == max {
        return Ok(inner);
    }
    if 0.0 == min && max.is_infinite() {
        return Ok(wrap("star", inner));
    }
    if 1.0 == min && max.is_infinite() {
        return Ok(wrap("plus", inner));
    }
    if 0.0 == min && 1.0 == max {
        return Ok(wrap("opt", inner));
    }
    Ok(object(vec![
        ("kind", Some(Value::String("rep".into()))),
        ("min", Some(Value::Number(min))),
        ("max", Some(Value::Number(max))),
        ("inner", Some(inner)),
    ]))
}
