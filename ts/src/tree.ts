/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

/*  tree.ts
 *  A GBNF document read as the schema `grammar-rules`: its rules as the
 *  text writes them, uncompiled and in source order (tabnas/bnf's
 *  docs/grammar-rules.md, and section 13.1 of alchemy's
 *  docs/streaming-plan.md). This is the tree a host translates: the part,
 *  alchemy/transduce.alc, makes the same tree's events from the rule
 *  passes of `make()`, and the render, alchemy/render.alc, writes it back
 *  as GBNF.
 *
 *    { "type": "grammar", "start": "root", "rules": [
 *      { "type": "rule", "name": "root",
 *        "alternatives": [ [ element, ... ], ... ] }, ... ] }
 *
 *  GBNF starts from the rule named root, wherever the text defines it, so
 *  the grammar's `start` is "root", before any rule; a target that starts
 *  from its first rule writes that rule first.
 *
 *  The tree parser reads GBNF with the meta-grammar `gbnfRules` reads it
 *  with, its lexer and every alternate as they are, and actions of its own
 *  (TREE below) in place of the ones that build the compiler's IR, so the
 *  rule passes a part reads are the ones the meta-grammar makes. A token
 *  whose text needs reading (a string, a class, a tokenizer terminal, a
 *  run of postfix operators) is given what it reads as its value by the
 *  action that reads it, since a part reads a token's value and never the
 *  work an action does with it.
 *
 *  An element is an object whose first member names its type:
 *
 *    name             { type: 'reference', name }
 *    "ab"             { type: 'literal', text, caseSensitive: true }
 *    [a-z_], [^"]     { type: 'class', negated, members: [{ from, to }] }
 *    .                { type: 'any' }
 *    <think>, !<[9]>  { type: 'token', negated, text }
 *    ( ... )          { type: 'group', alternatives }
 *
 *  and its postfix operators are its last member, `repeat`, in the order
 *  they are written, the innermost first: `x*?` repeats `x` from 0 up and
 *  that from 0 to 1. A string's text is the characters its escapes name,
 *  `""` included; a class's members are code points, a lone character a
 *  member whose bounds are one; a tokenizer terminal's text is what stands
 *  between its angle brackets, as written. The tree holds the rules the
 *  text writes, a second definition of a name included: llama.cpp keeps
 *  the last, and a compiler does too. Comments are not kept.
 *
 *  The tree holds what the schema allows, so the parser refuses what it
 *  cannot hold, each with a code of its own: an escape GBNF does not have,
 *  one past U+10FFFF, or, in a string, half of a surrogate pair standing
 *  alone, which names no character (gbnf_escape), a class range that ends
 *  below where it starts (gbnf_class_range), an empty class
 *  (gbnf_empty_class), a repetition whose most is below its least
 *  (gbnf_reversed_repetition), a count past 2^53 - 1 (gbnf_count) and a
 *  group left open (gbnf_unclosed). A class's members are code points, so
 *  a surrogate is one, and the two escapes of a pair are two members.
 */

import type { Rule } from '@tabnas/parser'

import {
  gbnfRules,
  gbnfOptions,
  installGbnfRules,
  readChar,
  REP,
  GbnfParseError,
} from './converter'


// An element, a rule and a grammar of the schema, as this reader builds
// them: tabnas/bnf's `RulesElement`, `RulesRule` and `GrammarRules`.
type GbnfTreeRepeat = { min: number; max?: number }
type GbnfTreeElement = { type: string; [member: string]: any; repeat?: GbnfTreeRepeat[] }
type GbnfTreeRule = { type: 'rule'; name: string; alternatives: GbnfTreeElement[][] }
type GbnfTree = { type: 'grammar'; start: 'root'; rules: GbnfTreeRule[] }


// The codes the tree parser refuses a source with, beside the engine's:
// the `error` and `hint` options `make()` gives the parser.
const TREE_OPTIONS = {
  error: {
    gbnf_escape:
      'the terminal {src} holds an escape GBNF does not have, or one that names no character',
    gbnf_class_range:
      'the character class {src} has a range that ends below where it starts',
    gbnf_empty_class:
      'the character class {src} is empty, and matches nothing',
    gbnf_reversed_repetition:
      'the repetition {src} allows fewer than it requires: its most is below its least',
    gbnf_count:
      'a repetition count in {src} is past 9007199254740991, the largest whole number the tree holds',
    gbnf_unclosed:
      'a group is not closed',
  },
  hint: {
    gbnf_escape:
      'GBNF escapes are \\t \\r \\n \\\\ \\" \\[ \\] \\- \\xXX \\uXXXX \\UXXXXXXXX, naming a code point up to \\U0010FFFF, and a surrogate in a string is half of a pair, \\uD83D\\uDE00.',
    gbnf_class_range:
      'Write a range from its lower end to its higher, as [a-z].',
    gbnf_empty_class:
      'A class holds a character or a range at least.',
    gbnf_reversed_repetition:
      'In {m,n} the n is the most and the m the least, so n is not below m.',
    gbnf_count:
      'A repetition count is a whole number no larger than 9007199254740991.',
    gbnf_unclosed:
      'Close the group with ).',
  },
}


// A string's text: the characters its escapes name, its code points read
// as one UTF-16 sequence, so that two escapes naming a surrogate pair's
// halves are the character the pair encodes. A half standing alone names
// no character, and is refused as an escape that names none.
function stringText(raw: string): string {
  let out = ''
  let i = 1
  const end = raw.length - 1
  while (i < end) {
    const { cp, next } = readChar(raw, i)
    out += String.fromCodePoint(cp)
    i = next
  }
  if (/\p{Cs}/u.test(out)) throw new GbnfParseError(`gbnf: a lone surrogate in ${raw}`)
  return out
}


// A class's members, read as the IR parser reads them: `^` first negates
// it, `a-b` is a range, and a `-` before the closing bracket is a member.
function classValue(raw: string): { negated: boolean; members: { from: number; to: number }[] } | string {
  let i = 1
  const end = raw.length - 1
  let negated = false
  if (raw[i] === '^') {
    negated = true
    i++
  }
  const members: { from: number; to: number }[] = []
  while (i < end) {
    const lo = readChar(raw, i)
    i = lo.next
    if (raw[i] === '-' && i + 1 < end) {
      const hi = readChar(raw, i + 1)
      i = hi.next
      if (hi.cp < lo.cp) return 'gbnf_class_range'
      members.push({ from: lo.cp, to: hi.cp })
    } else {
      members.push({ from: lo.cp, to: lo.cp })
    }
  }
  if (0 === members.length) return 'gbnf_empty_class'
  return { negated, members }
}


// A run of postfix operators as its repetitions, in the order written,
// or the code it is refused with.
function postfixValue(src: string): GbnfTreeRepeat[] | string {
  const op = new RegExp('[*+?]|' + REP, 'g')
  const out: GbnfTreeRepeat[] = []
  let m: RegExpExecArray | null
  while ((m = op.exec(src)) !== null) {
    if ('*' === m[0][0]) out.push({ min: 0 })
    else if ('+' === m[0][0]) out.push({ min: 1 })
    else if ('?' === m[0][0]) out.push({ min: 0, max: 1 })
    else {
      const min = parseInt(m[1], 10)
      const max = undefined === m[2] ? min : '' === m[2] ? undefined : parseInt(m[2], 10)
      if (!Number.isSafeInteger(min) || (undefined !== max && !Number.isSafeInteger(max))) {
        return 'gbnf_count'
      }
      if (undefined !== max && max < min) return 'gbnf_reversed_repetition'
      out.push(undefined === max ? { min } : { min, max })
    }
  }
  return out
}


// What reading a terminal's text refuses, as the tree's code.
function escapeCode(read: () => any): any {
  try {
    return read()
  } catch (e) {
    if (e instanceof GbnfParseError) return 'gbnf_escape'
    throw e
  }
}


// An action, as the meta-grammar's alternates and states hold one.
type Act = (r: Rule, ctx: any) => any

// The element an atom built, its repetitions appended, onto the
// alternative; or the refusal of a group the source ended inside.
function element(r: Rule, ctx: any, repeat?: GbnfTreeRepeat[]): any {
  const el = r.child.node
  if (null == el) return ctx.t0.bad('gbnf_unclosed')
  if (repeat) el.repeat = repeat.map((rep) => ({ ...rep }))
  r.node.push(el)
}

// What each action of `gbnfRules` builds in the tree instead: the states'
// own (`bo`, `bc`), and the alternates', keyed by their `s` pattern, an
// alternate with none under ''. Every alternate that carries an action in
// `gbnfRules` has one here, and no other.
const TREE: Record<string, {
  bo?: Act
  bc?: Act
  open?: Record<string, Act>
  close?: Record<string, Act>
}> = {
  gbnf: {
    bo: (r) => { r.node = { type: 'grammar', start: 'root', rules: [] } },
  },

  prod: {
    open: {
      '#NM #DEF': (r) => { r.u.name = r.o[0].src },
    },
    bc: (r) => {
      if (r.child && undefined !== r.child.node) {
        r.node.rules.push({ type: 'rule', name: r.u.name, alternatives: r.child.node })
      }
    },
  },

  alts: {
    bo: (r) => { r.node = [] },
    bc: (r) => {
      if (r.child && undefined !== r.child.node) r.node.push(r.child.node)
    },
  },

  seq: {
    bo: (r) => { r.node = [] },
  },

  elem: {
    close: {
      // The run's repetitions, which its token carries from here.
      '#POST': (r, ctx) => {
        const read = postfixValue(String(r.c[0].src))
        if ('string' === typeof read) return r.c[0].bad(read)
        r.c[0].val = read
        return element(r, ctx, read)
      },
      '': (r, ctx) => element(r, ctx),
    },
  },

  atom: {
    bo: (r) => { r.node = undefined; r.u.grouped = false },
    open: {
      '#GS': (r) => {
        const text = escapeCode(() => stringText(String(r.o[0].src)))
        if ('gbnf_escape' === text) return r.o[0].bad(text)
        r.o[0].val = text
        r.node = { type: 'literal', text, caseSensitive: true }
      },
      '#CC': (r) => {
        const read = escapeCode(() => classValue(String(r.o[0].src)))
        if ('string' === typeof read) return r.o[0].bad(read)
        r.o[0].val = read
        r.node = { type: 'class', negated: read.negated, members: read.members.map((m: any) => ({ ...m })) }
      },
      '#DOT': (r) => { r.node = { type: 'any' } },
      '#TOK': (r) => {
        const src = String(r.o[0].src)
        const negated = '!' === src[0]
        const text = src.slice(negated ? 2 : 1, -1)
        r.o[0].val = { negated, text }
        r.node = { type: 'token', negated, text }
      },
      '#NM': (r) => { r.node = { type: 'reference', name: r.o[0].src } },
      '#LP': (r) => { r.u.grouped = true },
    },
    close: {
      '#RP': (r) => { r.node = { type: 'group', alternatives: r.child.node } },
    },
  },
}


// The meta-grammar's rule table with the tree's actions: every alternate
// of `gbnfRules`, its `s`, `p`, `r`, `b`, `g` and conditions as they are,
// and each action replaced by the one TREE gives it.
function treeRules(): typeof gbnfRules {
  const table: any = {}
  let used = 0
  for (const name of Object.keys(gbnfRules)) {
    const ir = gbnfRules[name]
    const tree = TREE[name] ?? {}
    const bind = (alts: any[] | undefined, acts: Record<string, Act> | undefined,
      state: string) =>
      alts?.map((alt) => {
        const { a, ...rest } = alt
        if (null == a) return rest
        const act = acts?.[alt.s ?? '']
        if (null == act) {
          throw new Error(`gbnf tree: ${name}.${state} has no action for ${alt.s ?? '(no s)'}`)
        }
        used++
        return { ...rest, a: act }
      })
    table[name] = {
      bo: tree.bo,
      bc: tree.bc,
      open: bind(ir.open, tree.open, 'open'),
      close: bind(ir.close, tree.close, 'close'),
    }
  }
  const declared = Object.values(TREE).reduce(
    (n, t) => n + Object.keys(t.open ?? {}).length + Object.keys(t.close ?? {}).length, 0)
  if (used !== declared) {
    throw new Error(`gbnf tree: ${declared} actions declared, ${used} bound`)
  }
  return table
}

const gbnfTreeRules = treeRules()


// Where GBNF's own matchers stop reading, in `w`, the text from the
// cursor: the index of the unit that decides how far their token runs,
// past which none of them reads. A string, a class and a tokenizer token
// read to the quote, bracket or angle that closes them, a backslash taking
// the unit after it, and `!` the `<` after it; a run of postfix operators
// reads every operator, count, comma, brace and space of the run and the
// unit after; a name reads its word and the unit after; `::=` reads three
// units. Every other token is the engine's, whose matchers read the window
// themselves.
function gbnfReach(w: string): number {
  switch (w[0]) {
    case '"':
      return closing(w, 1, '"')
    case '[':
      return closing(w, 1, ']')
    case '<':
      return closing(w, 1, '>')
    case '!':
      return '<' === w[1] ? closing(w, 2, '>') : 1
    case ':':
      return 2
    case '*':
    case '+':
    case '?':
    case '{':
      return (/^[*+?{},0-9 \t\r\n]*/.exec(w) as RegExpExecArray)[0].length
    default:
      return (/^[A-Za-z0-9_-]*/.exec(w) as RegExpExecArray)[0].length
  }
}

// The index in `w` of the first `end` at or after `from` that no backslash
// escapes, or `w.length` where there is none.
function closing(w: string, from: number, end: string): number {
  for (let i = from; i < w.length; i++) {
    if ('\\' === w[i]) i++
    else if (end === w[i]) return i
  }
  return w.length
}


// A lexer matcher that runs before every other one and cuts no token: in a
// parse from a reader a window at a time (`lex.window`, admin ADR-30), the
// text after the cursor is the window's, which may end inside a token, so
// that a match token's expression would match a shorter token, or none,
// where the whole text has a longer one. It reads the window on, twice as
// far each time, until the unit that decides where the token ends lies
// inside it (`reach`) or the source has ended, so that every matcher after
// it sees what the whole text shows it. A whole text is all read.
//
// The cut it guards is the meta-grammar's own: `#TOK`'s expression fails on
// `<|end|>` when the window ends before its `>`, and no other matcher takes
// `<`, so the parse refuses it; a string's, a class's or a postfix run's
// expression likewise settles for what the window shows. An expression
// cannot say that it wanted more text, so the engine, which cuts a token
// again only after a matcher read to the window's end (tabnas/parser#326),
// cannot know to: this matcher is the fix, not a workaround.
function reachMatcher(reach: (w: string) => number): any {
  return {
    order: 9e5,
    make: () => (lex: any) => {
      if (!lex.windowOpen) return undefined
      let ahead = 1
      for (;;) {
        lex.fill(ahead)
        const w: string = lex.window()
        const decides = reach(w)
        if (decides < w.length || !lex.windowOpen) return undefined
        ahead = Math.max(decides + 1, 2 * w.length)
      }
    },
  }
}


// A fresh parser that reads a GBNF document as the tree: the parser a
// host streams a document through with the part, whose rule passes the
// part reads, and whose value is the tree. It reads a source a window at a
// time when it is parsed from a reader: its matchers read the text only
// through the window, the meta-grammar's match tokens behind `gbnfReach`.
function make(): any {
  const { Tabnas } = require('@tabnas/parser')
  const options = gbnfOptions()
  options.error = { ...TREE_OPTIONS.error }
  options.hint = { ...TREE_OPTIONS.hint }
  options.lex = { window: true, match: { 'gbnf-reach': reachMatcher(gbnfReach) } }
  const tn = new Tabnas(options)
  installGbnfRules(tn, gbnfTreeRules)
  return tn
}


let _treeParser: any = null

// A GBNF document as the tree, read whole. A source the meta-grammar
// refuses, or the tree cannot hold, fails with a GbnfParseError naming
// the line and column, its `cause` the engine's error with its code.
function parseGbnfTree(src: string): GbnfTree {
  if (null == _treeParser) _treeParser = make()
  try {
    // An empty source makes no rule pass, and the engine answers nothing
    // for it: it is the grammar of no rules, as a source of comments is.
    return (_treeParser.parse(src) ?? { type: 'grammar', start: 'root', rules: [] }) as GbnfTree
  } catch (e: any) {
    const line = e?.lineNumber ?? e?.row
    const column = e?.columnNumber ?? e?.col
    const loc = (line != null && column != null)
      ? ` at line ${line}, column ${column}`
      : ''
    const raw = e?.message ? String(e.message).split('\n')[0] : String(e)
    throw new GbnfParseError(`gbnf: parse error${loc}: ${raw}`, { line, column }, e)
  }
}


export { make, parseGbnfTree, gbnfTreeRules }

export type { GbnfTree, GbnfTreeRule, GbnfTreeElement, GbnfTreeRepeat }
