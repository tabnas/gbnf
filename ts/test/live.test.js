/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

/*  live.test.js — schema-generated GBNF, the kind tools actually emit.
 *
 *  `test/live/json-schema-corpus.json` holds the 70 expected outputs of
 *  llama.cpp's JSON-schema-to-grammar converter (see the README there
 *  for provenance). Two claims are graded:
 *
 *    1. EVERY case compiles to a GrammarSpec.
 *    2. For the sampled cases, valid JSON per the source schema parses
 *       and near-miss invalid JSON does not. Samples are read off the
 *       grammar text, which is stricter than intuition in places — the
 *       `time` format requires a zone suffix, and optional properties
 *       admit only the schema's declared order.
 */
'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const Fs = require('node:fs')
const Path = require('node:path')

const { Tabnas } = require('@tabnas/parser')
const { gbnf: gbnfPlugin, gbnfConvert } = require('..')

const CORPUS = JSON.parse(Fs.readFileSync(
  Path.join(__dirname, '..', '..', 'test', 'live',
    'json-schema-corpus.json'), 'utf8'))

const tn = new Tabnas({ plugins: [gbnfPlugin] })

function parses(grammar, sample) {
  const j = tn.make()
  j.gbnf(grammar)
  try {
    j.parse(sample)
    return null
  } catch (e) {
    return String(e.message).split('\n')[0].replace(/\x1b\[[0-9;]*m/g, '')
  }
}

// Hand-written samples per case name. `yes` must parse; `no` must not.
const SAMPLES = {
  'min 0': { yes: ['0', '5', '12', '9007199254740991'], no: ['-1', '00', ''] },
  'min 25': { yes: ['25', '100', '999'], no: ['24', '0'] },
  'min -123 max 42': { yes: ['-123', '-1', '0', '42'], no: ['-124', '43'] },
  'min 0 max 23': { yes: ['0', '9', '23'], no: ['24', '-1'] },
  'string': { yes: ['"a"', '""', '"hello world"'], no: ['"a', 'a"'] },
  'string w/ min length 1': { yes: ['"a"', '"ab"'], no: ['""'] },
  'string w/ min & max length': { yes: ['"a"', '"abcd"'], no: ['""', '"abcde"'] },
  'boolean': { yes: ['true', 'false'], no: ['null', '1'] },
  'integer': { yes: ['0', '-5', '123'], no: ['1.5', '"1"'] },
  'string const': { yes: ['"foo"'], no: ['"bar"'] },
  'non-string enum': {
    yes: ['"red"', '"amber"', '"green"', 'null', '42', '["foo"]'],
    no: ['"blue"'],
  },
  'string array': { yes: ['[]', '["a"]', '["a", "b"]', '[ ]'], no: ['[', '["a",]'] },
  'tuple1': { yes: ['["a"]'], no: ['[]'] },
  'tuple2': { yes: ['["a", 1]', '["a", -1.5e3]'], no: ['["a"]'] },
  'number': { yes: ['0', '-1.5', '1e9', '1.25e-7'], no: ['.5', '"x"'] },
  'minItems': { yes: ['[true, false]', '[true, false, true]'], no: ['[]', '[true]'] },
  'maxItems 1': { yes: ['[]', '[true]'], no: ['[true, false]'] },
  'simple regexp': { yes: ['"abefgkl"', '"abcddefggghijkl"'], no: ['"ab"'] },
  'regexp quote': { yes: ['"""'], no: [] },
  'required props in original order': {
    yes: ['{"b": "x", "c": "y", "a": "z"}'],
    no: ['{"a": "z"}'],
  },
  '1 optional prop': { yes: ['{}', '{"a": "x"}'], no: [] },
  'N optional props': {
    yes: ['{}', '{"a": "x"}', '{"b": "x"}', '{"c": "x"}',
      '{"a": "1", "b": "2"}', '{"a": "1", "b": "2", "c": "3"}',
      '{"b": "2", "c": "3"}', '{"a": "1", "c": "3"}'],
    no: ['{"c": "3", "a": "1"}'],
  },
  'required + optional props each in original order': {
    yes: ['{"b": "1", "a": "2", "d": "3"}',
      '{"b": "1", "a": "2", "d": "3", "c": "x"}',
      '{"b": "1", "a": "2", "c": "x"}'],
    no: ['{"b": "1", "a": "2", "c": "x", "d": "3"}'],
  },
  'anyOf': { yes: ['{"a": 1}', '{"b": 2}', '{}'], no: [] },
  'allOf with multiple enum schemas': { yes: ['"b"', '"c"'], no: ['"a"'] },
  'top-level $ref': { yes: ['{"a": "x"}'], no: ['{}'] },
  'conflicting names': { yes: ['{"number": {"number": {"root": 1}}}'], no: [] },
  'exotic formats': {
    yes: ['["2024-01-31", "01234567-89ab-cdef-0123-456789abcdef", ' +
      '"12:34:56Z", "2024-01-31T12:34:56+01:00"]'],
    no: [],
  },
  'literal string with escapes': {
    yes: ['{"code": " \\r \\n \\" \\\\ "}'],
    no: [],
  },
  'additional props': { yes: ['{}', '{"x": [1, 2]}'], no: [] },
  'empty w/o additional props': { yes: ['{}'], no: ['{"a": 1}'] },
}


describe('live', () => {

  describe('compiles', () => {
    for (const c of CORPUS.cases) {
      it(c.name, () => {
        const spec = gbnfConvert(c.grammar)
        assert.ok(spec.rule.root, `"${c.name}" compiled without a root rule`)
      })
    }
  })


  describe('parses', () => {
    for (const c of CORPUS.cases) {
      const s = SAMPLES[c.name]
      if (!s) continue
      for (const sample of s.yes) {
        it(`${c.name}: ${JSON.stringify(sample)}`, () => {
          const err = parses(c.grammar, sample)
          assert.equal(err, null, `"${c.name}" rejected its sample: ${err}`)
        })
      }
      for (const sample of s.no) {
        it(`${c.name}: rejects ${JSON.stringify(sample)}`, () => {
          const err = parses(c.grammar, sample)
          assert.notEqual(err, null,
            `"${c.name}" accepted ${JSON.stringify(sample)}, which is ` +
            `outside its language`)
        })
      }
    }
  })


  it('every sampled case exists in the corpus', () => {
    const names = new Set(CORPUS.cases.map((c) => c.name))
    for (const name of Object.keys(SAMPLES)) {
      assert.ok(names.has(name), `sampled case "${name}" is not in the corpus`)
    }
  })

})
