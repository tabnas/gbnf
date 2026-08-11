/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

/*  render.ts
 *  The inverse arrow: grammar IR -> GBNF source text.
 *
 *  `parseGbnf` reads GBNF into the notation-neutral IR that
 *  `@tabnas/bnf` compiles; this file writes the IR back out as GBNF.
 *  Because `@tabnas/abnf` and `@tabnas/ebnf` parse into the SAME IR,
 *  the pair gives every front-end a bridge into constrained decoding:
 *
 *    ABNF text ──parseAbnf──▶ Grammar IR ──renderGbnf──▶ GBNF text
 *
 *  Two properties are load-bearing, and the test suite pins both:
 *
 *  - **Fixed point.** For a grammar that came from GBNF,
 *    `parseGbnf(renderGbnf(g))` reproduces `g` exactly — same
 *    productions, same element structure, same class patterns. The
 *    renderer chooses surface spellings (which escape form, where the
 *    parentheses go), never meanings.
 *  - **Faithful or refused.** IR constructs GBNF cannot express — an
 *    engine lexer token, an ABNF prose element, a regex that is not a
 *    character class — raise `GbnfRenderError` rather than being
 *    approximated. A case-INSENSITIVE literal is the one construct
 *    with an exact GBNF encoding, and it is expanded rather than
 *    refused: `"hi"` (ABNF, insensitive) becomes `[hH] [iI]`, which
 *    accepts precisely the same strings. Silently changing the
 *    accepted language is the failure mode this package exists to
 *    prevent, on the way out exactly as on the way in.
 */

import type { Element, Sequence, Grammar } from '@tabnas/bnf'


// Raised when the IR does not describe a grammar GBNF can express.
// `rule` names the production being rendered when one is in scope.
class GbnfRenderError extends Error {
  readonly rule?: string
  constructor(message: string, rule?: string) {
    super(message)
    this.name = 'GbnfRenderError'
    this.rule = rule
  }
}


type GbnfRenderOptions = {
  // The production a synthesized `root` should reference when the
  // grammar has no rule named `root`. Defaults to the first
  // production. Ignored when `root` exists.
  start?: string
}


// llama.cpp's is_word_char set — the only names GBNF can spell.
const NAME_RE = /^[A-Za-z0-9_-]+$/


// ---- Terminal spelling ----------------------------------------------

// One character inside a "…" string literal. `"` and `\` must be
// escaped; the C0 controls get their short escapes or `\xXX`; DEL and
// the C1 range are escaped for legibility; everything else — `[`, `]`,
// non-ASCII, astral — is legal raw inside a literal and stays itself.
function literalChar(cp: number): string {
  const c = String.fromCodePoint(cp)
  if (c === '"') return '\\"'
  if (c === '\\') return '\\\\'
  if (c === '\n') return '\\n'
  if (c === '\r') return '\\r'
  if (c === '\t') return '\\t'
  if (cp < 0x20 || (0x7f <= cp && cp <= 0x9f)) {
    return '\\x' + cp.toString(16).toUpperCase().padStart(2, '0')
  }
  return c
}

function quoteLiteral(text: string): string {
  let out = '"'
  for (const c of text) out += literalChar(c.codePointAt(0) as number)
  return out + '"'
}

// One character inside a […] class. The class metacharacters go
// through escapes GBNF actually has: `\]` `\[` `\\` exist, but there
// is no `\-` and no `\^`, so the hyphen and the caret are spelled as
// code-point escapes — `-` is a member wherever it appears, where
// a raw `-` is a range operator by position. Astral code points force
// the 8-digit form, since `\uXXXX` cannot reach them.
function classChar(cp: number): string {
  const c = String.fromCodePoint(cp)
  if (c === ']') return '\\]'
  if (c === '[') return '\\['
  if (c === '\\') return '\\\\'
  if (c === '-') return '\\u002D'
  if (c === '^') return '\\u005E'
  if (c === '\n') return '\\n'
  if (c === '\r') return '\\r'
  if (c === '\t') return '\\t'
  if (cp < 0x20 || (0x7f <= cp && cp <= 0x9f)) {
    return '\\x' + cp.toString(16).toUpperCase().padStart(2, '0')
  }
  if (0xffff < cp) {
    return '\\U' + cp.toString(16).toUpperCase().padStart(8, '0')
  }
  return c
}


// ---- Reading a class pattern back -----------------------------------

// The regex elements the BNF-family front-ends emit are character
// classes whose members are spelled as escapes (`[a-z]`) or
// safe literal characters, plus `[\s\S]` as the lowering of `.`. This
// reads that shape back into members and ranges; anything else is not
// a class, and is refused rather than guessed at.
type ClassItem = { lo: number; hi: number }

function readClassPattern(
  pattern: string,
): { negated: boolean; items: ClassItem[] } | null {
  if (pattern[0] !== '[' || pattern[pattern.length - 1] !== ']') return null

  let i = 1
  const end = pattern.length - 1
  let negated = false
  if (pattern[i] === '^') {
    negated = true
    i++
  }

  const readOne = (): number | null => {
    if (pattern[i] !== '\\') {
      const cp = pattern.codePointAt(i) as number
      i += 0xffff < cp ? 2 : 1
      return cp
    }
    const mark = pattern[i + 1]
    if (mark === 'u') {
      if (pattern[i + 2] === '{') {
        const close = pattern.indexOf('}', i + 3)
        if (close < 0) return null
        const cp = parseInt(pattern.slice(i + 3, close), 16)
        i = close + 1
        return Number.isFinite(cp) ? cp : null
      }
      const hex = pattern.slice(i + 2, i + 6)
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null
      i += 6
      return parseInt(hex, 16)
    }
    if (mark === 'x') {
      const hex = pattern.slice(i + 2, i + 4)
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) return null
      i += 4
      return parseInt(hex, 16)
    }
    const simple: Record<string, string> = {
      n: '\n', r: '\r', t: '\t', f: '\f', v: '\v', '0': '\0',
    }
    if (mark in simple) {
      i += 2
      return simple[mark].codePointAt(0) as number
    }
    // An identity escape (`\]`, `\-`, `\\`, …). A class shorthand like
    // `\d` or `\w` is NOT identity — refuse those rather than turning
    // them into the literal letter.
    if (mark !== undefined && !/[A-Za-z0-9]/.test(mark)) {
      i += 2
      return mark.codePointAt(0) as number
    }
    return null
  }

  const items: ClassItem[] = []
  while (i < end) {
    const lo = readOne()
    if (lo == null) return null
    // `-` right before `]` is a literal member, matching how the
    // class was decoded on the way in.
    if (pattern[i] === '-' && i + 1 < end) {
      i++
      const hi = readOne()
      if (hi == null || hi < lo) return null
      items.push({ lo, hi })
    } else {
      items.push({ lo, hi: lo })
    }
  }

  return items.length === 0 ? null : { negated, items }
}


// ---- Elements -------------------------------------------------------

// How a rendered fragment composes: an `atom` can take a postfix
// operator directly, a `postfix` already carries one (chaining is
// legal — `x*?` is `(x*)?`), and a `seq` needs parentheses first.
type Fragment = {
  text: string
  form: 'atom' | 'postfix' | 'seq'
}

// Expand a case-insensitive literal into an exactly-equivalent GBNF
// sequence: cased letters become two-member classes, runs of caseless
// characters stay literal chunks. `"a-c"` → `[aA] "-" [cC]`.
//
// Only ASCII letters fold. A non-ASCII character whose upper and lower
// case differ has no single obviously-right expansion (one-to-many
// mappings, locale rules), so it is refused — RFC 5234's quoted
// strings are ASCII anyway.
function insensitiveFragments(literal: string, rule: string): string[] {
  const parts: string[] = []
  let chunk = ''
  const flush = () => {
    if (0 < chunk.length) parts.push(quoteLiteral(chunk))
    chunk = ''
  }
  for (const c of literal) {
    if (/[a-zA-Z]/.test(c)) {
      flush()
      parts.push('[' + c.toLowerCase() + c.toUpperCase() + ']')
    } else if (c.toLowerCase() !== c.toUpperCase()) {
      throw new GbnfRenderError(
        `gbnf: rule '${rule}' has a case-insensitive literal ` +
        `containing '${c}' (U+${(c.codePointAt(0) as number)
          .toString(16).toUpperCase()}), which has no exact ` +
        `case-insensitive expansion in GBNF. Use a case-sensitive ` +
        `literal, or spell the alternatives as a character class.`,
        rule,
      )
    } else {
      chunk += c
    }
  }
  flush()
  return parts
}

function renderClass(pattern: string, rule: string): Fragment {
  // `.` lowers to `[\s\S]` on the way in; recover it on the way out.
  if (pattern === '[\\s\\S]') return { text: '.', form: 'atom' }

  const cls = readClassPattern(pattern)
  if (cls == null) {
    throw new GbnfRenderError(
      `gbnf: rule '${rule}' has a regex terminal /${pattern}/ that is ` +
      `not a character class. GBNF's only regex-shaped terminal is ` +
      `[…], so this grammar cannot be rendered faithfully.`,
      rule,
    )
  }

  let out = '[' + (cls.negated ? '^' : '')
  for (const { lo, hi } of cls.items) {
    out += lo === hi
      ? classChar(lo)
      : classChar(lo) + '-' + classChar(hi)
  }
  return { text: out + ']', form: 'atom' }
}

function renderElement(el: Element, rule: string): Fragment | null {
  switch (el.kind) {
    case 'term': {
      // An empty literal denotes zero characters and contributes no
      // element — the same reading `parseGbnf` gives `""`.
      if (el.literal.length === 0) return null
      if (el.caseSensitive === true) {
        return { text: quoteLiteral(el.literal), form: 'atom' }
      }
      const parts = insensitiveFragments(el.literal, rule)
      if (parts.length === 0) return null
      return parts.length === 1
        ? { text: parts[0], form: 'atom' }
        : { text: parts.join(' '), form: 'seq' }
    }

    case 'ref': {
      if (!NAME_RE.test(el.name)) {
        throw new GbnfRenderError(
          `gbnf: rule '${rule}' references '${el.name}', which is not ` +
          `a legal GBNF rule name ([A-Za-z0-9_-]+).`,
          rule,
        )
      }
      return { text: el.name, form: 'atom' }
    }

    case 'regex':
      return renderClass(el.pattern, rule)

    case 'group':
      return {
        text: '(' + renderAlts(el.alts, rule) + ')',
        form: 'atom',
      }

    case 'opt':
    case 'star':
    case 'plus':
    case 'rep': {
      const inner = renderElement(el.inner, rule)
      if (inner == null) {
        throw new GbnfRenderError(
          `gbnf: rule '${rule}' repeats an empty literal, which ` +
          `matches nothing and cannot carry a repetition.`,
          rule,
        )
      }
      const op =
        el.kind === 'opt' ? '?'
          : el.kind === 'star' ? '*'
            : el.kind === 'plus' ? '+'
              : el.min === el.max ? `{${el.min}}`
                : el.max === Infinity ? `{${el.min},}`
                  : `{${el.min},${el.max}}`
      const body = inner.form === 'seq' ? `(${inner.text})` : inner.text
      return { text: body + op, form: 'postfix' }
    }

    // The two IR kinds with no GBNF meaning. A `token` is a reference
    // to the ENGINE's lexer (ABNF grammars may lean on it); `prose` is
    // ABNF's <free text> element. Refuse both — an approximation would
    // silently change the accepted language.
    case 'token':
      throw new GbnfRenderError(
        `gbnf: rule '${rule}' uses the engine lexer token ` +
        `'${el.name}'. GBNF has no lexical level, so there is no ` +
        `faithful rendering; define the token's language as a rule ` +
        `instead.`,
        rule,
      )
    case 'prose':
      throw new GbnfRenderError(
        `gbnf: rule '${rule}' contains the prose element ` +
        `<${el.text}>, which describes a language informally and ` +
        `cannot be rendered as GBNF.`,
        rule,
      )

    default: {
      const kind = (el as { kind: string }).kind
      throw new GbnfRenderError(
        `gbnf: rule '${rule}' contains an IR element of kind ` +
        `'${kind}', which this renderer does not know how to spell.`,
        rule,
      )
    }
  }
}

function renderSeq(seq: Sequence, rule: string): string {
  const parts: string[] = []
  for (const el of seq) {
    const frag = renderElement(el, rule)
    if (frag != null) parts.push(frag.text)
  }
  return parts.join(' ')
}

function renderAlts(alts: Sequence[], rule: string): string {
  // An empty alternative renders as nothing between the pipes —
  // `ws ::= | " "` — exactly the shape llama.cpp's own json.gbnf uses.
  return alts.map((seq) => renderSeq(seq, rule)).join(' | ')
}


// ---- Grammar --------------------------------------------------------

// Render a grammar IR as GBNF source.
//
// GBNF requires a `root` rule. When the grammar has one it is used as
// is; when it does not, a `root ::= <start>` production is prepended,
// referencing `opts.start` or the first production. That addition is
// the one place the output says more than the input — every other
// production renders one to one.
function renderGbnf(grammar: Grammar, opts?: GbnfRenderOptions): string {
  const productions = grammar?.productions
  if (!Array.isArray(productions) || productions.length === 0) {
    throw new GbnfRenderError('gbnf: no productions to render')
  }

  const seen = new Set<string>()
  for (const p of productions) {
    if (!NAME_RE.test(p.name)) {
      throw new GbnfRenderError(
        `gbnf: production '${p.name}' is not a legal GBNF rule name ` +
        `([A-Za-z0-9_-]+).`,
        p.name,
      )
    }
    // GBNF's duplicate semantics are last-wins REPLACEMENT, so two
    // productions with one name cannot both survive a round trip.
    // Front-ends merge their incremental forms (ABNF `=/`) before the
    // IR gets here; a duplicate reaching this point is ill-formed.
    if (seen.has(p.name)) {
      throw new GbnfRenderError(
        `gbnf: duplicate production '${p.name}'. GBNF replaces a ` +
        `redefined rule, so rendering both would change the grammar.`,
        p.name,
      )
    }
    seen.add(p.name)
  }

  const lines: string[] = []

  if (!seen.has('root')) {
    const start = opts?.start ?? productions[0].name
    if (!seen.has(start)) {
      throw new GbnfRenderError(
        `gbnf: start rule '${start}' is not defined, so no 'root' ` +
        `can be synthesized for it.`,
        start,
      )
    }
    lines.push(`root ::= ${start}`)
  }

  for (const p of productions) {
    lines.push(`${p.name} ::= ${renderAlts(p.alts, p.name)}`)
  }

  return lines.join('\n') + '\n'
}


export { renderGbnf, GbnfRenderError }
export type { GbnfRenderOptions }
