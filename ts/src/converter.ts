/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

/*  converter.ts
 *  GBNF -> tabnas grammar spec converter: the llama.cpp FRONT-END.
 *
 *  This file parses GBNF text into the notation-neutral grammar IR that
 *  `@tabnas/bnf` compiles. Everything downstream of that IR — repetition
 *  desugaring, left-recursion elimination, tail repeats, probe dispatch,
 *  literal lifting, token allocation, first-set analysis, chain emission
 *  — lives in `@tabnas/bnf` and is shared with the ABNF and EBNF
 *  front-ends.
 *
 *    GBNF text ──parseGbnf──▶ Grammar ──bnf.emitGrammarSpec──▶ GrammarSpec
 *
 *  What stays here is what is genuinely GBNF:
 *
 *    - `gbnfRules`, the tabnas grammar that reads GBNF syntax itself,
 *      and `getGbnfParser`, which installs it on a fresh instance;
 *    - the mandatory `root` start symbol;
 *    - case-SENSITIVE quoted strings (the opposite of ABNF's default);
 *    - character classes `[a-z]`, `[^\n]`, `.`, and the
 *      `\xXX` / `\uXXXX` / `\UXXXXXXXX` escape family;
 *    - postfix repetition `* + ? {m} {m,} {m,n}`;
 *    - tokenizer-token terminals (`<think>`, `<[1000]>`, `!</think>`),
 *      which parse but are rejected at compile — see the note on
 *      `GbnfCompileError` below;
 *    - the lexer options the emitted spec carries, so that `tn.parse()`
 *      is a faithful acceptance test rather than a lenient one — see
 *      `applyExactLexing` and `markClassesEager`.
 *
 *  The dialect implemented is llama.cpp's `grammars/README.md` at commit
 *  dd1ea524333b1e697489067d7a4c39c60d32beee (2026-08-10);
 *  `doc/known-gaps.md` records where this front-end and llama.cpp's own
 *  parser diverge, and what causes each divergence.
 */

import type { GrammarSpec, Rule } from '@tabnas/parser'

import { emitGrammarSpec, eliminateLeftRecursion } from '@tabnas/bnf'

import type {
  ConvertOptions,
  SrcSpan,
  Element,
  Sequence,
  Production,
  Grammar,
} from '@tabnas/bnf'

// The IR types get GBNF-flavoured aliases in this package's public API,
// exactly as the ABNF front-end aliases them. The one addition is
// `eagerClasses`, which is about how the emitted spec configures the
// LEXER rather than about the IR — see `markClassesEager`.
type GbnfConvertOptions = ConvertOptions & {
  // Let character-class tokens fire regardless of what the active rule
  // expects, when the grammar's classes are provably unambiguous. On by
  // default; set false to keep the engine's rule-directed lexing.
  eagerClasses?: boolean
}
type GbnfElement = Element
type GbnfSequence = Sequence
type GbnfProduction = Production
type GbnfGrammar = Grammar


// Source span of a token, for the IR (`@tabnas/bnf` SrcSpan). Every
// field is copied straight off the token: the compiler stores whatever
// units the front-end's own engine tokens use, precisely so that no
// arithmetic — and so no off-by-one — happens at this boundary.
function spanOf(tkn: any): SrcSpan | undefined {
  if (null == tkn || null == tkn.sI) return undefined
  const len = null != tkn.len ? tkn.len : (tkn.src ? String(tkn.src).length : 0)
  return { s: tkn.sI, e: tkn.sI + len, r: tkn.rI, c: tkn.cI }
}


// One span covering two tokens — a group runs from its `(` to its `)`.
// Falls back to whichever end is known when the other is not.
function spanTo(from: any, to: any): SrcSpan | undefined {
  const a = spanOf(from)
  const b = spanOf(to)
  if (null == a) return b
  if (null == b) return a
  return { s: a.s, e: b.e, r: a.r, c: a.c }
}

// A tokenizer-token terminal — `<think>`, `<[1000]>`, `!</think>`. These
// match entries of a sampler's vocabulary, not characters, so a text
// parser has no faithful semantics for them (see the policy note on
// `rejectTokenTerminals`). They are NOT part of the `@tabnas/bnf` IR:
// the syntax layer produces them so a grammar containing one is not a
// *syntax* error, and the validation pass then rejects them by name.
type TokenTerminal = {
  kind: 'tokterm'
  text: string      // the source text, brackets included
  negated: boolean  // `!<…>` rather than `<…>`
  sp?: SrcSpan      // where it was written, as on every other element
}

// What the notation parser actually builds. It is the IR plus the one
// element kind the IR cannot express; `parseGbnf` returns only after
// every `tokterm` has been rejected, so the value handed to
// `emitGrammarSpec` is a plain `Grammar`.
type RawElement = GbnfElement | TokenTerminal
type RawSequence = RawElement[]
type RawProduction = { name: string; alts: RawSequence[] }


// Declarative definition of the GBNF grammar itself, expressed as
// tabnas rules.
//
// Token vocabulary. Every terminal whose body is free-form — strings,
// character classes, repetition braces, tokenizer terminals, rule names
// — is lexed WHOLE by a `match.token` regex flagged `eager$`, which opts
// the matcher out of the lexer's tcol gating. GBNF's terminals are
// unambiguous by their first character (`"` `[` `{` `<` `!` and word
// chars are each claimed by exactly one matcher), so tokenisation does
// not need to know what the parser expects. That is what lets this
// grammar stay small: the ABNF front-end spends a dozen alternatives on
// two-token `s:` patterns whose only job is to widen the tcol at the
// position after a rule name, and none of that is needed here.
//
//   #DEF   `::=` (rule-definition operator)
//   #ALT   `|`   (alternation)
//   #LP    `(`
//   #RP    `)`
//   #DOT   `.`   (any character)
//   #NM    rule name — `[A-Za-z0-9_-]+`, llama.cpp's is_word_char set
//   #GS    `"…"` string literal, raw (escapes decoded in the action)
//   #CC    `[…]` character class, raw
//   #POST  a run of postfix repetition operators: `*` `+` `?` `{m,n}`
//   #TOK   `<…>` / `!<…>` tokenizer-token terminal
//   #ZZ    end-of-source
//
// Grammar:
//   gbnf    = prod*
//   prod    = NM '::=' alts
//   alts    = seq ('|' seq)*
//   seq     = elem*                       (an EMPTY seq is legal GBNF:
//                                          `ws ::= | " " | "\n"`)
//   elem    = atom POST?
//   atom    = NM | GS | CC | DOT | TOK | '(' alts ')'


// Whitespace exactly as llama.cpp's `parse_space` defines it. NOT
// JavaScript's `\s`, which also admits NBSP, vertical tab, form feed
// and the Unicode space separators — using it made `root ::= "x"{ 1}`
// with a U+00A0 compile here while llama.cpp rejects it. For a package
// whose purpose is conformance, accepting more than the notation does
// is the wrong direction to err in.
const SP = '[ \\t\\r\\n]'

// `{m}` / `{m,}` / `{m,n}`, with llama.cpp-legal spacing throughout.
const REP = '\\{' + SP + '*([0-9]+)' + SP + '*(?:,' + SP + '*([0-9]*)' +
  SP + '*)?\\}'
// The same, with the counts non-capturing — for the run matcher, which
// only needs to find the extent.
const REP_NC = REP.replace(/\(\[0-9\]/g, '(?:[0-9]')

const gbnfRules: Record<
  string,
  {
    bo?: (r: Rule) => void
    bc?: (r: Rule) => void
    open?: any[]
    close?: any[]
  }
> = {
  // Top-level: accumulates productions into r.node.
  gbnf: {
    bo: (r) => { r.node = [] },
    open: [
      { s: '#ZZ', g: 'empty' },
      { p: 'prod' },
    ],
    close: [{ s: '#ZZ' }],
  },

  // One production per invocation; tail-recurses (r:'prod') for the
  // next. Inherits its parent's node (the productions array) and
  // appends to it in `bc` once its `alts` child has returned.
  prod: {
    open: [
      {
        s: '#NM #DEF',
        a: (r: Rule) => {
          r.u.name = r.o[0].src as string
          r.u.nameTkn = r.o[0]
        },
        p: 'alts',
      },
    ],
    close: [
      // `NM ::=` means the next production has begun — back up 2 tokens
      // so a fresh `prod` invocation sees them. `::=` can only ever
      // follow a rule name at the start of a production, so this
      // two-token lookahead is exact.
      { s: '#NM #DEF', b: 2, r: 'prod' },
      { b: 1 },
    ],
    bc: (r) => {
      if (r.child && r.child.node !== undefined) {
        r.node.push({
          name: r.u.name,
          alts: r.child.node,
          // The name, not the body: that is what an outline entry,
          // go-to-definition and a whole-rule diagnostic want.
          sp: spanOf(r.u.nameTkn),
        })
      }
    },
  },

  // A list of alternative sequences separated by `|`. Owns its own
  // array (`bo` resets it) and pushes each seq result in `bc`.
  alts: {
    bo: (r) => { r.node = [] },
    open: [{ p: 'seq' }],
    close: [
      { s: '#ALT', p: 'seq' },
      { b: 1 },
    ],
    bc: (r) => {
      if (r.child && r.child.node !== undefined) {
        r.node.push(r.child.node)
      }
    },
  },

  // A (possibly empty) sequence of elements. The boundary alternatives
  // come first and match without consuming (`b:` cancels the `s:`
  // consumption) so the enclosing rule sees the token itself. An empty
  // sequence is legal and meaningful: llama.cpp's own `json.gbnf`
  // writes optional whitespace as `ws ::= | " " | "\n" [ \t]{0,20}`,
  // whose first alternative matches nothing.
  seq: {
    bo: (r) => { r.node = [] },
    open: [
      { s: '#NM #DEF', b: 2, g: 'end' },
      { s: '#ALT', b: 1, g: 'end' },
      { s: '#RP', b: 1, g: 'end' },
      { s: '#ZZ', b: 1, g: 'end' },
      { p: 'elem' },
    ],
    close: [
      { s: '#NM #DEF', b: 2, g: 'end' },
      { s: '#ALT', b: 1, g: 'end' },
      { s: '#RP', b: 1, g: 'end' },
      { s: '#ZZ', b: 1, g: 'end' },
      { p: 'elem' },
    ],
  },

  // One element: an atom followed by an optional postfix repetition
  // run. The run arrives as a SINGLE `#POST` token, which is what makes
  // this a two-alternative rule rather than a loop: a close-state loop
  // in tabnas needs a `p:`/`r:` on every iteration, and there is no
  // child to push for `*` or `?`. Lexing `x*?` as one token instead
  // moves the (rare, but legal) chaining into `applyPostfix`.
  elem: {
    open: [{ p: 'atom' }],
    close: [
      {
        // `r.c`, not `r.o`: tokens matched by a close-state alt land in
        // the rule's close-token array.
        s: '#POST',
        a: (r: Rule) => {
          const item = r.child.node
          if (item !== undefined) {
            r.node.push(applyPostfix(item, r.c[0].src as string))
          }
        },
      },
      {
        a: (r: Rule) => {
          const item = r.child.node
          if (item !== undefined) r.node.push(item)
        },
      },
    ],
  },

  // The atom body — a rule reference, string literal, character class,
  // any-char dot, tokenizer terminal, or parenthesised group. Sets its
  // OWN r.node so the enclosing `elem` can read it from `r.child.node`.
  //
  // `r.node = undefined` in `bo` is load-bearing: an empty string
  // literal (`""`) contributes no element at all, and `elem` skips
  // pushing when the atom left its node unset.
  atom: {
    bo: (r) => { r.node = undefined; r.u.grouped = false },
    open: [
      {
        s: '#GS',
        a: (r: Rule) => {
          const literal = decodeString(r.o[0].src as string)
          // GBNF string literals are CASE-SENSITIVE — the opposite of
          // RFC 5234's default. The flag is what makes the emitter
          // lower this to a plain fixed token instead of a case-folding
          // regex, so dropping it would silently accept `"TRUE"` for
          // `"true"`.
          if (literal.length > 0) {
            r.node = {
              kind: 'term', literal, caseSensitive: true, sp: spanOf(r.o[0]),
            }
          }
        },
      },
      {
        s: '#CC',
        a: (r: Rule) => {
          r.node = decodeCharClass(r.o[0].src as string, r.o[0])
        },
      },
      {
        s: '#DOT',
        // `.` is llama.cpp's LLAMA_GRETYPE_CHAR_ANY: any single
        // character, newlines included. `[\s\S]` says that without
        // needing the `s` flag (which RE2 spells differently). The `u`
        // flag makes "one character" mean one code point rather than
        // one UTF-16 unit, so `.` consumes an emoji whole and `.{2}`
        // does not accept a single astral character as two.
        a: (r: Rule) => {
          r.node = {
            kind: 'regex', pattern: '[\\s\\S]', flags: 'u', sp: spanOf(r.o[0]),
          }
        },
      },
      {
        s: '#TOK',
        a: (r: Rule) => {
          const src = r.o[0].src as string
          r.node = {
            kind: 'tokterm',
            text: src,
            negated: src[0] === '!',
            sp: spanOf(r.o[0]),
          }
        },
      },
      {
        s: '#NM',
        a: (r: Rule) => {
          r.node = {
            kind: 'ref', name: r.o[0].src as string, sp: spanOf(r.o[0]),
          }
        },
      },
      {
        s: '#LP',
        a: (r: Rule) => { r.u.grouped = true; r.u.open = r.o[0] },
        p: 'alts',
      },
    ],
    close: [
      // Only a group consumes the `)`. Without the condition this
      // alternative would eat the closing paren of the ENCLOSING group
      // after a simple atom — `( "a" )` would lose its `)`.
      {
        s: '#RP',
        c: (r: Rule) => r.u.grouped === true,
        a: (r: Rule) => {
          r.node = {
            kind: 'group', alts: r.child.node, sp: spanTo(r.u.open, r.c0),
          }
        },
      },
      // Simple atoms already set r.node in open; pop without consuming.
      { b: 1 },
    ],
  },
}


// Cached tabnas instance for the GBNF grammar above; built on first use.
let _gbnfParser: ((src: string) => RawProduction[]) | null = null

function getGbnfParser(): (src: string) => RawProduction[] {
  if (_gbnfParser) return _gbnfParser

  const { Tabnas } = require('@tabnas/parser')

  // GBNF defines its own grammar from scratch, so no grammar plugin is
  // loaded — just the bare engine with the token set below.
  const tn = new Tabnas({
    rule: { start: 'gbnf' },
    fixed: {
      token: {
        // Clear the JSON-oriented defaults: `{`, `}`, `[`, `]`, `:` and
        // `,` all belong to GBNF terminals that are lexed whole by the
        // match matchers, and must not be stolen a character at a time.
        '#OB': null,
        '#CB': null,
        '#OS': null,
        '#CS': null,
        '#CL': null,
        '#CA': null,
        '#DEF': '::=',
        '#ALT': '|',
        '#LP': '(',
        '#RP': ')',
        '#DOT': '.',
      },
    },
    match: {
      token: eagerMatchers({
        // A GBNF string literal, captured RAW: the body is decoded by
        // `decodeString`, not by the engine's string matcher, because
        // GBNF's escape set is its own (`\[`, `\]`, `\UXXXXXXXX`) and
        // differs from both JSON's and the engine's default.
        '#GS': /^"(?:\\[\s\S]|[^"\\])*"/,
        // A character class, likewise raw — `[^"\\\x7F\x00-\x1F]` is a
        // single terminal, and letting the fixed matcher see its
        // brackets would shred it.
        '#CC': /^\[(?:\\[\s\S]|[^\]\\])*\]/,
        // A run of postfix repetition operators. Lexing the RUN rather
        // than one operator lets `elem` stay loop-free; see the note
        // there. Whitespace inside the run is llama.cpp-legal
        // (`parse_space` runs after each operator).
        '#POST': new RegExp(
          '^(?:[*+?]|' + REP_NC + ')(?:' + SP +
          '*(?:[*+?]|' + REP_NC + '))*'),
        // Tokenizer-token terminal, optionally negated.
        '#TOK': /^!?<(?:\\[\s\S]|[^>\\])*>/,
        // A rule name. llama.cpp's `is_word_char` is
        // `[A-Za-z0-9_-]`, so a name may start with a digit or a dash.
        '#NM': /^[A-Za-z0-9_-]+/,
      }),
    },
    // Nothing below is GBNF syntax: numbers, quoted strings, barewords
    // and keyword values are all covered by the match tokens above, and
    // leaving the default matchers on would let them claim characters
    // the grammar has already spoken for.
    number: { lex: false },
    string: { lex: false },
    text: { lex: false },
    value: { lex: false },
    comment: {
      // GBNF comments run from `#` to end of line. A `#` inside a
      // string or a character class is never seen by this matcher: both
      // are match tokens, and the match matcher runs before the comment
      // matcher (lex order 1e6 vs 6e6).
      def: {
        hash: { line: true, start: '#', lex: true, eatline: false },
        slash: null as any,
        multi: null as any,
      },
    },
  })

  // Drop the default JSON rules — they would otherwise compete with
  // ours for the starting token set.
  const existing = tn.rule()
  for (const name of Object.keys(existing)) {
    tn.rule(name, null)
  }

  for (const name of Object.keys(gbnfRules)) {
    const spec = gbnfRules[name]
    tn.rule(name, (rs: any) => {
      if (spec.bo) rs.bo(spec.bo)
      if (spec.bc) rs.bc(spec.bc)
      if (spec.open) rs.open(spec.open)
      if (spec.close) rs.close(spec.close)
    })
  }

  _gbnfParser = (src: string) => tn.parse(src) as RawProduction[]
  return _gbnfParser
}


// Flag every matcher `eager$`, which opts it out of the lexer's tcol
// gating: the matcher fires whenever its regex matches, and the parser
// rejects tokens it did not expect. GBNF's terminals are distinguished
// by their first character, so tokenisation is independent of parse
// state — and stating that here removes the need for the two-token
// `s:` patterns the ABNF grammar uses to widen tcol by hand.
function eagerMatchers(
  map: Record<string, RegExp>,
): Record<string, RegExp> {
  for (const re of Object.values(map)) {
    ;(re as RegExp & { eager$?: boolean }).eager$ = true
  }
  return map
}


// Error raised when the GBNF source itself can't be parsed. Surfaces
// line and column from the underlying tabnas error so the caller can
// report them directly. The original error is kept on `.cause`.
class GbnfParseError extends Error {
  readonly line?: number
  readonly column?: number
  readonly cause?: unknown
  constructor(
    message: string,
    location?: { line?: number; column?: number },
    cause?: unknown,
  ) {
    super(message)
    this.name = 'GbnfParseError'
    this.line = location?.line
    this.column = location?.column
    this.cause = cause
  }
}


// Error raised when the source parses as GBNF but does not describe a
// grammar this compiler can build: no `root` rule, a reference to a
// rule that is never defined, or a tokenizer-token terminal. Each
// message names the rule responsible.
class GbnfCompileError extends Error {
  readonly rule?: string
  // Where in the grammar source, when the offending IR node knew. Only
  // ever set from a span the front-end recorded, so it is present
  // exactly when there is a real position to point at.
  readonly sp?: SrcSpan
  constructor(message: string, rule?: string, sp?: SrcSpan) {
    super(message)
    this.name = 'GbnfCompileError'
    this.rule = rule
    if (null != sp) this.sp = sp
  }
}


// Parse GBNF source into the grammar IR via the tabnas-based parser.
// The returned `Grammar` is ready for `emitGrammarSpec`: `root` is
// present, every reference resolves, and no tokenizer terminals remain.
function parseGbnf(src: string): GbnfGrammar {
  const parser = getGbnfParser()
  let raw: RawProduction[]
  try {
    raw = parser(src) ?? []
  } catch (e: any) {
    // A terminal decoder (`decodeString`, `decodeCharClass`) throws from
    // inside a rule action, so its own diagnostic — which already names
    // the offending escape or class — arrives here. Let it through
    // rather than wrapping it in a second `gbnf: parse error:` prefix.
    if (e instanceof GbnfParseError) throw e
    // TabnasError carries `lineNumber` / `columnNumber`; fall back to
    // ad-hoc extraction from the error message otherwise.
    const line = e?.lineNumber ?? e?.row
    const column = e?.columnNumber ?? e?.col
    const loc = (line != null && column != null)
      ? ` at line ${line}, column ${column}`
      : ''
    const message = e?.message ? String(e.message).split('\n')[0] : String(e)
    throw new GbnfParseError(
      `gbnf: parse error${loc}: ${message}`,
      { line, column },
      e,
    )
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new GbnfParseError('gbnf: no productions found')
  }

  const productions = dedupeProductions(raw)
  rejectTokenTerminals(productions)
  requireRoot(productions)
  requireDefinedRefs(productions)

  return { productions: productions as unknown as GbnfProduction[] }
}


// llama.cpp stores rules in a map keyed by symbol, so a second
// `name ::= …` REPLACES the first rather than extending it (GBNF has no
// equivalent of ABNF's `=/`). Keep the last definition, in the position
// of the first, so rule order — and therefore the emitted spec — stays
// stable.
function dedupeProductions(prods: RawProduction[]): RawProduction[] {
  const byName = new Map<string, RawProduction>()
  const order: string[] = []
  for (const p of prods) {
    if (!byName.has(p.name)) order.push(p.name)
    byName.set(p.name, p)
  }
  return order.map((n) => byName.get(n) as RawProduction)
}


// Policy: tokenizer-token terminals parse, but do not compile.
//
// `<think>`, `<[1000]>` and `!</think>` match entries of a sampler's
// vocabulary — the model's tokenizer decides what text they cover, and
// the same grammar therefore means different things on different
// models. A text parser has no tokenizer, so there is no faithful
// semantics to implement, and the two available approximations are both
// wrong in a way that would go unnoticed: treating `<think>` as the
// literal text `"<think>"` accepts strings the sampler would refuse,
// and dropping it accepts strings with nothing there at all. Either
// silently changes the accepted language, which is the one failure mode
// an offline validator must not have.
//
// So the syntax layer accepts them (a grammar containing one is not a
// *syntax* error, and the error can name the rule), and this pass
// rejects them.
function rejectTokenTerminals(prods: RawProduction[]): void {
  const walk = (el: RawElement, rule: string): void => {
    if (el.kind === 'tokterm') {
      throw new GbnfCompileError(
        `gbnf: rule '${rule}' uses the tokenizer-token terminal ` +
        `'${el.text}'. These match a sampler's vocabulary entries ` +
        `rather than characters, so they have no meaning for a text ` +
        `parser and are not compiled. Remove them, or describe the ` +
        `same text with a string literal or character class.`,
        rule,
        el.sp,
      )
    }
    if (el.kind === 'group') {
      for (const alt of el.alts) for (const e of alt) walk(e as RawElement, rule)
    } else if (
      el.kind === 'opt' || el.kind === 'star' ||
      el.kind === 'plus' || el.kind === 'rep'
    ) {
      walk(el.inner as RawElement, rule)
    }
  }
  for (const p of prods) {
    for (const alt of p.alts) for (const el of alt) walk(el, p.name)
  }
}


// GBNF's start symbol is `root`, and llama.cpp refuses a grammar
// without one ("grammar does not contain a 'root' symbol"). The rule is
// part of the notation, not a convention, so it is enforced here rather
// than left to the `start` option.
function requireRoot(prods: RawProduction[]): void {
  if (!prods.some((p) => p.name === 'root')) {
    const names = prods.map((p) => p.name).join(', ')
    throw new GbnfCompileError(
      `gbnf: no 'root' rule. GBNF requires a rule named 'root'; it is ` +
      `the start symbol, and the whole input must match it. ` +
      `Defined rules: ${names}.`,
      'root',
    )
  }
}


// Every reference must name a defined rule. Without this check an
// undefined name reaches `@tabnas/bnf`, where a bare `TX`/`NR`/`ST`/`VL`
// would be normalised into a built-in lexer token and anything else
// would emit a `p:` to a rule the engine does not have — a parse-time
// failure a long way from the typo that caused it. llama.cpp reports
// the same condition ("Undefined rule identifier") at parse time.
function requireDefinedRefs(prods: RawProduction[]): void {
  const defined = new Set(prods.map((p) => p.name))
  const walk = (el: RawElement, rule: string): void => {
    if (el.kind === 'ref') {
      if (!defined.has(el.name)) {
        throw new GbnfCompileError(
          `gbnf: rule '${rule}' references '${el.name}', which is ` +
          `never defined.`,
          rule,
          el.sp,
        )
      }
    } else if (el.kind === 'group') {
      for (const alt of el.alts) for (const e of alt) walk(e as RawElement, rule)
    } else if (
      el.kind === 'opt' || el.kind === 'star' ||
      el.kind === 'plus' || el.kind === 'rep'
    ) {
      walk(el.inner as RawElement, rule)
    }
  }
  for (const p of prods) {
    for (const alt of p.alts) for (const el of alt) walk(el, p.name)
  }
}


// ---- Terminals -----------------------------------------------------

// The GBNF escape set, exactly as llama.cpp's `parse_char` reads it:
// `\x` + 2 hex, `\u` + 4 hex, `\U` + 8 hex, plus `\t \r \n \\ \" \[ \]`.
// Anything else is an error there and here — a silently-copied unknown
// escape would change the accepted language.
const SIMPLE_ESCAPES: Record<string, string> = {
  t: '\t',
  r: '\r',
  n: '\n',
  '\\': '\\',
  '"': '"',
  '[': '[',
  ']': ']',
}

const HEX_ESCAPES: Record<string, number> = { x: 2, u: 4, U: 8 }


// Read one character — plain or escaped — starting at `i`. Returns the
// code point and the index just past it. `whole` is only used to build
// an error message that shows the terminal the character came from.
function readChar(
  whole: string,
  i: number,
): { cp: number; next: number } {
  if (whole[i] !== '\\') {
    const cp = whole.codePointAt(i) as number
    return { cp, next: i + (cp > 0xFFFF ? 2 : 1) }
  }

  const mark = whole[i + 1]
  if (mark === undefined) {
    throw new GbnfParseError(
      `gbnf: trailing backslash in terminal ${whole}`)
  }

  const simple = SIMPLE_ESCAPES[mark]
  if (simple !== undefined) {
    return { cp: simple.codePointAt(0) as number, next: i + 2 }
  }

  const digits = HEX_ESCAPES[mark]
  if (digits !== undefined) {
    const hex = whole.slice(i + 2, i + 2 + digits)
    if (hex.length < digits || !/^[0-9a-fA-F]+$/.test(hex)) {
      throw new GbnfParseError(
        `gbnf: escape '\\${mark}' in terminal ${whole} needs ` +
        `${digits} hex digits, found '${hex}'`)
    }
    const cp = parseInt(hex, 16)
    if (cp > 0x10FFFF) {
      throw new GbnfParseError(
        `gbnf: escape '\\${mark}${hex}' in terminal ${whole} is ` +
        `${cp}, which is not a Unicode code point (the maximum is ` +
        `\\U0010FFFF)`)
    }
    return { cp, next: i + 2 + digits }
  }

  throw new GbnfParseError(
    `gbnf: unknown escape '\\${mark}' in terminal ${whole}. GBNF ` +
    `escapes are \\t \\r \\n \\\\ \\" \\[ \\] \\xXX \\uXXXX ` +
    `\\UXXXXXXXX.`)
}


// Decode a raw `"…"` literal into the string it denotes.
function decodeString(raw: string): string {
  let out = ''
  let i = 1
  const end = raw.length - 1
  while (i < end) {
    const { cp, next } = readChar(raw, i)
    out += String.fromCodePoint(cp)
    i = next
  }
  return out
}


// Decode a raw `[…]` character class into an IR `regex` element.
//
// The class is re-emitted rather than passed through: GBNF and
// JavaScript agree on `[`, `]`, `^` and `-` but on nothing else, so a
// verbatim copy would hand JS a pattern in which `\d`, `\b` or a stray
// `$` mean something GBNF never said. Every member is written back as a
// `\uXXXX` (or `\u{…}`) escape, which has exactly one meaning inside a
// character class and needs no further quoting.
//
// A range whose endpoint sits above the BMP forces the `u` flag, since
// `\u{…}` is only a code-point escape in Unicode mode. That is also the
// one construct with no cross-runtime encoding today — see
// `doc/known-gaps.md`.
function decodeCharClass(raw: string, tkn?: any): GbnfElement {
  let i = 1
  const end = raw.length - 1

  let negated = false
  if (raw[i] === '^') {
    negated = true
    i++
  }

  const parts: string[] = []
  let astral = false

  while (i < end) {
    const lo = readChar(raw, i)
    i = lo.next
    // `-` immediately before the closing bracket is a literal hyphen,
    // not a range operator — llama.cpp checks `pos[1] != ']'` the same
    // way, which is what makes `[-+*/]` in its own arithmetic.gbnf a
    // four-member class rather than a syntax error.
    if (raw[i] === '-' && i + 1 < end) {
      const hi = readChar(raw, i + 1)
      i = hi.next
      if (hi.cp < lo.cp) {
        throw new GbnfParseError(
          `gbnf: character class ${raw} has a descending range ` +
          `(U+${lo.cp.toString(16).toUpperCase()} to ` +
          `U+${hi.cp.toString(16).toUpperCase()})`)
      }
      astral = astral || 0xFFFF < lo.cp || 0xFFFF < hi.cp
      parts.push(classEscape(lo.cp) + '-' + classEscape(hi.cp))
    } else {
      astral = astral || 0xFFFF < lo.cp
      parts.push(classEscape(lo.cp))
    }
  }

  if (parts.length === 0) {
    throw new GbnfParseError(
      `gbnf: empty character class ${raw} matches nothing`)
  }

  return {
    kind: 'regex',
    sp: spanOf(tkn),
    pattern: '[' + (negated ? '^' : '') + parts.join('') + ']',
    // Unicode mode is decided by what the matcher can MATCH, not by
    // what was written in the class. A negated class matches the
    // complement of its members, and that complement always contains
    // every astral code point — so `[^\n]` needs `u` just as much as a
    // class with an astral member does. Without it the matcher consumes
    // one UTF-16 surrogate rather than one character, and `X{2}` wrongly
    // accepts a single astral character as two. GBNF terminals are
    // Unicode code points by definition.
    flags: (negated || astral) ? 'u' : '',
  }
}


function classEscape(cp: number): string {
  return 0xFFFF < cp
    ? '\\u{' + cp.toString(16) + '}'
    : '\\u' + cp.toString(16).padStart(4, '0')
}


// ---- Repetition ----------------------------------------------------

// Apply a run of postfix operators, left to right, so `x*?` is
// `(x*)?` — the same order llama.cpp's sequence loop applies them in.
function applyPostfix(item: RawElement, src: string): RawElement {
  const op = new RegExp('[*+?]|' + REP, 'g')
  let out = item
  let m: RegExpExecArray | null
  while ((m = op.exec(src)) !== null) {
    if (m[0][0] === '*') {
      out = { kind: 'star', inner: out as GbnfElement }
    } else if (m[0][0] === '+') {
      out = { kind: 'plus', inner: out as GbnfElement }
    } else if (m[0][0] === '?') {
      out = { kind: 'opt', inner: out as GbnfElement }
    } else {
      const min = parseInt(m[1], 10)
      // `{m}` (no comma) is exactly m; `{m,}` is m or more; `{m,n}` is
      // the closed range.
      const max =
        m[2] === undefined ? min : m[2] === '' ? Infinity : parseInt(m[2], 10)
      out = repeat(out, min, max, m[0])
    }
  }
  return out
}


// Lower a repetition count onto the IR. `star`/`plus`/`opt` are the
// shapes `@tabnas/bnf` desugars into paired helper rules; `rep` covers
// everything else. An unbounded upper limit is spelled `Infinity`,
// which is the same sentinel `*` and `1*` lower to — the compiler's
// `rep` branch tests `max === Infinity` to choose a star tail over
// nested optionals, so a large finite number here would unroll into
// that many helper rules instead.
function repeat(
  inner: RawElement,
  min: number,
  max: number,
  src: string,
): RawElement {
  if (max < min) {
    throw new GbnfParseError(
      `gbnf: repetition ${src} has an upper bound below its lower ` +
      `bound`)
  }
  if (min === 1 && max === 1) return inner
  if (min === 0 && max === Infinity) {
    return { kind: 'star', inner: inner as GbnfElement }
  }
  if (min === 1 && max === Infinity) {
    return { kind: 'plus', inner: inner as GbnfElement }
  }
  if (min === 0 && max === 1) {
    return { kind: 'opt', inner: inner as GbnfElement }
  }
  return { kind: 'rep', min, max, inner: inner as GbnfElement }
}


// ---- Emission ------------------------------------------------------

// GBNF is scannerless: the grammar describes every character, including
// the spaces. The engine's defaults are not — it ships
// `tokenSet.IGNORE = ['#SP', '#LN', '#CM']` and a full complement of
// JSON-shaped matchers, so `root ::= "a"` would happily accept `" a "`,
// and a `#` in the input would vanish as a comment. Neither is GBNF.
//
// The emitted spec therefore carries its own lexer settings: nothing is
// ignored, and every default matcher that could claim a character the
// grammar has not spoken for is switched off. What remains is the
// grammar's own fixed tokens (its string literals) and match tokens
// (its character classes) — so an unmatched character is a lex error
// rather than a silently skipped one, and `tn.parse()` is a faithful
// acceptance test rather than a lenient one.
// The empty input is the one case the rules never see: the engine
// short-circuits `''` before the parse loop starts, returning
// `lex.emptyResult` when `lex.empty` is set and throwing when it is
// not. Whether the empty string is in the language is a property of the
// grammar, so decide it here — `root ::= "x"*` accepts it and
// `root ::= "x"` must not.
function applyExactLexing(
  spec: GrammarSpec,
  acceptsEmpty: boolean,
): GrammarSpec {
  const options = (spec.options ?? {}) as Record<string, any>
  options.tokenSet = { IGNORE: [] }
  options.space = { lex: false }
  options.line = { lex: false }
  options.comment = { lex: false }
  options.string = { lex: false }
  options.number = { lex: false }
  options.text = { lex: false }
  options.value = { lex: false }
  // Negotiated lexing: GBNF is scannerless, so one character can be a
  // different token in different parse contexts ('"' is an escapable
  // char inside a string body and the closing quote at its end; '\n'
  // is a ws-class member and a literal). The engine's relex option lets
  // an alternate re-cut a token under its own tin list instead of
  // failing on the first cut's identity.
  requireRelexSupport()
  options.lex = { empty: acceptsEmpty, relex: true }
  spec.options = options as GrammarSpec['options']
  return spec
}


// The engine must actually implement negotiated lexing. One that
// predates it ignores the unknown `lex.relex` option in silence, and
// the grammars that need it then fail somewhere in the middle of an
// input with an ordinary unexpected-character error — true, but no help
// at all in working out that the dependency is too old.
//
// Checked as a capability rather than as a peer-version range because a
// range cannot see a linked working copy, which is how this package is
// developed and how CI builds it.
let _relexSupported: boolean | null = null

function requireRelexSupport(): void {
  if (null == _relexSupported) {
    // Ask the engine directly: set the option and see whether it
    // survives into the resolved config. An engine that does not know
    // the option drops it there, which is exactly the condition that
    // matters — more precise than a version number, and it costs one
    // throwaway instance, memoised.
    try {
      const { Tabnas } = require('@tabnas/parser')
      const probe: any = new Tabnas({ lex: { relex: true } })
      _relexSupported = true === probe.internal().config.lex.relex
    } catch (e) {
      _relexSupported = false
    }
  }
  if (!_relexSupported) {
    throw new GbnfCompileError(
      'this @tabnas/parser is too old — it does not implement negotiated ' +
      'lexing (lex.relex), which GBNF needs because its grammars are ' +
      'scannerless: one character can legitimately be a different token ' +
      'for different alternatives. Upgrade @tabnas/parser.')
  }
}


// Can the start rule derive the empty string? Walked over the parsed
// IR — before `emitGrammarSpec` desugars it — because the IR still says
// `star`/`opt`/`rep` outright, where the emitted spec has already
// turned them into mutually-referring helper rules.
//
// The `seen` set makes a recursive rule (`a ::= "x" a | ""`) terminate;
// a rule already on the stack contributes nothing new, so treating it
// as non-nullable is both safe and the least-fixed-point answer.
function derivesEmpty(grammar: GbnfGrammar, start: string): boolean {
  const byName = new Map(grammar.productions.map((p) => [p.name, p]))
  const seen = new Set<string>()

  const elementEmpty = (el: GbnfElement): boolean => {
    switch (el.kind) {
      case 'star':
      case 'opt':
        return true
      case 'plus':
        return elementEmpty(el.inner)
      case 'rep':
        return el.min === 0 || elementEmpty(el.inner)
      case 'group':
        return el.alts.some((alt) => alt.every(elementEmpty))
      case 'ref':
        return ruleEmpty(el.name)
      default:
        // term / regex / token / prose all consume at least one
        // character. (An empty literal never reaches the IR — `atom`
        // drops it.)
        return false
    }
  }

  const ruleEmpty = (name: string): boolean => {
    if (seen.has(name)) return false
    const prod = byName.get(name)
    if (!prod) return false
    seen.add(name)
    const result = prod.alts.some((alt) => alt.every(elementEmpty))
    seen.delete(name)
    return result
  }

  return ruleEmpty(start)
}


// ---- Eager character classes ---------------------------------------
//
// The engine lexes under the ACTIVE RULE's direction: a `match.token`
// regex is only offered a position when the rule's alternatives list
// its token there (the "tcol" gate). That is what lets two overlapping
// classes — `[a-z]` and `[a-z0-9_]` — coexist as separate tokens.
//
// It also means a class token is invisible wherever the rule does not
// name it, and the rule that ends a repetition never does:
//
//     root ::= sign? [0-9]+          sign ::= "-"
//
// compiles to an `opt` helper whose only alternatives are `#sign` and
// the empty one, so its token column is `{#sign}`. Lexing `1` there
// offers nothing that matches, and the parse dies one character in,
// even though the `[0-9]` token is right there in the spec. Every
// `X? C`, `X* C` and `X+ C` where `C` is a class has this shape. See
// `doc/known-gaps.md`.
//
// A matcher flagged `eager$` skips the gate: it fires whenever its
// regex matches, and the parser rejects tokens it did not expect. That
// fixes the shape above — but only when it cannot introduce a NEW
// ambiguity, which needs two properties of the whole grammar:
//
//   1. the classes are pairwise disjoint, so at most one can claim any
//      character, and
//   2. no class contains the first character of any string literal,
//      since match matchers run before the fixed matcher (lex order
//      1e6 vs 2e6) and an eager class would otherwise swallow the
//      literal's opening character.
//
// Under both, tokenisation stops depending on parse state altogether:
// every character has exactly one possible token. Getting it wrong
// cannot over-accept — a mis-tokenised character makes the parse FAIL,
// never succeed — but the conditions are checked rather than assumed,
// and a grammar that fails either keeps the engine's rule-directed
// lexing unchanged.

const MAX_CP = 0x10FFFF

// A set of code points as sorted, merged, inclusive ranges.
type Ranges = Array<[number, number]>

function normalizeRanges(rs: Ranges): Ranges {
  const sorted = rs.slice().sort((a, b) => a[0] - b[0])
  const out: Ranges = []
  for (const [lo, hi] of sorted) {
    const last = out[out.length - 1]
    // `lo <= last[1] + 1` merges adjacent as well as overlapping runs,
    // so `[a][b]` becomes one range and comparisons stay cheap.
    if (last && lo <= last[1] + 1) last[1] = Math.max(last[1], hi)
    else out.push([lo, hi])
  }
  return out
}

function complementRanges(rs: Ranges): Ranges {
  const out: Ranges = []
  let next = 0
  for (const [lo, hi] of rs) {
    if (next < lo) out.push([next, lo - 1])
    next = hi + 1
  }
  if (next <= MAX_CP) out.push([next, MAX_CP])
  return out
}

function rangesIntersect(a: Ranges, b: Ranges): boolean {
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i][1] < b[j][0]) i++
    else if (b[j][1] < a[i][0]) j++
    else return true
  }
  return false
}

function rangesContain(rs: Ranges, cp: number): boolean {
  for (const [lo, hi] of rs) {
    if (cp < lo) return false
    if (cp <= hi) return true
  }
  return false
}


// Read back the code points of a pattern this file emitted. The format
// is fixed and tiny — `[`, an optional `^`, then `\uXXXX` / `\u{…}`
// members and ranges — so reading it is exact rather than a general
// regex parse. `[\s\S]` is the lowering of `.`, i.e. every character.
function emittedClassRanges(pattern: string): Ranges | null {
  if (pattern === '[\\s\\S]') return [[0, MAX_CP]]
  if (pattern[0] !== '[' || pattern[pattern.length - 1] !== ']') return null

  let i = 1
  let negated = false
  if (pattern[i] === '^') {
    negated = true
    i++
  }

  const end = pattern.length - 1
  const rs: Ranges = []

  const readEscape = (): number | null => {
    if (pattern[i] !== '\\' || pattern[i + 1] !== 'u') return null
    if (pattern[i + 2] === '{') {
      const close = pattern.indexOf('}', i + 3)
      if (close < 0) return null
      const cp = parseInt(pattern.slice(i + 3, close), 16)
      i = close + 1
      return Number.isFinite(cp) ? cp : null
    }
    const cp = parseInt(pattern.slice(i + 2, i + 6), 16)
    i += 6
    return Number.isFinite(cp) ? cp : null
  }

  while (i < end) {
    const lo = readEscape()
    if (lo == null) return null
    if (pattern[i] === '-') {
      i++
      const hi = readEscape()
      if (hi == null) return null
      rs.push([lo, hi])
    } else {
      rs.push([lo, lo])
    }
  }

  const merged = normalizeRanges(rs)
  return negated ? complementRanges(merged) : merged
}


// Collect every distinct terminal in the grammar: class patterns (with
// their code-point sets) and literals (with their first code point).
function collectTerminals(grammar: GbnfGrammar): {
  classes: Map<string, Ranges> | null
  literalHeads: number[]
} {
  const classes = new Map<string, Ranges>()
  const literalHeads: number[] = []
  let usable = true

  const walk = (el: GbnfElement): void => {
    if (el.kind === 'regex') {
      if (!classes.has(el.pattern)) {
        const rs = emittedClassRanges(el.pattern)
        if (rs == null) usable = false
        else classes.set(el.pattern, rs)
      }
    } else if (el.kind === 'term') {
      if (0 < el.literal.length) {
        literalHeads.push(el.literal.codePointAt(0) as number)
      }
    } else if (el.kind === 'group') {
      for (const alt of el.alts) for (const e of alt) walk(e)
    } else if (
      el.kind === 'opt' || el.kind === 'star' ||
      el.kind === 'plus' || el.kind === 'rep'
    ) {
      walk(el.inner)
    }
  }

  for (const p of grammar.productions) {
    for (const alt of p.alts) for (const el of alt) walk(el)
  }

  return { classes: usable ? classes : null, literalHeads }
}


// Flag the emitted class matchers `eager$` when the two conditions
// above hold. Returns whether it did, so the caller can say so.
function markClassesEager(
  grammar: GbnfGrammar,
  spec: GrammarSpec,
): boolean {
  const matchTokens =
    ((spec.options as any)?.match?.token ?? {}) as Record<string, RegExp>
  const names = Object.keys(matchTokens)
  if (names.length === 0) return false

  const { classes, literalHeads } = collectTerminals(grammar)
  if (classes == null) return false

  // Every match token must be one of the classes read back above. A
  // token from anywhere else (a `wordKeywords` literal guard, say) has
  // not been checked for disjointness, so the whole optimisation is
  // off rather than partly applied.
  const sources = new Set([...classes.keys()].map((p) => '^' + p))
  for (const name of names) {
    if (!sources.has(matchTokens[name].source)) return false
  }

  const sets = [...classes.values()]
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      if (rangesIntersect(sets[i], sets[j])) return false
    }
    for (const cp of literalHeads) {
      if (rangesContain(sets[i], cp)) return false
    }
  }

  for (const name of names) {
    ;(matchTokens[name] as RegExp & { eager$?: boolean }).eager$ = true
  }
  return true
}


// Public entry point: take GBNF source and return a tabnas GrammarSpec.
//
// `start` defaults to `root`, GBNF's mandatory start symbol, rather
// than to the first production the way the notation-neutral compiler
// would. `tag` defaults to 'gbnf' so the emitted alts carry this
// front-end's group tag.
function gbnf(src: string, opts?: GbnfConvertOptions): GrammarSpec {
  const grammar = parseGbnf(src)
  const start = opts?.start ?? 'root'
  const spec = emitGrammarSpec(grammar, {
    ...opts,
    start,
    tag: opts?.tag ?? 'gbnf',
  })
  applyExactLexing(spec, derivesEmpty(grammar, start))
  if (opts?.eagerClasses !== false) markClassesEager(grammar, spec)
  return spec
}


export {
  gbnf,
  parseGbnf,
  emitGrammarSpec,
  eliminateLeftRecursion,
  gbnfRules,
  GbnfParseError,
  GbnfCompileError,
}

export type {
  GbnfConvertOptions,
  GbnfElement,
  GbnfSequence,
  GbnfProduction,
  GbnfGrammar,
  TokenTerminal,
}
