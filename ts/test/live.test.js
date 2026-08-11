/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

/*  live.test.js — schema-generated GBNF, the kind tools actually emit.
 *
 *  `test/live/json-schema-corpus.json` holds the 70 expected outputs of
 *  llama.cpp's JSON-schema-to-grammar converter (see the README there
 *  for provenance). Two claims are graded:
 *
 *    1. EVERY case compiles to a GrammarSpec.
 *    2. EVERY case is sampled in BOTH directions: valid JSON per the
 *       source schema parses, and near-miss invalid JSON does not.
 *       Samples are read off the grammar text, which is stricter than
 *       intuition in places — the `time` format requires a zone suffix,
 *       and optional properties admit only the schema's declared order.
 *       Where the emitted grammar and the schema's intent part company
 *       (see 'optional props with empty name'), the GRAMMAR is what is
 *       sampled: this suite grades fidelity to the bytes a sampler
 *       would be fed, not to the schema behind them.
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
// The census test at the bottom pins that every corpus case appears
// here with both directions non-empty.
const SAMPLES = {
  'min 0': { yes: ['0', '5', '12', '9007199254740991'], no: ['-1', '00', ''] },
  'min 1': { yes: ['1', '9', '42'], no: ['0', '-1', '01'] },
  'min 3': { yes: ['3', '10', '29'], no: ['2', '-3'] },
  'min 9': { yes: ['9', '10', '89'], no: ['8', '0'] },
  'min 10': { yes: ['10', '19', '99'], no: ['9', '1'] },
  'min 25': { yes: ['25', '100', '999'], no: ['24', '0'] },
  'max 30': { yes: ['30', '29', '0', '-5'], no: ['31', '300'] },
  'min -5': { yes: ['-5', '-1', '0', '7'], no: ['-6', '-50'] },
  'min -123': { yes: ['-123', '-99', '0', '5'], no: ['-124', '-1234'] },
  'max -5': { yes: ['-5', '-99', '-123'], no: ['-4', '0', '5'] },
  'max 1': { yes: ['1', '0', '-7'], no: ['2', '10'] },
  'max 100': { yes: ['100', '99', '0', '-12'], no: ['101', '200'] },
  'min -123 max 42': { yes: ['-123', '-1', '0', '42'], no: ['-124', '43'] },
  'min 0 max 23': { yes: ['0', '9', '23'], no: ['24', '-1'] },
  'min 15 max 300': { yes: ['15', '99', '123', '300'], no: ['14', '301'] },
  'min 5 max 30': { yes: ['5', '9', '10', '30'], no: ['4', '31'] },
  'min -10 max 10': { yes: ['-10', '-9', '0', '9', '10'], no: ['-11', '11'] },
  'string': { yes: ['"a"', '""', '"hello world"'], no: ['"a', 'a"'] },
  'string w/ min length 1': { yes: ['"a"', '"ab"'], no: ['""'] },
  'string w/ min length 3': { yes: ['"abc"', '"abcd"'], no: ['"ab"', '""'] },
  'string w/ max length': { yes: ['""', '"abc"'], no: ['"abcd"'] },
  'string w/ min & max length': { yes: ['"a"', '"abcd"'], no: ['""', '"abcde"'] },
  'boolean': { yes: ['true', 'false'], no: ['null', '1'] },
  'integer': { yes: ['0', '-5', '123'], no: ['1.5', '"1"'] },
  'string const': { yes: ['"foo"'], no: ['"bar"'] },
  'non-string const': { yes: ['123'], no: ['124', '"123"'] },
  'non-string enum': {
    yes: ['"red"', '"amber"', '"green"', 'null', '42', '["foo"]'],
    no: ['"blue"'],
  },
  'string array': { yes: ['[]', '["a"]', '["a", "b"]', '[ ]'], no: ['[', '["a",]'] },
  'nullable string array': { yes: ['null', '[]', '["a", "b"]'], no: ['"a"', '[null]'] },
  'tuple1': { yes: ['["a"]'], no: ['[]'] },
  'tuple2': { yes: ['["a", 1]', '["a", -1.5e3]'], no: ['["a"]'] },
  'number': { yes: ['0', '-1.5', '1e9', '1.25e-7'], no: ['.5', '"x"'] },
  'minItems': { yes: ['[true, false]', '[true, false, true]'], no: ['[]', '[true]'] },
  'maxItems 0': { yes: ['[]', '[ ]'], no: ['[true]'] },
  'maxItems 1': { yes: ['[]', '[true]'], no: ['[true, false]'] },
  'maxItems 2': { yes: ['[]', '[true]', '[true, false]'], no: ['[true, false, true]'] },
  'min + maxItems': {
    yes: ['[1, 2, 3]', '[1.5, -2, 3, 4, 5]'],
    no: ['[1, 2]', '[1, 2, 3, 4, 5, 6]'],
  },
  'min + max items with min + max values across zero': {
    yes: ['[-12, 0, 207]', '[1, 2, 3, 4]'],
    no: ['[-13, 0, 5]', '[1, 2]'],
  },
  'min + max items with min + max values': {
    yes: ['[12, 99, 207]', '[100, 20, 13, 14]'],
    no: ['[11, 12, 13]', '[12, 13]'],
  },
  // `items: {}` lowers to `item ::= object`, so only objects are in
  // the language — read off the grammar, as ever.
  'array with empty items': {
    yes: ['[]', '[{}]', '[{"a": 1}, {}]'],
    no: ['[1]', '["a"]'],
  },
  'array with empty items and prefixItems': { yes: ['[]', '[{}]'], no: ['[true]'] },
  'simple regexp': { yes: ['"abefgkl"', '"abcddefggghijkl"'], no: ['"ab"'] },
  'regexp quote': { yes: ['"""'], no: ['""', '"a"'] },
  'regexp escapes': { yes: ['"[]{}()|+*?"'], no: ['"[]{}()|+*"'] },
  'regexp with top-level alternation': { yes: ['"A"', '"D"'], no: ['"E"', '"AB"'] },
  'regexp': {
    yes: ['"(123)456-7890 aaand..."', '"456-7890 aaaaand..."'],
    no: ['"456-7890 aand..."', '"45-7890 aaand..."'],
  },
  'required props in original order': {
    yes: ['{"b": "x", "c": "y", "a": "z"}'],
    no: ['{"a": "z"}'],
  },
  '1 optional prop': { yes: ['{}', '{"a": "x"}'], no: ['{"a": 1}', '{"b": "x"}'] },
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
  'anyOf': {
    yes: ['{"a": 1}', '{"b": 2}', '{}'],
    no: ['{"a": 1, "b": 2}', '{"c": 1}'],
  },
  'anyOf $ref': {
    yes: ['{}', '{"a": "x"}', '{"a": 1.5}', '{"b": true}', '{"a": "x", "b": "y"}'],
    no: ['{"b": 1}'],
  },
  'allOf with multiple enum schemas': { yes: ['"b"', '"c"'], no: ['"a"'] },
  'allOf with enum schema': { yes: ['"a"', '"b"'], no: ['"c"', '"ab"'] },
  'mix of allOf, anyOf and $ref (similar to https://json.schemastore.org/tsconfig.json)': {
    yes: ['{"a": 1, "b": 2}', '{"a": 1, "b": 2, "d": 3}',
      '{"a": 1, "b": 2, "d": 3, "c": 4}', '{"a": 1, "b": 2, "c": 4}'],
    no: ['{"a": 1}', '{"a": 1, "b": 2, "c": 4, "d": 3}'],
  },
  'top-level $ref': { yes: ['{"a": "x"}'], no: ['{}'] },
  'conflicting names': {
    yes: ['{"number": {"number": {"root": 1}}}'],
    no: ['{"number": {"number": {"root": "x"}}}', '{}'],
  },
  'exotic formats': {
    yes: ['["2024-01-31", "01234567-89ab-cdef-0123-456789abcdef", ' +
      '"12:34:56Z", "2024-01-31T12:34:56+01:00"]'],
    // The header's own example: a `time` without a zone suffix is out.
    no: ['["2024-01-31", "01234567-89ab-cdef-0123-456789abcdef", ' +
      '"12:34:56", "2024-01-31T12:34:56+01:00"]',
      '["2024-13-01", "01234567-89ab-cdef-0123-456789abcdef", ' +
      '"12:34:56Z", "2024-01-31T12:34:56+01:00"]'],
  },
  'literal string with escapes': {
    yes: ['{"code": " \\r \\n \\" \\\\ "}'],
    no: ['{"code": "x"}'],
  },
  'additional props': {
    yes: ['{}', '{"x": [1, 2]}'],
    no: ['{"x": 1}', '{"x": ["a"]}'],
  },
  'additional props (true)': {
    yes: ['{}', '{"any": [1, {"k": "v"}]}'],
    no: ['[]', '{"a"}'],
  },
  'additional props (implicit)': { yes: ['{}', '{"x": null}'], no: ['[]'] },
  'required + additional props': {
    yes: ['{"a": 1}', '{"a": 1, "b": "x"}'],
    no: ['{}', '{"b": "x"}'],
  },
  'optional + additional props': {
    yes: ['{}', '{"a": 1}', '{"a": 1, "b": 2}', '{"b": 2}'],
    no: ['{"b": "x"}'],
  },
  'required + optional + additional props': {
    yes: ['{"and": 1}', '{"and": 1, "also": 2}', '{"and": 1, "x": 3}'],
    no: ['{}', '{"also": 2}'],
  },
  // The converter names the empty-name property's VALUE rule 'root',
  // displacing the object rule to 'root0' — so this grammar's language,
  // read from its start symbol, is a bare integer. Sampled as such:
  // the corpus records what a sampler would be fed, quirks included.
  'optional props with empty name': { yes: ['7', '-3'], no: ['{}', '{"": 1}'] },
  'optional props with nested names': {
    yes: ['{}', '{"a": 1}', '{"a": 1, "aa": 2}', '{"aa": 2}',
      '{"a": 1, "aa": 2, "ab": 3}'],
    no: ['{"aa": 2, "a": 1}'],
  },
  'optional props with common prefix': {
    yes: ['{}', '{"ab": 1}', '{"ab": 1, "ac": 2}', '{"ac": 2}'],
    no: ['{"ac": 2, "ab": 1}'],
  },
  'empty w/o additional props': { yes: ['{}'], no: ['{"a": 1}'] },
  'description only (no type) treated as unconstrained': {
    yes: ['null', 'true', '-1.5e3', '"x"', '[1, "a"]', '{"k": null}'],
    no: ['nul', '{'],
  },
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


  // The census is pinned, the way corpus.test.js pins its grammar list.
  // Both loops above iterate CORPUS.cases, so a case quietly vanishing
  // from the JSON would emit one fewer test and leave the suite green —
  // shrinking the coverage this file's headline number claims. The
  // uniqueness half catches a duplicated name, which would otherwise
  // hold the count at 70 while losing a case.
  it('the live corpus is exactly the 70 cases on record', () => {
    assert.equal(CORPUS.cases.length, 70)
    assert.equal(new Set(CORPUS.cases.map((c) => c.name)).size, 70)
  })


  it('every sampled case exists in the corpus', () => {
    const names = new Set(CORPUS.cases.map((c) => c.name))
    for (const name of Object.keys(SAMPLES)) {
      assert.ok(names.has(name), `sampled case "${name}" is not in the corpus`)
    }
  })


  // The other direction: every corpus case is sampled, and in BOTH
  // directions. A case with no `no` samples asserts nothing about what
  // the grammar excludes — a validator that accepts everything is not
  // validating — and a compile-only case says nothing about its
  // language at all. This pin is what keeps a future corpus addition
  // from quietly shipping unsampled.
  it('every corpus case is sampled in both directions', () => {
    const holes = []
    for (const c of CORPUS.cases) {
      const s = SAMPLES[c.name]
      if (!s) holes.push(`"${c.name}" has no samples`)
      else if (0 === s.yes.length) holes.push(`"${c.name}" has no yes samples`)
      else if (0 === s.no.length) holes.push(`"${c.name}" has no no samples`)
    }
    assert.equal(holes.length, 0, '\n  ' + holes.join('\n  '))
  })

})
