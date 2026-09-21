// Generates rs/tests/oracle/gbnf-oracle.json: for each GBNF source, what
// the canonical TypeScript answers -- the IR, the rendered GBNF, and the
// parts of the emitted spec this front-end owns, or the rejection.
//
// Run it from a checkout whose ts/ has been built:
//
//     (cd ts && npm install && npm run build)
//     node rs/tests/oracle/gen-oracle.js > rs/tests/oracle/gbnf-oracle.json
//
// A span is recorded as the TEXT it covers plus its row and column,
// never as a raw offset: TypeScript counts UTF-16 code units and Rust
// counts bytes, and slicing the source with the span is the only
// comparison worth making anyway -- an offset pair that is
// self-consistent but points at the wrong characters would satisfy any
// assertion about the numbers themselves. go/spans_test.go says the
// same.
'use strict'
const Fs = require('node:fs')
const Path = require('node:path')

const REPO = Path.join(__dirname, '..', '..', '..')
const gbnf = require(Path.join(REPO, 'ts', 'dist', 'gbnf.js'))

// Every construct the notation has, and every refusal. The corpus
// grammars and the live corpus follow, so the oracle covers both the
// hand-written edge cases and real GBNF.
const HAND = [
  // --- productions and layout ---
  'root ::= "a"',
  'root ::= "a"\n',
  '\nroot ::= "a"\n\n',
  'root ::= "a" # trailing comment',
  '# leading comment\nroot ::= "a"',
  'root ::= "a"\n# between\nother ::= "b"\nroot ::= other',
  'root ::= a\na ::= "x"',
  'root ::= a b\na ::= "x"\nb ::= "y"',
  'root ::= "a" | "b" | "c"',
  'root ::= | "a"',
  'root ::= "a" |',
  'ws ::= | " " | "\\n"\nroot ::= ws',
  'root ::= "a"\nroot ::= "b"',
  'root ::= a\na ::= "1"\na ::= "2"',
  'root-rule ::= "x"\nroot ::= root-rule',
  '0start ::= "x"\nroot ::= 0start',
  '_under ::= "x"\nroot ::= _under',
  'root::="a"',
  'root   ::=    "a"    ',
  'root ::=\n  "a"\n  | "b"',

  // --- string literals and escapes ---
  'root ::= "hello world"',
  'root ::= ""',
  'root ::= "" "a"',
  'root ::= "\\t\\r\\n"',
  'root ::= "\\\\"',
  'root ::= "\\""',
  'root ::= "\\[\\]"',
  'root ::= "\\x41"',
  'root ::= "\\u0041"',
  'root ::= "\\U0001F600"',
  'root ::= "\\u00e9"',
  'root ::= "caf\u00e9"',
  'root ::= "\u00e9t\u00e9" tail\ntail ::= "!"',
  // An ASTRAL character before a later element, so the row and column
  // of that element are recorded for a line TypeScript counts in two
  // UTF-16 code units and this port counts in one character.
  'root ::= "\ud83d\ude00" tail\ntail ::= "!"',
  'root ::= [\ud83d\ude00] tail\ntail ::= "!"',
  'root ::= "\ud83d\ude00"',
  'root ::= "#not a comment"',
  'root ::= "a#b"',
  'root ::= "["',
  'root ::= "]"',
  'root ::= "|"',
  'root ::= "("',
  'root ::= "::="',

  // --- character classes ---
  'root ::= [a-z]',
  'root ::= [a-zA-Z0-9]',
  'root ::= [^\\n]',
  'root ::= [^]',
  'root ::= [-+*/]',
  'root ::= [+*/-]',
  'root ::= [\\]]',
  'root ::= [\\[]',
  'root ::= [\\\\]',
  'root ::= [\\t\\r\\n]',
  'root ::= [\\x00-\\x1F]',
  'root ::= [\\u0041-\\u005A]',
  'root ::= [\\U00010000-\\U0010FFFF]',
  'root ::= [^"\\\\\\x7F\\x00-\\x1F]',
  'root ::= [a]',
  'root ::= [aa]',
  'root ::= [^a-z]',
  'root ::= [\u00e9]',
  'root ::= [\ud83d\ude00]',
  'root ::= [^\ud83d\ude00]',
  'root ::= .',
  'root ::= ..',
  'root ::= .*',

  // --- tokenizer terminals: they parse, then are refused ---
  'root ::= <think>',
  'root ::= !</think>',
  'root ::= <[1000]>',
  'root ::= "a" | <tok>',
  'root ::= ( "a" | <tok> )',
  'root ::= <tok>*',

  // --- repetition ---
  'root ::= "a"*',
  'root ::= "a"+',
  'root ::= "a"?',
  'root ::= "a"{3}',
  'root ::= "a"{3,}',
  'root ::= "a"{2,5}',
  'root ::= "a"{0,}',
  'root ::= "a"{1,}',
  'root ::= "a"{0,1}',
  'root ::= "a"{1,1}',
  'root ::= "a"{0,0}',
  'root ::= "a"*?',
  'root ::= "a"+*',
  'root ::= "a"? *',
  'root ::= "a"{ 2 , 5 }',
  'root ::= "a"{2}{3}',
  'root ::= [a-z]+',
  'root ::= ( "a" | "b" )*',
  'root ::= ("a" "b")+',
  'root ::= a?\na ::= "x"',

  // --- groups ---
  'root ::= ( "a" )',
  'root ::= ( "a" | "b" )',
  'root ::= ( ( "a" ) )',
  'root ::= ( "a" ( "b" | "c" ) "d" )',
  'root ::= "x" ( "a" | "b" ) "y"',
  'root ::= ( | "a" )',
  'root ::= (((("deep"))))',

  // --- refusals ---
  '',
  '   ',
  '\n\n',
  '# only a comment\n',
  'greeting ::= "hi"',
  'root ::= nope',
  'root ::= ( nope )',
  'root ::= nope*',
  'root ::= "a" nope "b"',
  'root ::= "\\q"',
  'root ::= "\\u00"',
  'root ::= "\\x4"',
  'root ::= "\\U0011FFFF"',
  'root ::= [z-a]',
  'root ::= []',
  'root ::= [\\q]',
  'root ::= "a"{5,2}',
  'root ::= "a"\n& nope',
  'root ::= "a" )',
  'root ::= ( "a"',
  'root ::= "unterminated',
  'root ::= [unterminated',
  '::= "a"',
  'root "a"',
  'root ::=',
  'root ::= *',
  'root ::= {2}',
  'root ::= | ',

  // --- surrogate escapes: the recorded divergence ---
  'root ::= "\\uD800"',
  'root ::= "\\uDFFF"',
  'root ::= [\\uD800]',
  'root ::= [\\uD800-\\uDBFF]',
  'root ::= "\\uD83D\\uDE00"',

  // --- whole small grammars ---
  'root ::= obj\nobj ::= "{" ws ( pair ( "," ws pair )* )? "}" ws\npair ::= str ":" ws val\nstr ::= "\\"" [^"]* "\\""\nval ::= str | num | obj\nnum ::= "-"? [0-9]+\nws ::= [ \\t\\n]*',
  'root ::= expr\nexpr ::= term ( ("+" | "-") term )*\nterm ::= factor ( ("*" | "/") factor )*\nfactor ::= [0-9]+ | "(" expr ")"',
]

function corpusSources() {
  const dir = Path.join(REPO, 'test', 'corpus')
  return Fs.readdirSync(dir)
    .filter((name) => name.endsWith('.gbnf'))
    .sort()
    .map((name) => ({
      name: 'corpus/' + name,
      src: Fs.readFileSync(Path.join(dir, name), 'utf8'),
    }))
}

function liveSources() {
  const doc = JSON.parse(Fs.readFileSync(
    Path.join(REPO, 'test', 'live', 'json-schema-corpus.json'), 'utf8'))
  return doc.cases.map((c) => ({ name: 'live/' + c.name, src: c.grammar }))
}

function normalize(value, src) {
  if (Array.isArray(value)) return value.map((v) => normalize(v, src))
  if (null === value || 'object' !== typeof value) {
    return value === Infinity ? 'Infinity' : value
  }
  const out = {}
  for (const key of Object.keys(value).sort()) {
    const v = value[key]
    if ('sp' === key && v && 'number' === typeof v.s) {
      out[key] = { c: v.c, r: v.r, t: src.slice(v.s, v.e) }
    } else out[key] = normalize(v, src)
  }
  return out
}

// The engine colours its diagnostics for a terminal; the oracle carries
// the text alone, exactly as the command's report does.
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '')

function errorInfo(e) {
  const info = {
    name: e?.name ?? 'Error',
    message: stripAnsi(String(e?.message ?? e)).split('\n')[0],
  }
  if ('string' === typeof e?.rule) info.rule = e.rule
  if ('number' === typeof e?.line) info.line = e.line
  if ('number' === typeof e?.column) info.column = e.column
  return info
}

const sources = HAND
  .map((src, i) => ({ name: 'hand/' + i, src }))
  .concat(corpusSources())
  .concat(liveSources())

const entries = []
for (const { name, src } of sources) {
  const entry = { name, src }
  let ir = null
  try {
    ir = gbnf.parseGbnf(src)
    entry.ir = normalize(ir, src)
  } catch (e) {
    entry.parseError = errorInfo(e)
    entries.push(entry)
    continue
  }

  try {
    entry.render = gbnf.renderGbnf(ir)
  } catch (e) {
    entry.renderError = errorInfo(e)
  }

  try {
    const spec = gbnf.toSpec(src)
    const tokens = (spec.options && spec.options.match &&
      spec.options.match.token) || {}
    entry.matchTokens = Object.keys(tokens).map((key) => ({
      name: key,
      source: tokens[key].source,
      flags: tokens[key].flags,
      eager: true === tokens[key].eager$,
    }))
    entry.lexEmpty = true === (spec.options.lex || {}).empty
    entry.ruleNames = Object.keys(spec.rule)
  } catch (e) {
    entry.compileError = errorInfo(e)
  }
  entries.push(entry)
}

// A JSON document cannot carry an unpaired surrogate: `JSON.stringify`
// writes one as the six characters `\uD800`, which a strict reader
// (serde_json, and the specification) refuses. The canonical answer for
// those sources is therefore not recordable here -- and it is also the
// one thing this port does differently, so each is marked and its answer
// dropped. rs/tests/divergence_test.rs pins them in both directions
// instead, and DIVERGENCE.md 1 says why.
//
// The test walks the VALUES rather than the serialized text: a paired
// surrogate is one character and must not be caught, and a source whose
// own text reads `\uD83D` writes a backslash the serialized form would
// make indistinguishable from an escape.
function hasLoneSurrogate(value) {
  if ('string' === typeof value) {
    for (let i = 0; i < value.length; i++) {
      const unit = value.charCodeAt(i)
      if (0xD800 <= unit && unit <= 0xDBFF) {
        const next = value.charCodeAt(i + 1)
        if (!(0xDC00 <= next && next <= 0xDFFF)) return true
        i++
      } else if (0xDC00 <= unit && unit <= 0xDFFF) return true
    }
    return false
  }
  if (Array.isArray(value)) return value.some(hasLoneSurrogate)
  if (null !== value && 'object' === typeof value) {
    return Object.values(value).some(hasLoneSurrogate)
  }
  return false
}

for (const entry of entries) {
  const answer = [entry.ir, entry.render, entry.matchTokens]
  if (!answer.some(hasLoneSurrogate)) continue
  entry.unrepresentable =
    'the canonical answer holds an unpaired surrogate, which JSON cannot carry'
  delete entry.ir
  delete entry.render
  delete entry.matchTokens
  delete entry.lexEmpty
  delete entry.ruleNames
}

process.stdout.write(JSON.stringify(entries) + '\n')
