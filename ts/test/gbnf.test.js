/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */
'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')

const { Tabnas } = require('@tabnas/parser')
const {
  gbnf: gbnfPlugin,
  gbnfConvert,
  toSpec,
  parseGbnf,
  GbnfParseError,
  GbnfCompileError,
} = require('..')

// No grammar plugin: GBNF supplies its own grammar via tn.gbnf(...).
const tn = new Tabnas({ plugins: [gbnfPlugin] })

// A fresh instance per grammar. `tn.gbnf()` installs lexer settings
// (empty ignore set, default matchers off) as well as rules, and those
// are instance-wide.
function compile(src, opts) {
  const tn2 = tn.make()
  tn2.gbnf(src, opts)
  return tn2
}

// Assert a grammar accepts every string in `yes` and rejects every
// string in `no`. Reporting both directions in one message keeps a
// failure readable: "accepted what it should reject" is as much a bug
// as the reverse, and a bare `assert.throws` says neither.
function accepts(src, yes, no, opts) {
  const j = compile(src, opts)
  const wrong = []
  for (const s of yes) {
    try {
      j.parse(s)
    } catch (e) {
      wrong.push(`should ACCEPT ${JSON.stringify(s)}: ` +
        String(e.message).split('\n')[0].replace(/\x1b\[[0-9;]*m/g, ''))
    }
  }
  for (const s of no) {
    let parsed = false
    try {
      j.parse(s)
      parsed = true
    } catch (e) { /* expected */ }
    if (parsed) wrong.push(`should REJECT ${JSON.stringify(s)}`)
  }
  assert.equal(wrong.length, 0, `${src}\n  ` + wrong.join('\n  '))
}

// Strip emitter-injected action references so a test can assert the
// structural shape of a spec without pinning action identities.
function stripActions(alt) {
  if (Array.isArray(alt)) return alt.map(stripActions)
  if (alt && typeof alt === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(alt)) {
      if (k === 'a') continue
      out[k] = stripActions(v)
    }
    return out
  }
  return alt
}


describe('gbnf', () => {

  describe('parser (GBNF text -> IR)', () => {

    it('parses a rule into a production', () => {
      assert.deepEqual(parseGbnf('root ::= "a"').productions, [
        {
          name: 'root',
          alts: [[{ kind: 'term', literal: 'a', caseSensitive: true }]],
        },
      ])
    })


    it('marks string literals case-sensitive', () => {
      // GBNF's default is the OPPOSITE of RFC 5234's. Losing the flag
      // would silently accept "TRUE" for "true", so it is asserted on
      // the IR as well as through the parse below.
      const [prod] = parseGbnf('root ::= "true"').productions
      assert.equal(prod.alts[0][0].caseSensitive, true)
    })


    it('parses alternation and sequence', () => {
      assert.deepEqual(parseGbnf('root ::= "a" "b" | "c"').productions[0].alts, [
        [
          { kind: 'term', literal: 'a', caseSensitive: true },
          { kind: 'term', literal: 'b', caseSensitive: true },
        ],
        [{ kind: 'term', literal: 'c', caseSensitive: true }],
      ])
    })


    it('parses a group as a nested alternation', () => {
      assert.deepEqual(parseGbnf('root ::= ("a" | "b") "c"').productions[0].alts, [
        [
          {
            kind: 'group',
            alts: [
              [{ kind: 'term', literal: 'a', caseSensitive: true }],
              [{ kind: 'term', literal: 'b', caseSensitive: true }],
            ],
          },
          { kind: 'term', literal: 'c', caseSensitive: true },
        ],
      ])
    })


    it('parses an empty alternative', () => {
      // llama.cpp's own json.gbnf writes optional whitespace this way.
      assert.deepEqual(parseGbnf('root ::= ws\nws ::= | " "').productions[1], {
        name: 'ws',
        alts: [[], [{ kind: 'term', literal: ' ', caseSensitive: true }]],
      })
    })


    it('parses a rule reference', () => {
      assert.deepEqual(parseGbnf('root ::= item\nitem ::= "x"').productions[0], {
        name: 'root',
        alts: [[{ kind: 'ref', name: 'item' }]],
      })
    })


    it('accepts dashed, underscored and digit-leading rule names', () => {
      // llama.cpp's is_word_char is [A-Za-z0-9_-], so all three are
      // legal names — japanese.gbnf uses `jp-char`.
      const g = parseGbnf('root ::= jp-char\njp-char ::= a_1\na_1 ::= 2nd\n2nd ::= "x"')
      assert.deepEqual(g.productions.map((p) => p.name),
        ['root', 'jp-char', 'a_1', '2nd'])
    })


    it('drops an empty string literal', () => {
      // `""` denotes zero characters, so it contributes no element —
      // the alternative it sits in is the empty sequence.
      assert.deepEqual(parseGbnf('root ::= ""').productions[0].alts, [[]])
    })


    it('keeps the last of two definitions of one rule', () => {
      // GBNF has no `=/`; llama.cpp stores rules in a map, so a second
      // definition replaces the first rather than extending it.
      const g = parseGbnf('root ::= a\na ::= "x"\na ::= "y"')
      assert.equal(g.productions.length, 2)
      assert.deepEqual(g.productions[1].alts,
        [[{ kind: 'term', literal: 'y', caseSensitive: true }]])
    })

  })


  describe('comments', () => {

    it('drops a comment to end of line', () => {
      assert.deepEqual(parseGbnf('# leading\nroot ::= "a" # trailing\n').productions, [
        {
          name: 'root',
          alts: [[{ kind: 'term', literal: 'a', caseSensitive: true }]],
        },
      ])
    })


    it('does not treat # inside a literal or class as a comment', () => {
      const g = parseGbnf('root ::= "#" [+#]')
      assert.deepEqual(g.productions[0].alts[0][0],
        { kind: 'term', literal: '#', caseSensitive: true })
      assert.equal(g.productions[0].alts[0][1].pattern, '[\\u002b\\u0023]')
    })

  })


  describe('character classes', () => {

    it('lowers a range to an anchored regex terminal', () => {
      assert.deepEqual(parseGbnf('root ::= [a-z]').productions[0].alts[0][0],
        { kind: 'regex', pattern: '[\\u0061-\\u007a]', flags: '' })
    })


    it('lowers an enumeration', () => {
      assert.deepEqual(parseGbnf('root ::= [NBKQR]').productions[0].alts[0][0],
        {
          kind: 'regex',
          pattern: '[\\u004e\\u0042\\u004b\\u0051\\u0052]',
          flags: '',
        })
    })


    it('lowers negation', () => {
      // `u` even though no astral code point is written: the class
      // matches the *complement* of its members, and that complement
      // contains every astral code point.
      assert.deepEqual(parseGbnf('root ::= [^\\n]').productions[0].alts[0][0],
        { kind: 'regex', pattern: '[^\\u000a]', flags: 'u' })
    })


    it('matches an astral code point as one character, not two units', () => {
      // GBNF terminals are Unicode code points by definition, so any
      // matcher that can reach beyond the BMP has to run in `u` mode.
      // japanese.gbnf is BMP-only, which is why this went unnoticed.
      const cases = [
        ['.', parseGbnf('root ::= .').productions[0].alts[0][0]],
        ['[^\\n]', parseGbnf('root ::= [^\\n]').productions[0].alts[0][0]],
      ]
      for (const [what, el] of cases) {
        const re = new RegExp('^' + el.pattern, el.flags)
        const m = '\u{1F600}'.match(re)
        assert.ok(m, `${what} should match an astral character`)
        assert.equal(
          m[0], '\u{1F600}',
          `${what} must consume the whole character, not one surrogate`)
      }
    })


    it('treats a trailing hyphen as a literal member', () => {
      // arithmetic.gbnf's `[-+*/]` is four members, not a range.
      assert.equal(parseGbnf('root ::= [-+*/]').productions[0].alts[0][0].pattern,
        '[\\u002d\\u002b\\u002a\\u002f]')
      assert.equal(parseGbnf('root ::= [a-]').productions[0].alts[0][0].pattern,
        '[\\u0061\\u002d]')
    })


    it('lowers a non-ASCII range', () => {
      // japanese.gbnf's hiragana block.
      assert.deepEqual(parseGbnf('root ::= [\u3041-\u309F]').productions[0].alts[0][0],
        { kind: 'regex', pattern: '[\\u3041-\\u309f]', flags: '' })
    })


    it('sets the u flag for an astral range', () => {
      // Above the BMP `\uXXXX` cannot spell the endpoint, so the class
      // switches to `\u{…}`, which is only a code-point escape in
      // Unicode mode. See doc/known-gaps.md — this is the one emission
      // with no cross-runtime encoding today.
      assert.deepEqual(
        parseGbnf('root ::= [\\U0001F600-\\U0001F64F]').productions[0].alts[0][0],
        { kind: 'regex', pattern: '[\\u{1f600}-\\u{1f64f}]', flags: 'u' })
    })


    it('lowers . to any-character', () => {
      // `u` so "any single character" means one code point, matching
      // llama.cpp's LLAMA_GRETYPE_CHAR_ANY, rather than one UTF-16 unit.
      assert.deepEqual(parseGbnf('root ::= .').productions[0].alts[0][0],
        { kind: 'regex', pattern: '[\\s\\S]', flags: 'u' })
    })


    it('accepts only llama.cpp whitespace inside repetition braces', () => {
      // `parse_space` takes space, tab, CR and LF. JavaScript's `\s`
      // also admits NBSP and friends, which would compile grammars
      // llama.cpp rejects.
      assert.doesNotThrow(() => parseGbnf('root ::= "x"{ 1 }'))
      assert.doesNotThrow(() => parseGbnf('root ::= "x"{\t1,2\t}'))
      // U+00A0 NO-BREAK SPACE: in JavaScript's \s, not in parse_space.
      assert.throws(() => parseGbnf('root ::= "x"{\u00a01}'))
    })


    it('rejects an empty class', () => {
      assert.throws(() => parseGbnf('root ::= []'), (e) =>
        e instanceof GbnfParseError && /empty character class/.test(e.message))
    })


    it('rejects a descending range', () => {
      assert.throws(() => parseGbnf('root ::= [z-a]'), (e) =>
        e instanceof GbnfParseError && /descending range/.test(e.message))
    })

  })


  describe('escapes', () => {

    it('decodes the control and structural escapes', () => {
      assert.equal(
        parseGbnf('root ::= "\\n\\r\\t\\\\\\"\\[\\]"').productions[0].alts[0][0].literal,
        '\n\r\t\\"[]')
    })


    it('decodes \\xXX, \\uXXXX and \\UXXXXXXXX', () => {
      assert.equal(
        parseGbnf('root ::= "\\x41\\u0042\\U00000043"').productions[0].alts[0][0].literal,
        'ABC')
    })


    it('decodes an astral \\U escape to a surrogate pair', () => {
      const literal =
        parseGbnf('root ::= "\\U0001F600"').productions[0].alts[0][0].literal
      assert.equal(literal.codePointAt(0), 0x1F600)
      assert.equal(literal.length, 2)
    })


    it('decodes escapes inside a character class', () => {
      assert.equal(
        parseGbnf('root ::= [\\x00-\\x1F\\x7F]').productions[0].alts[0][0].pattern,
        '[\\u0000-\\u001f\\u007f]')
    })


    it('rejects an unknown escape', () => {
      // llama.cpp throws "unknown escape"; copying the character
      // through instead would quietly change the accepted language.
      assert.throws(() => parseGbnf('root ::= "\\q"'), (e) =>
        e instanceof GbnfParseError && /unknown escape '\\q'/.test(e.message))
    })


    it('rejects a short hex escape', () => {
      assert.throws(() => parseGbnf('root ::= "\\u12"'), (e) =>
        e instanceof GbnfParseError && /needs 4 hex digits/.test(e.message))
    })


    it('rejects a code point above U+10FFFF', () => {
      assert.throws(() => parseGbnf('root ::= "\\UFFFFFFFF"'), (e) =>
        e instanceof GbnfParseError && /not a Unicode code point/.test(e.message))
    })

  })


  describe('repetition', () => {

    it('lowers * to star', () => {
      assert.deepEqual(parseGbnf('root ::= "x"*').productions[0].alts[0][0],
        { kind: 'star', inner: { kind: 'term', literal: 'x', caseSensitive: true } })
    })


    it('lowers + to plus', () => {
      assert.equal(parseGbnf('root ::= "x"+').productions[0].alts[0][0].kind, 'plus')
    })


    it('lowers ? to opt', () => {
      assert.equal(parseGbnf('root ::= "x"?').productions[0].alts[0][0].kind, 'opt')
    })


    it('lowers {m} to a closed rep', () => {
      assert.deepEqual(parseGbnf('root ::= "x"{3}').productions[0].alts[0][0],
        {
          kind: 'rep',
          min: 3,
          max: 3,
          inner: { kind: 'term', literal: 'x', caseSensitive: true },
        })
    })


    it('lowers {m,n} to a bounded rep', () => {
      const el = parseGbnf('root ::= "x"{2,5}').productions[0].alts[0][0]
      assert.equal(el.kind, 'rep')
      assert.equal(el.min, 2)
      assert.equal(el.max, 5)
    })


    it('lowers {m,} to an unbounded rep, spelled Infinity', () => {
      // Infinity is the same sentinel `*` and `+` lower to: the shared
      // compiler tests `max === Infinity` to choose a star tail over
      // (max - min) nested optionals, so a large finite number here
      // would unroll into that many helper rules instead.
      const el = parseGbnf('root ::= "x"{2,}').productions[0].alts[0][0]
      assert.equal(el.kind, 'rep')
      assert.equal(el.min, 2)
      assert.equal(el.max, Infinity)
    })


    it('collapses the degenerate brace forms onto star/plus/opt', () => {
      assert.equal(parseGbnf('root ::= "x"{0,}').productions[0].alts[0][0].kind, 'star')
      assert.equal(parseGbnf('root ::= "x"{1,}').productions[0].alts[0][0].kind, 'plus')
      assert.equal(parseGbnf('root ::= "x"{0,1}').productions[0].alts[0][0].kind, 'opt')
      assert.deepEqual(parseGbnf('root ::= "x"{1}').productions[0].alts[0][0],
        { kind: 'term', literal: 'x', caseSensitive: true })
    })


    it('applies a chained postfix run left to right', () => {
      // `x*?` is `(x*)?`, the order llama.cpp's sequence loop uses.
      assert.deepEqual(parseGbnf('root ::= "x"*?').productions[0].alts[0][0], {
        kind: 'opt',
        inner: {
          kind: 'star',
          inner: { kind: 'term', literal: 'x', caseSensitive: true },
        },
      })
    })


    it('binds a postfix to a group', () => {
      const el = parseGbnf('root ::= ("a" "b")+').productions[0].alts[0][0]
      assert.equal(el.kind, 'plus')
      assert.equal(el.inner.kind, 'group')
    })


    it('rejects an inverted bound', () => {
      assert.throws(() => parseGbnf('root ::= "x"{5,2}'), (e) =>
        e instanceof GbnfParseError && /upper bound below its lower bound/.test(e.message))
    })

  })


  describe('the root requirement', () => {

    it('rejects a grammar with no root rule', () => {
      // llama.cpp: "grammar does not contain a 'root' symbol". The
      // start symbol is part of the notation, not a convention.
      assert.throws(() => parseGbnf('a ::= "x"'), (e) =>
        e instanceof GbnfCompileError &&
        e.rule === 'root' &&
        /no 'root' rule/.test(e.message))
    })


    it('starts at root wherever root is declared', () => {
      const spec = gbnfConvert('a ::= "x"\nroot ::= a')
      assert.deepEqual(stripActions(spec.rule.__start__.open),
        [{ p: 'root', g: 'gbnf' }])
    })


    it('honours an explicit start override', () => {
      const spec = gbnfConvert('root ::= a\na ::= "x"', { start: 'a' })
      assert.deepEqual(stripActions(spec.rule.__start__.open),
        [{ p: 'a', g: 'gbnf' }])
    })

  })


  describe('tokenizer-token terminals', () => {

    // Policy (see the note on `rejectTokenTerminals`): these parse, so
    // they are not syntax errors, and are then rejected by name. There
    // is no faithful text semantics for a construct that matches a
    // sampler's vocabulary entries.

    it('rejects <think> with an error naming the rule', () => {
      assert.throws(() => parseGbnf('root ::= think\nthink ::= <think> "x"'), (e) =>
        e instanceof GbnfCompileError &&
        e.rule === 'think' &&
        /tokenizer-token terminal '<think>'/.test(e.message))
    })


    it('rejects a token-id terminal', () => {
      assert.throws(() => parseGbnf('root ::= <[1000]>'), (e) =>
        e instanceof GbnfCompileError && /<\[1000\]>/.test(e.message))
    })


    it('rejects a negated token terminal', () => {
      assert.throws(() => parseGbnf('root ::= !</think> "x"'), (e) =>
        e instanceof GbnfCompileError && /!<\/think>/.test(e.message))
    })


    it('rejects one nested inside a group', () => {
      assert.throws(() => parseGbnf('root ::= ("a" | <think>)*'), (e) =>
        e instanceof GbnfCompileError && e.rule === 'root')
    })


    it('is a compile error, not a syntax error', () => {
      // The distinction is the point of the policy: the grammar text is
      // well-formed GBNF, and the diagnostic says so.
      assert.throws(() => parseGbnf('root ::= <think>'), (e) =>
        e instanceof GbnfCompileError && !(e instanceof GbnfParseError))
    })

  })


  describe('undefined references', () => {

    it('rejects a reference to a rule that is never defined', () => {
      assert.throws(() => parseGbnf('root ::= nope'), (e) =>
        e instanceof GbnfCompileError &&
        e.rule === 'root' &&
        /references 'nope', which is never defined/.test(e.message))
    })


    it('does not let a bareword fall through to a built-in lexer token', () => {
      // The shared compiler maps an undefined `TX` / `NR` / `ST` / `VL`
      // reference onto the engine's own lexer tokens. That is right for
      // ABNF and wrong for GBNF, where those are ordinary rule names —
      // so the check above must run first.
      assert.throws(() => parseGbnf('root ::= NR'), (e) =>
        e instanceof GbnfCompileError && /'NR'/.test(e.message))
    })

  })


  describe('syntax errors', () => {

    it('reports a line and column', () => {
      assert.throws(() => parseGbnf('root ::= "a"\nbroken ::= ::='), (e) =>
        e instanceof GbnfParseError && e.line === 2)
    })


    it('rejects empty source', () => {
      assert.throws(() => parseGbnf('   \n'), (e) =>
        e instanceof GbnfParseError && /no productions found/.test(e.message))
    })

  })


  describe('emission', () => {

    it('emits a case-sensitive literal as a fixed token', () => {
      // A fixed token is an exact byte match. An `i`-flagged regex here
      // would be the ABNF lowering, and would accept "TRUE".
      const spec = gbnfConvert('root ::= "true"')
      assert.deepEqual(spec.options.fixed.token, { '#TRUE': 'true' })
      assert.equal(spec.options.match, undefined)
    })


    it('emits a character class as an anchored match token', () => {
      const spec = gbnfConvert('root ::= [a-z]')
      const [name] = Object.keys(spec.options.match.token)
      const re = spec.options.match.token[name]
      assert.equal(re.source, '^[\\u0061-\\u007a]')
      assert.equal(re.flags, '')
    })


    it('tags every alt with the gbnf group', () => {
      const spec = gbnfConvert('root ::= "a"')
      assert.deepEqual(stripActions(spec.rule.root.open), [{ s: '#A', g: 'gbnf' }])
    })


    it('honours a tag override', () => {
      const spec = gbnfConvert('root ::= "a"', { tag: 'custom' })
      assert.deepEqual(stripActions(spec.rule.root.open), [{ s: '#A', g: 'custom' }])
    })


    it('does not mutate the parsed grammar, so emitting twice agrees', () => {
      const grammar = parseGbnf('root ::= "a" item\nitem ::= "b" "c"')
      const { emitGrammarSpec } = require('..')
      const first = emitGrammarSpec(grammar, { start: 'root', tag: 'gbnf' })
      const second = emitGrammarSpec(grammar, { start: 'root', tag: 'gbnf' })
      assert.deepEqual(Object.keys(second.rule), Object.keys(first.rule))
    })

  })


  describe('exact lexing', () => {

    // GBNF is scannerless: the grammar describes every character. The
    // engine's defaults are JSON-shaped and lenient, so the emitted
    // spec turns them off — otherwise `root ::= "a"` would accept
    // " a ", and a `#` in the INPUT would vanish as a comment.

    it('emits an empty ignore set', () => {
      assert.deepEqual(gbnfConvert('root ::= "a"').options.tokenSet, { IGNORE: [] })
    })


    it('does not skip whitespace the grammar did not ask for', () => {
      accepts('root ::= "a" "b"', ['ab'], ['a b', ' ab', 'ab ', 'a\nb'])
    })


    it('matches whitespace the grammar does ask for', () => {
      accepts('root ::= "a" " " "b"', ['a b'], ['ab'])
      accepts('root ::= "a" "\\n" "b"', ['a\nb'], ['ab', 'a b'])
      accepts('root ::= "a" [ \\t]+ "b"', ['a b', 'a\tb', 'a \t b'], ['ab'])
    })


    it('treats # in the input as an ordinary character', () => {
      accepts('root ::= "#" "a"', ['#a'], ['#', 'a'])
      accepts('root ::= "a"', ['a'], ['a#comment'])
    })


    it('treats a quote in the input as an ordinary character', () => {
      accepts('root ::= "\\"" "a" "\\""', ['"a"'], ['a'])
    })


    it('lexes classes eagerly when the grammar makes that unambiguous', () => {
      // Rule-directed lexing hides a class token wherever the active
      // rule does not name it, which is exactly where a repetition
      // ends. When the classes are pairwise disjoint AND no class
      // holds the first character of a literal, tokenisation cannot
      // depend on parse state, so the gate is dropped.
      const eager = (src) =>
        Object.values(gbnfConvert(src).options.match?.token ?? {})
          .every((re) => re.eager$ === true)

      // One class, no literals: trivially unambiguous.
      assert.equal(eager('root ::= sign? [0-9]+\nsign ::= "-"'), true)
      // Two disjoint classes.
      assert.equal(eager('root ::= [a-z]? [0-9]'), true)
      // Overlapping classes: the gate is what tells them apart.
      assert.equal(eager('root ::= [a-z] [a-z0-9_]*'), false)
      // A class holding the first character of a literal: an eager
      // class would swallow the literal's opening character, because
      // match matchers run before the fixed matcher.
      assert.equal(eager('root ::= digit "0"\ndigit ::= [0-9]'), false)
      // `.` is every character, so it overlaps everything.
      assert.equal(eager('root ::= . [0-9]'), false)
    })


    it('eager classes let a repetition end on a different class', () => {
      accepts('root ::= sign? [0-9]+\nsign ::= "-"', ['1', '42', '-42'], ['-', 'x'])
      accepts('root ::= [a-z]? [0-9]', ['5', 'a5'], ['ab', ''])
    })


    it('eagerClasses:false keeps the engine rule-directed', () => {
      const spec = gbnfConvert('root ::= [a-z]? [0-9]', { eagerClasses: false })
      assert.equal(
        Object.values(spec.options.match.token).some((re) => re.eager$),
        false)
    })


    it('decides the empty input from the grammar', () => {
      // The engine short-circuits `''` before any rule runs, so whether
      // it is in the language is settled at compile time. Negotiated
      // lexing (relex) is always on for GBNF: the notation is
      // scannerless, so one character can be a different token in
      // different parse contexts, and alternates must be able to re-cut.
      const lexOf = (src) => gbnfConvert(src).options.lex
      assert.deepEqual(lexOf('root ::= "x"'), { empty: false, relex: true })
      assert.deepEqual(lexOf('root ::= "x"*'), { empty: true, relex: true })
      assert.deepEqual(lexOf('root ::= "x"?'), { empty: true, relex: true })
      assert.deepEqual(lexOf('root ::= "x"{0,3}'), { empty: true, relex: true })
      assert.deepEqual(
        lexOf('root ::= ws\nws ::= | " "'), { empty: true, relex: true })
    })

  })


  describe('end-to-end parses', () => {

    it('alternation', () => {
      accepts('root ::= "a" | "b"', ['a', 'b'], ['c', 'ab'])
    })


    it('sequence and grouping', () => {
      accepts('root ::= ("a" "b") "c"', ['abc'], ['ac', 'abcc'])
      accepts('root ::= ("a" | "b") "c"', ['ac', 'bc'], ['c', 'abc'])
    })


    it('case sensitivity', () => {
      accepts('root ::= "true"', ['true'], ['TRUE', 'True', 'tRuE'])
    })


    it('character class', () => {
      accepts('root ::= [a-z]', ['a', 'q', 'z'], ['A', '1', 'ab'])
    })


    it('negated character class', () => {
      accepts('root ::= [^a-z]', ['A', '1', '-'], ['a', 'z'])
    })


    it('enumerated character class', () => {
      accepts('root ::= [NBKQR]', ['N', 'B', 'R'], ['a', 'C'])
    })


    it('any character', () => {
      accepts('root ::= .', ['a', '1', ' ', '\n'], ['ab'])
    })


    it('star', () => {
      accepts('root ::= "x"*', ['', 'x', 'xxx'], ['y', 'xy'])
    })


    it('plus', () => {
      accepts('root ::= "x"+', ['x', 'xxx'], ['', 'y'])
    })


    it('optional', () => {
      accepts('root ::= "a" "b"?', ['a', 'ab'], ['b', 'abb'])
    })


    it('exact repetition', () => {
      accepts('root ::= "x"{3}', ['xxx'], ['', 'xx', 'xxxx'])
    })


    it('open-ended repetition', () => {
      accepts('root ::= "x"{2,}', ['xx', 'xxxxx'], ['', 'x'])
    })


    it('bounded repetition', () => {
      accepts('root ::= "x"{1,3}', ['x', 'xx', 'xxx'], ['', 'xxxx'])
    })


    it('repetition of a class', () => {
      accepts('root ::= [0-9]+', ['0', '4711'], ['', 'a'])
    })


    it('rule references across productions', () => {
      accepts('root ::= a b\na ::= "x"\nb ::= "y"', ['xy'], ['x', 'y', 'yx'])
    })


    it('an empty alternative', () => {
      accepts('root ::= ws "a"\nws ::= | " "', ['a', ' a'], ['  a', 'a '])
    })


    it('escaped literals', () => {
      accepts('root ::= "\\t" "\\x41" "\\u00e9"', ['\tAé'], ['tAé', ' Aé'])
    })


    it('returns a tagged node for the start rule', () => {
      const j = compile('root ::= "a" item\nitem ::= "b" "c"')
      assert.deepEqual(j.parse('abc'), {
        rule: 'root',
        src: 'abc',
        kids: [{ rule: 'item', src: 'bc', kids: [] }],
      })
    })


    it('a comment in the grammar changes nothing about the language', () => {
      accepts('# a list of one\nroot ::= "a"  # just a\n', ['a'], ['b', ''])
    })

  })


  describe('plugin surface', () => {

    it('adds a callable tn.gbnf that installs the grammar', () => {
      const j = tn.make()
      assert.equal(typeof j.gbnf, 'function')
      const spec = j.gbnf('root ::= "a"')
      assert.equal(spec.options.rule.start, '__start__')
      assert.equal(j.parse('a').rule, 'root')
    })


    it('tn.gbnf.toSpec compiles without installing', () => {
      const j = tn.make()
      j.gbnf.toSpec('root ::= "a"')
      // Nothing was installed, so the instance still has its default
      // JSON grammar and does not know about `root`.
      assert.equal(j.rule().root, undefined)
    })


    it('exports toSpec and gbnfConvert as the same conversion', () => {
      assert.equal(toSpec, gbnfConvert)
      assert.deepEqual(
        Object.keys(toSpec('root ::= "a"').rule),
        Object.keys(gbnfConvert('root ::= "a"').rule))
    })

  })

})
