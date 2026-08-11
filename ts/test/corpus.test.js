/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

/*  corpus.test.js — the llama.cpp conformance corpus.
 *
 *  `test/corpus/*.gbnf` holds llama.cpp's own grammars, verbatim (see
 *  the README there for provenance). Three claims are graded:
 *
 *    1. EVERY grammar compiles to a GrammarSpec. This is the corpus's
 *       primary job — it is what proves the notation front-end reads
 *       real GBNF, not a tidied dialect of it.
 *    2. The ACCEPT samples parse, and the REJECT samples do not. Both
 *       directions matter: a validator that accepts everything is not
 *       validating. Expectations are read off the grammar text itself
 *       (c.gbnf's `ws` is `[ \t\n]+`, so `int x=1;` really is outside
 *       its language; json_arr's separator is literally `",\n"`).
 *    3. The EXPECTED_FAILURES fail, exactly as recorded.
 *
 *  All seven grammars accept and reject real input end to end —
 *  keyword statements, funcCall expressions, keyword-prefixed
 *  identifiers included. One shape remains out of reach (chess's
 *  stacked optional prefixes, `Nf3`); it is written up in
 *  `doc/known-gaps.md` and asserted here as an EXPECTED FAILURE rather
 *  than dropped: if it starts working, this suite says so, and the gap
 *  document is then wrong.
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
  'english',
  'japanese',
  'json',
  'json_arr',
  'list',
]

// Samples that must parse. Kept small and real: each is text the
// grammar is meant to constrain a model into producing.
const ACCEPT = {
  arithmetic: [
    'a=b\n', 'x = 1\n', 'a = b\n',
    'a=b\nc=d\n',
    'a+b=c\n',                    // operators live in the LHS expr
    'long_name/3 = x\n',
    '(b+c)*d = x\n',
    'a=1\nb=2\nc=3\n',
    'a=b\n\n',                    // ident's trailing ws eats the 1st \n
  ],
  c: [
    'int a(){}', 'float b(){}', 'char c(){}', 'int a(){//x\n}',
    'int a(){int x = 1;}',
    'int f(){//c1\n//c2\n}',
    'int f(int y){while(x<1){x = x+1;}}',
    'int f(){return x;}', 'int f(){return 1;}',
    'int f(){for(x = 1; x<9; x = x+1){}}',
    'int f(){if(x<1){}}',
    'int f(){if(x<1){}else{}}',
    'int f(){f (1);}',            // funcCall statement: ws before "("
    'int f(){x = g(1);}',         // funcCall expression: no ws needed
    'int f(){/*m*/}',
    'int intx(){intx = 3;}',      // keyword-prefixed identifiers
    'int whilex(){whilex = 1;}',
  ],
  chess: [
    '1. e4 e5\n2. e4 e5\n',
    '1. e4 e5\n2. O-O e5\n',
    '1. e4 e5\n10. exd5 e5\n',
    '1. e4 e5\n2. Nxe4 d5\n',     // piece capture: "x" disambiguates
    '1. e4 e5\n2. e8=Q e4+\n',    // promotion, check marker
    '1. e4 e5\n2. O-O-O d5\n10. a1 h8\n',
  ],
  english: ['Hello, world!', 'a b c', '(x)', 'one\ntwo'],
  // japanese.gbnf's classes are pairwise disjoint and it has no string
  // literals, so its class tokens are lexed eagerly — which is what
  // lets `jp-char+ ([ \t\n] jp-char+)*` cross the space.
  japanese: ['こんにちは', 'ア', '一', '、', 'こん にちは', 'ア一', 'こん\nにちは'],
  json: [
    '{}', '{ }', '{\n}', '{"a":1}', '{ "a" : 1 }', '{"a":"b"}',
    '{"a":[1,2]}', '{"a":{"b":true}}', '{"s":"\\n"}', '{"s":"\\u0041"}',
    '{"a":1,"b":2}', '{"a":null}', '{"a":-1.5e3}', '{"a":[{"b":[]}]}',
  ],
  json_arr: ['[\n]', '[\n ]', '[\n1,\n2]', '[\n1,\n2\n]',
    '[\n"a",\n{"b": 1}]'],
  list: ['- a\n', '- hello\n- world\n', '- hello\n- world\n- x\n'],
}

// Samples that must NOT parse — each is just outside its grammar's
// language, usually by one character. These pin the validator half of
// the product: the grammars above are read literally, so c.gbnf's
// mandatory `ws` around `=` and json_arr's exact `",\n"` separator are
// enforced, not smoothed over.
const REJECT = {
  arithmetic: ['a=b', 'a=\n', '=b\n', 'A=b\n',
    'a=b+c\n',                    // RHS of `=` is a bare term
    'x1 = long_name / 3\n'],
  c: ['int a(){', 'int (){}', 'a(){}',
    'int a(){int x=1;}',          // ws around `=` is mandatory
    'int f(){f(1);}'],            // funcCall statement without ws
  chess: ['1. e4\n', 'e4 e5\n', '1. e4 e5\n2. i4 e5\n'],
  english: ['こんにちは', 'a\n'],
  japanese: ['abc', 'こんにちは\n'],
  json: ['{', '{"a"}', '{"a":}', '{a:1}', '{"a":1,}', '[1]'],
  json_arr: ['[', '[]', '[\n1, 2\n]'],
  list: ['a\n', '- a', '-a\n'],
}

// The one shape still out of reach, asserted as failing so this suite
// notices the day it is not. See doc/known-gaps.md.
const EXPECTED_FAILURES = [
  ['chess', '1. e4 e5\n2. Nf3 e5\n',
    'stacked optional prefixes: [a-h]? greedily takes the f that ' +
    '[a-h] needs'],
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


  describe('rejects', () => {
    for (const [name, samples] of Object.entries(REJECT)) {
      for (const sample of samples) {
        it(`${name}.gbnf: ${JSON.stringify(sample)}`, () => {
          const err = parses(name, sample)
          assert.notEqual(
            err, null,
            `${name}.gbnf accepted ${JSON.stringify(sample)}, which is ` +
            `outside its language`)
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
