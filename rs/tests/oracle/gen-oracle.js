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
//
// Each compiled source also carries `pure`: what go/oracle_test.go holds
// the Go port to, from the tree a host reads (see "The pure-data spec"
// below). `node rs/tests/oracle/gen-oracle.js --canon NAME` prints, for
// the source NAME, the canonical text each digest is taken of, to read
// beside what the Go test prints when a digest differs.
'use strict'
const Crypto = require('node:crypto')
const Fs = require('node:fs')
const Path = require('node:path')

const REPO = Path.join(__dirname, '..', '..', '..')
const gbnf = require(Path.join(REPO, 'ts', 'dist', 'gbnf.js'))
const bnf = require(Path.join(REPO, 'ts', 'node_modules', '@tabnas', 'bnf'))

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
  'root ::= "a\\-b"',
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
  'root ::= [a\\-z]',
  'root ::= [a-z\\-]',
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
  if (entry.ruleNames) entry.pure = pureAnswer(entry)
  entries.push(entry)
}

// ---- The pure-data spec, for go/oracle_test.go -----------------------
//
// The tree a host reads is the pure-data spec,
// `compileSpec(gbnfConvert(src, { builtins: true }), { recognition: false,
// strict: true })`, and go/oracle_test.go holds the spec the Go port writes
// to it, part by part. Its rule tables come to four megabytes of text
// across the oracle, so each rule is recorded as a digest of a canonical
// text; the fixed tokens, small and the part a decoding defect changes,
// are recorded as TypeScript writes them.
//
// The canonical text is taken after the normalisations DIVERGENCE.md 7
// records, the same on both sides, so a digest differs only where the
// specs differ in a way no row excuses:
//
//   - key order, row 1: object keys are written sorted, and
//     `options.match.tokenOrder` is left out;
//   - class token names, row 2: wherever a rule names a token set, the set
//     is written as its members, sorted, and the sets as a sorted list of
//     those; the Go side first gives each class token the name of the
//     TypeScript token that matches the same characters;
//   - the order of a run of alternates, row 5: each maximal run of adjacent
//     alternates alike in everything but `s` is written sorted.
//
// A row that closes takes its normalisation with it, here and in
// go/oracle_test.go, which computes the same digests: keep the two in step.

const BACKSLASH = String.fromCharCode(92)

function quoteText(text) {
  let out = '"'
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i)
    if (0x22 === unit || 0x5c === unit) out += BACKSLASH + text[i]
    else if (unit < 0x20 || 0x7e < unit) {
      out += BACKSLASH + 'u' + unit.toString(16).padStart(4, '0')
    } else out += text[i]
  }
  return out + '"'
}

// JSON with its keys sorted, no space, every character outside printable
// ASCII written as a UTF-16 escape, and integers the only numbers.
function canonText(value) {
  if (null === value || undefined === value) return 'null'
  if (true === value || false === value) return String(value)
  if ('number' === typeof value) {
    if (!Number.isSafeInteger(value)) {
      throw new Error('canonText: the spec holds a number that is not an integer: ' + value)
    }
    return String(value)
  }
  if ('string' === typeof value) return quoteText(value)
  if (Array.isArray(value)) return '[' + value.map(canonText).join(',') + ']'
  const keys = Object.keys(value)
  for (const key of keys) {
    if (/[^ -~]/.test(key)) {
      throw new Error('canonText: a key outside printable ASCII: ' + JSON.stringify(key))
    }
  }
  return '{' + keys.sort().map((key) => quoteText(key) + ':' + canonText(value[key])).join(',') + '}'
}

function digestOf(value) {
  return Crypto.createHash('sha256').update(canonText(value)).digest('hex').slice(0, 16)
}

// The normalised parts of a pure-data spec. `rename` gives a class token
// the name the canonical TypeScript gives it; it is the identity here.
function pureParts(spec, rename) {
  const options = spec.options || {}
  const sets = options.tokenSet || {}
  const isSet = (name) => 'IGNORE' !== name && Object.prototype.hasOwnProperty.call(sets, name)
  const members = (name) => '{' + sets[name].map(rename).sort().join(',') + '}'
  const token = (t) => ('#' === t[0] && isSet(t.slice(1))) ? members(t.slice(1)) : rename(t)
  const names = (value, key) => {
    if (Array.isArray(value)) return value.map((v) => names(v))
    if (null !== value && 'object' === typeof value) {
      const out = {}
      for (const k of Object.keys(value)) out[k] = names(value[k], k)
      return out
    }
    if ('string' !== typeof value) return value
    return 's' === key ? value.split(' ').map(token).join(' ') : token(value)
  }
  const alike = (a, b) => {
    const x = Object.assign({}, a), y = Object.assign({}, b)
    delete x.s
    delete y.s
    return canonText(x) === canonText(y)
  }
  const runs = (alts) => {
    const out = []
    let run = []
    const flush = () => {
      out.push(...run.slice().sort((a, b) => {
        const x = canonText(a), y = canonText(b)
        return x < y ? -1 : x > y ? 1 : 0
      }))
      run = []
    }
    for (const alt of alts) {
      const named = Object.prototype.hasOwnProperty.call(alt, 's')
      if (0 < run.length && !(named && alike(run[0], alt))) flush()
      if (named) run.push(alt)
      else out.push(alt)
    }
    flush()
    return out
  }
  const rest = JSON.parse(JSON.stringify(options))
  delete rest.tokenSet
  if (rest.fixed) {
    delete rest.fixed.token
    if (0 === Object.keys(rest.fixed).length) delete rest.fixed
  }
  if (rest.match) {
    delete rest.match.token
    delete rest.match.tokenOrder
    if (0 === Object.keys(rest.match).length) delete rest.match
  }
  return {
    fixed: (options.fixed && options.fixed.token) || {},
    rest: { options: rest, v: spec.v },
    tokenSets: {
      ignore: (sets.IGNORE || []).map(rename).sort(),
      sets: Object.keys(sets).filter(isSet).map(members).sort(),
    },
    meta: spec.meta,
    rules: Object.keys(spec.rule).map((name) => ({
      name,
      text: canonText({
        open: runs(names(spec.rule[name].open || [])),
        close: runs(names(spec.rule[name].close || [])),
      }),
    })),
  }
}

function pureSpec(src) {
  return JSON.parse(bnf.compileSpec(gbnf.gbnfConvert(src, { builtins: true }),
    { recognition: false, strict: true }))
}

function pureAnswer(entry) {
  const spec = pureSpec(entry.src)
  // The rules and match tokens are the ones recorded above, from the spec
  // without builtins, so the digests can be read against them.
  const ruleNames = Object.keys(spec.rule)
  if (JSON.stringify(ruleNames) !== JSON.stringify(entry.ruleNames)) {
    throw new Error(entry.name + ': the pure-data spec names other rules than the spec does')
  }
  const tokens = (spec.options.match && spec.options.match.token) || {}
  const recorded = entry.matchTokens.map((t) => t.name + ' ' + t.source)
  const written = Object.keys(tokens).map((name) => name + ' ' + String(tokens[name]).replace(/^@~?[/]/, '').replace(/[/][a-z]*$/, ''))
  if (JSON.stringify(recorded) !== JSON.stringify(written)) {
    throw new Error(entry.name + ': the pure-data spec writes other match tokens than the spec holds')
  }
  const parts = pureParts(spec, (name) => name)
  return {
    fixed: parts.fixed,
    rest: digestOf(parts.rest),
    tokenSets: digestOf(parts.tokenSets),
    meta: digestOf(parts.meta),
    rules: parts.rules.map((rule) => digestOf(JSON.parse(rule.text))),
  }
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
  const answer = [entry.ir, entry.render, entry.matchTokens, entry.pure]
  if (!answer.some(hasLoneSurrogate)) continue
  entry.unrepresentable =
    'the canonical answer holds an unpaired surrogate, which JSON cannot carry'
  delete entry.ir
  delete entry.render
  delete entry.matchTokens
  delete entry.lexEmpty
  delete entry.ruleNames
  delete entry.pure
}

const canonFor = process.argv.indexOf('--canon')
if (0 < canonFor) {
  const name = process.argv[canonFor + 1]
  const entry = entries.find((e) => e.name === name && e.pure)
  if (!entry) throw new Error('no compiled source is named ' + JSON.stringify(name))
  const parts = pureParts(pureSpec(entry.src), (n) => n)
  process.stdout.write('rest ' + digestOf(parts.rest) + ' ' + canonText(parts.rest) + '\n')
  process.stdout.write('tokenSets ' + digestOf(parts.tokenSets) + ' ' + canonText(parts.tokenSets) + '\n')
  process.stdout.write('meta ' + digestOf(parts.meta) + ' ' + canonText(parts.meta) + '\n')
  for (const rule of parts.rules) {
    process.stdout.write('rule ' + rule.name + ' ' + digestOf(JSON.parse(rule.text)) + ' ' + rule.text + '\n')
  }
} else process.stdout.write(JSON.stringify(entries) + '\n')
