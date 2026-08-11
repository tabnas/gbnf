/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */
'use strict'

/*  render.test.js
 *  The renderer: grammar IR -> GBNF source text.
 *
 *  Two properties carry the suite. FIXED POINT: for every grammar in
 *  both corpora, parse -> render -> parse reproduces the IR exactly,
 *  so the renderer chooses spellings, never meanings. FAITHFUL OR
 *  REFUSED: IR constructs GBNF cannot express raise GbnfRenderError
 *  instead of being approximated — with the one exact expansion
 *  (case-insensitive literals to classes) proven through a parse.
 *
 *  The ABNF bridge is graded end to end: @tabnas/abnf parses into the
 *  same IR, so parseAbnf + renderGbnf turns an ABNF grammar into a
 *  .gbnf a sampler could consume — and the rendered grammar must
 *  accept exactly what the ABNF said, case-insensitivity included.
 */

const { describe, it } = require('node:test')
const assert = require('node:assert')
const Fs = require('node:fs')
const Path = require('node:path')

const { Tabnas } = require('@tabnas/parser')
const { parseAbnf } = require('@tabnas/abnf')
const {
  gbnf: gbnfPlugin,
  parseGbnf,
  renderGbnf,
  GbnfRenderError,
} = require('..')

const CORPUS = Path.join(__dirname, '..', '..', 'test', 'corpus')
const LIVE = JSON.parse(Fs.readFileSync(
  Path.join(__dirname, '..', '..', 'test', 'live',
    'json-schema-corpus.json'), 'utf8'))

const tn = new Tabnas({ plugins: [gbnfPlugin] })

// Render a GBNF source and hand back both the text and the reparse.
function roundTrip(src) {
  const ir1 = parseGbnf(src)
  const out = renderGbnf(ir1)
  const ir2 = parseGbnf(out)
  return { ir1, out, ir2 }
}

function accepts(grammarText, sample) {
  const j = tn.make()
  j.gbnf(grammarText)
  try {
    j.parse(sample)
    return true
  } catch (e) {
    return false
  }
}


describe('render', () => {

  describe('constructs', () => {

    it('literals, with GBNF escapes', () => {
      const { out, ir1, ir2 } = roundTrip(
        'root ::= "a\\"b" "\\\\" "\\n\\r\\t" "\\x07"')
      assert.match(out, /"a\\"b"/)
      assert.match(out, /"\\\\"/)
      assert.match(out, /"\\n\\r\\t"/)
      assert.match(out, /"\\x07"/)
      assert.deepStrictEqual(ir2.productions, ir1.productions)
    })

    it('classes: ranges, members, negation, dot', () => {
      const { out, ir1, ir2 } = roundTrip(
        'root ::= [a-z0-9] [^\\n] . [NBKQR]')
      assert.match(out, /\[a-z0-9\]/)
      assert.match(out, /\[\^\\n\]/)
      assert.match(out, /\./)
      assert.deepStrictEqual(ir2.productions, ir1.productions)
    })

    it('classes: hyphen, caret, brackets and astral members survive', () => {
      const src =
        'root ::= [-+*/] [a^b] [\\]\\[] [\\U0001F600-\\U0001F64F]'
      const { ir1, ir2 } = roundTrip(src)
      assert.deepStrictEqual(ir2.productions, ir1.productions)
    })

    it('postfix: all forms, chaining, and groups', () => {
      const { out, ir1, ir2 } = roundTrip(
        'root ::= "a"* "b"+ "c"? "d"{2} "e"{3,} "f"{4,5} ("g" | "h")* "i"*?')
      assert.match(out, /"d"\{2\}/)
      assert.match(out, /"e"\{3,\}/)
      assert.match(out, /"f"\{4,5\}/)
      assert.match(out, /\("g" \| "h"\)\*/)
      assert.match(out, /"i"\*\?/)
      assert.deepStrictEqual(ir2.productions, ir1.productions)
    })

    it('empty alternatives keep their shape', () => {
      const src = 'root ::= ws "x"\nws ::= | " " | "\\n"'
      const { out, ir1, ir2 } = roundTrip(src)
      assert.match(out, /ws ::= {2}\| " " \| "\\n"/)
      assert.deepStrictEqual(ir2.productions, ir1.productions)
    })

    it('cross-references and rule order are preserved', () => {
      const { out } = roundTrip(
        'root ::= b a\na ::= "x"\nb ::= "y"')
      assert.deepStrictEqual(
        out.trim().split('\n').map((l) => l.split(' ')[0]),
        ['root', 'a', 'b'])
    })
  })


  describe('root synthesis', () => {

    it('a grammar without root gains root ::= <first>', () => {
      const g = parseAbnf('greet = "hi"\n')
      const out = renderGbnf(g)
      assert.match(out, /^root ::= greet\n/)
      assert.equal(accepts(out, 'hi'), true)
    })

    it('opts.start picks the synthesized target', () => {
      const g = parseAbnf('a = "x"\nb = "y"\n')
      const out = renderGbnf(g, { start: 'b' })
      assert.match(out, /^root ::= b\n/)
      assert.equal(accepts(out, 'y'), true)
      assert.equal(accepts(out, 'x'), false)
    })

    it('an existing root is used as is', () => {
      const { out } = roundTrip('root ::= "z"')
      assert.equal(out, 'root ::= "z"\n')
    })

    it('an undefined start is an error', () => {
      const g = parseAbnf('a = "x"\n')
      assert.throws(
        () => renderGbnf(g, { start: 'nope' }),
        (e) => e instanceof GbnfRenderError && /nope/.test(e.message))
    })
  })


  describe('faithful or refused', () => {

    it('a case-insensitive literal expands exactly', () => {
      const g = parseAbnf('greet = "hi-5"\n')
      const out = renderGbnf(g)
      assert.match(out, /\[hH\] \[iI\] "-5"/)
      for (const s of ['hi-5', 'HI-5', 'Hi-5', 'hI-5']) {
        assert.equal(accepts(out, s), true, s)
      }
      assert.equal(accepts(out, 'hi-6'), false)
    })

    it('an expanded literal under repetition gains parentheses', () => {
      const g = parseAbnf('root = 2"ab"\n')
      const out = renderGbnf(g)
      assert.match(out, /\(\[aA\] \[bB\]\)\{2\}/)
      assert.equal(accepts(out, 'abAB'), true)
      assert.equal(accepts(out, 'ab'), false)
    })

    it('%s case-sensitive ABNF literals stay literals', () => {
      const g = parseAbnf('root = %s"Hi"\n')
      const out = renderGbnf(g)
      assert.match(out, /"Hi"/)
      assert.equal(accepts(out, 'Hi'), true)
      assert.equal(accepts(out, 'hi'), false)
    })

    it('a non-class regex is refused', () => {
      const g = {
        productions: [{
          name: 'root',
          alts: [[{ kind: 'regex', pattern: 'a+b', flags: '' }]],
        }],
      }
      assert.throws(
        () => renderGbnf(g),
        (e) => e instanceof GbnfRenderError &&
          /not a character class/.test(e.message))
    })

    it('engine tokens and prose are refused, naming the rule', () => {
      for (const el of [
        { kind: 'token', name: '#NR' },
        { kind: 'prose', text: 'free text' },
      ]) {
        const g = { productions: [{ name: 'root', alts: [[el]] }] }
        assert.throws(
          () => renderGbnf(g),
          (e) => e instanceof GbnfRenderError && e.rule === 'root')
      }
    })

    it('illegal rule names and duplicates are refused', () => {
      assert.throws(
        () => renderGbnf({
          productions: [{ name: 'a.b', alts: [[]] }],
        }),
        (e) => e instanceof GbnfRenderError && /a\.b/.test(e.message))
      assert.throws(
        () => renderGbnf({
          productions: [
            { name: 'root', alts: [[]] },
            { name: 'root', alts: [[]] },
          ],
        }),
        (e) => e instanceof GbnfRenderError && /duplicate/.test(e.message))
    })
  })


  describe('fixed point over the corpora', () => {

    for (const name of Fs.readdirSync(CORPUS).filter((f) =>
      f.endsWith('.gbnf')).sort()) {
      it(`corpus: ${name}`, () => {
        const src = Fs.readFileSync(Path.join(CORPUS, name), 'utf8')
        const { ir1, ir2 } = roundTrip(src)
        assert.deepStrictEqual(ir2.productions, ir1.productions)
      })
    }

    for (const c of LIVE.cases) {
      it(`live: ${c.name}`, () => {
        const { ir1, ir2 } = roundTrip(c.grammar)
        assert.deepStrictEqual(ir2.productions, ir1.productions)
      })
    }

    it('a rendered grammar still accepts and rejects', () => {
      const src = Fs.readFileSync(Path.join(CORPUS, 'json.gbnf'), 'utf8')
      const out = renderGbnf(parseGbnf(src))
      assert.equal(accepts(out, '{"answer": [1, 2, 3]}'), true)
      assert.equal(accepts(out, '{"answer": [1, 2, 3],}'), false)
    })
  })


  describe('the abnf bridge', () => {

    it('an ABNF grammar becomes a working .gbnf', () => {
      const g = parseAbnf(
        'greet = hello 1*SP name\n' +
        'hello = "hello"\n' +
        'name = 1*(%x61-7A)\n')
      const out = renderGbnf(g)
      // Core-rule SP arrives as a class production and renders.
      assert.equal(accepts(out, 'hello world'), true)
      assert.equal(accepts(out, 'HELLO  world'), true)
      assert.equal(accepts(out, 'helloworld'), false)
    })
  })
})
