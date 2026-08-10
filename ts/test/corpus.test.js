/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

/*  corpus.test.js — the llama.cpp conformance corpus.
 *
 *  `test/corpus/*.gbnf` holds llama.cpp's own grammars, verbatim (see
 *  the README there for provenance). Two claims are graded:
 *
 *    1. EVERY grammar compiles to a GrammarSpec. This is the corpus's
 *       primary job — it is what proves the notation front-end reads
 *       real GBNF, not a tidied dialect of it.
 *    2. The samples listed below parse, or fail, exactly as recorded.
 *
 *  Claim 2 is the honest one. Six of the seven grammars accept real
 *  input end to end; `arithmetic.gbnf` compiles but accepts nothing,
 *  and two shapes inside `json.gbnf` and `c.gbnf` are out of reach.
 *  Each is a property of the shared compiler's helper-rule emission and
 *  the engine's tokenising lexer, not of this front-end, and each is
 *  written up in `doc/known-gaps.md`. They are asserted here as
 *  EXPECTED FAILURES rather than dropped: if one starts working, this
 *  suite says so, and the gap document is then wrong.
 */
'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const Fs = require('node:fs')
const Path = require('node:path')

const { Tabnas } = require('@tabnas/parser')
const { gbnf: gbnfPlugin, gbnfConvert } = require('..')

const CORPUS = Path.join(__dirname, '..', '..', 'test', 'corpus')
const tn = new Tabnas({ plugins: [gbnfPlugin] })

function load(name) {
  return Fs.readFileSync(Path.join(CORPUS, name + '.gbnf'), 'utf8')
}

function parses(name, sample) {
  const j = tn.make()
  j.gbnf(load(name))
  try {
    j.parse(sample)
    return null
  } catch (e) {
    return String(e.message).split('\n')[0].replace(/\x1b\[[0-9;]*m/g, '')
  }
}

// Every file in the corpus, named explicitly. A glob would let a
// deleted grammar pass unnoticed; the census is the point.
const GRAMMARS = [
  'arithmetic',
  'c',
  'chess',
  'japanese',
  'json',
  'json_arr',
  'list',
]

// Samples that must parse. Kept small and real: each is text the
// grammar is meant to constrain a model into producing.
const ACCEPT = {
  c: ['int a(){}', 'float b(){}', 'char c(){}'],
  chess: [
    '1. e4 e5\n2. e4 e5\n',
    '1. e4 e5\n2. O-O e5\n',
    '1. e4 e5\n10. exd5 e5\n',
  ],
  // japanese.gbnf's classes are pairwise disjoint and it has no string
  // literals, so its class tokens are lexed eagerly — which is what
  // lets `jp-char+ ([ \t\n] jp-char+)*` cross the space.
  japanese: ['こんにちは', 'ア', '一', '、', 'こん にちは', 'ア一'],
  json: ['{}', '{ }', '{\n}'],
  json_arr: ['[\n]', '[\n ]'],
  list: ['- a\n', '- hello\n- world\n'],
}

// Samples the grammar defines but this compiler cannot accept. Each
// entry names the gap it demonstrates; see doc/known-gaps.md.
const EXPECTED_FAILURES = [
  ['arithmetic', 'a=b\n', 'follow-set gap: ws ::= [ \\t\\n]* then a term'],
  ['arithmetic', 'x = 1\n', 'follow-set gap: ws ::= [ \\t\\n]* then a term'],
  ['json', '{"a":1}', 'overlapping terminals: the escape class matches the closing quote'],
  ['c', 'int a(){//x\n}', 'follow-set gap: statement* then a comment'],
]


describe('corpus', () => {

  describe('compiles', () => {
    for (const name of GRAMMARS) {
      it(name + '.gbnf', () => {
        const spec = gbnfConvert(load(name))
        assert.ok(spec.rule.root, `${name}.gbnf compiled without a root rule`)
        assert.equal(spec.options.rule.start, '__start__')
        assert.ok(
          0 < Object.keys(spec.rule).length,
          `${name}.gbnf compiled to an empty spec`)
      })
    }
  })


  describe('accepts', () => {
    for (const [name, samples] of Object.entries(ACCEPT)) {
      for (const sample of samples) {
        it(`${name}.gbnf: ${JSON.stringify(sample)}`, () => {
          const err = parses(name, sample)
          assert.equal(err, null, `${name}.gbnf rejected its own sample: ${err}`)
        })
      }
    }
  })


  describe('known gaps', () => {
    for (const [name, sample, why] of EXPECTED_FAILURES) {
      it(`${name}.gbnf: ${JSON.stringify(sample)} — ${why}`, () => {
        const err = parses(name, sample)
        assert.notEqual(
          err,
          null,
          `${name}.gbnf now accepts ${JSON.stringify(sample)}. That is ` +
          `good news, and it means doc/known-gaps.md ("${why}") is out ` +
          `of date — update the document and move this case into ACCEPT.`)
      })
    }
  })


  it('the corpus on disk is exactly the census above', () => {
    const found = Fs.readdirSync(CORPUS)
      .filter((f) => f.endsWith('.gbnf'))
      .map((f) => f.replace(/\.gbnf$/, ''))
      .sort()
    assert.deepEqual(found, [...GRAMMARS].sort())
  })

})
