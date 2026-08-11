/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */
'use strict'

/*  cli.test.js
 *  The gbnf-check command line, exercised as a child process — argument
 *  handling, all four exit codes, the human and JSON reports, stdin in
 *  both roles, and the trailing-newline hint. Spawning the real binary
 *  is the point: the exit code IS the API for shell scripts and CI, and
 *  an in-process call would not test it.
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert')
const { execFile } = require('node:child_process')
const Fs = require('node:fs')
const Os = require('node:os')
const Path = require('node:path')

const { VERSION } = require('..')

const CLI = Path.join(__dirname, '..', 'dist', 'cli.js')
const CORPUS = Path.join(__dirname, '..', '..', 'test', 'corpus')


// Run the CLI; resolve with { code, stdout, stderr } rather than
// rejecting, so a test can assert a non-zero exit like any other value.
function run(args, stdin) {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [CLI, ...args],
      // The timeout bounds a hung child (SIGTERM after 30s) so a
      // regression cannot stall the whole runner indefinitely.
      { timeout: 30000 },
      (err, stdout, stderr) => {
        resolve({ code: err ? err.code : 0, stdout, stderr })
      },
    )
    if (null != stdin) child.stdin.write(stdin)
    child.stdin.end()
  })
}


describe('cli', () => {
  let dir

  // Fixtures on disk, because the CLI's whole job is reading files.
  before(() => {
    dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'gbnf-check-'))
    Fs.writeFileSync(Path.join(dir, 'hi.gbnf'), 'root ::= "hi" | "hello"')
    Fs.writeFileSync(Path.join(dir, 'noroot.gbnf'), 'greeting ::= "hi"')
    Fs.writeFileSync(Path.join(dir, 'undef.gbnf'), 'root ::= nope')
    Fs.writeFileSync(Path.join(dir, 'badesc.gbnf'), 'root ::= "a" |\nfoo "\\q"')
    Fs.writeFileSync(Path.join(dir, 'synerr.gbnf'), 'root ::= "a"\n& nope')
    Fs.writeFileSync(Path.join(dir, 'star.gbnf'), 'root ::= "x"*')
    Fs.writeFileSync(Path.join(dir, 'ok.txt'), 'hi')
    Fs.writeFileSync(Path.join(dir, 'bad.txt'), 'HI')
    // What `echo hi > sample.txt` really writes — the newline footgun.
    Fs.writeFileSync(Path.join(dir, 'nl.txt'), 'hi\n')
  })

  after(() => {
    Fs.rmSync(dir, { recursive: true, force: true })
  })

  const at = (f) => Path.join(dir, f)


  describe('exit codes', () => {

    it('0: grammar compiles, no samples', async () => {
      const r = await run([at('hi.gbnf')])
      assert.equal(r.code, 0)
      assert.match(r.stdout, /grammar .*hi\.gbnf: ok/)
    })

    it('0: grammar compiles, every sample accepted', async () => {
      const r = await run([at('hi.gbnf'), at('ok.txt'), '--text', 'hello'])
      assert.equal(r.code, 0)
      assert.match(r.stdout, /sample .*ok\.txt: accept/)
      assert.match(r.stdout, /sample text#0: accept/)
    })

    it('1: a sample is rejected', async () => {
      const r = await run([at('hi.gbnf'), at('ok.txt'), at('bad.txt')])
      assert.equal(r.code, 1)
      assert.match(r.stdout, /sample .*ok\.txt: accept/)
      assert.match(r.stdout, /sample .*bad\.txt: REJECT/)
      assert.match(r.stdout, /note: a rejection can be an engine limit/)
    })

    it('2: the grammar does not compile', async () => {
      const r = await run([at('noroot.gbnf')])
      assert.equal(r.code, 2)
      assert.match(r.stdout, /grammar .*noroot\.gbnf: FAIL/)
      assert.match(r.stdout, /no 'root' rule/)
    })

    it('3: usage errors, each with its own diagnosis', async () => {
      for (const [args, why] of [
        [[], /no grammar given/],
        [[at('hi.gbnf'), '--bogus'], /--bogus/],
        [[at('missing.gbnf')], /cannot read grammar/],
        [[at('hi.gbnf'), at('missing.txt')], /cannot read sample/],
        [['-', '--stdin'], /already read from stdin/],
      ]) {
        const r = await run(args)
        assert.equal(r.code, 3, JSON.stringify(args))
        assert.match(r.stderr, /gbnf-check: /)
        assert.match(r.stderr, why)
      }

      // Contradictory report modes — and because --json was asked for,
      // the complaint itself arrives as JSON (see 'json report' below).
      const r = await run([at('hi.gbnf'), '--quiet', '--json'])
      assert.equal(r.code, 3)
      assert.match(JSON.parse(r.stdout).error.message, /mutually exclusive/)
    })
  })


  describe('error classes', () => {

    it('GbnfCompileError carries the rule', async () => {
      const r = await run([at('undef.gbnf'), '--json'])
      assert.equal(r.code, 2)
      const doc = JSON.parse(r.stdout)
      assert.equal(doc.grammar.error.name, 'GbnfCompileError')
      assert.equal(doc.grammar.error.rule, 'root')
      assert.match(doc.grammar.error.message, /'nope'/)
    })

    it('GbnfParseError carries line and column when the parse has one', async () => {
      const r = await run([at('synerr.gbnf'), '--json'])
      assert.equal(r.code, 2)
      const doc = JSON.parse(r.stdout)
      assert.equal(doc.grammar.error.name, 'GbnfParseError')
      assert.equal(doc.grammar.error.line, 2)
      assert.equal(doc.grammar.error.column, 1)
    })

    it('a terminal-decoder GbnfParseError has no location, by contract', async () => {
      const r = await run([at('badesc.gbnf'), '--json'])
      assert.equal(r.code, 2)
      const doc = JSON.parse(r.stdout)
      assert.equal(doc.grammar.error.name, 'GbnfParseError')
      assert.match(doc.grammar.error.message, /unknown escape/)
      assert.equal('line' in doc.grammar.error, false)
    })

    it('a rejected sample reports the engine failure, ANSI-free, one line', async () => {
      const r = await run([at('hi.gbnf'), '--text', 'HI', '--json'])
      assert.equal(r.code, 1)
      const doc = JSON.parse(r.stdout)
      const err = doc.samples[0].error
      assert.equal(err.code, 'unexpected')
      assert.equal(err.line, 1)
      assert.equal(err.column, 1)
      assert.doesNotMatch(err.message, /\x1b/)
      // The raw engine message is multi-line and colored; the report
      // carries its first line only.
      assert.doesNotMatch(err.message, /\n/)
    })
  })


  describe('json report', () => {

    it('has the documented shape', async () => {
      const r = await run(
        [at('hi.gbnf'), '--text', 'hi', '--text', 'HI', '--json'])
      assert.equal(r.code, 1)
      const doc = JSON.parse(r.stdout)
      assert.equal(doc.tool, 'gbnf-check')
      assert.equal(doc.version, VERSION)
      assert.equal(doc.ok, false)
      assert.equal(doc.exit, 1)
      assert.equal(doc.grammar.source, at('hi.gbnf'))
      assert.equal(doc.grammar.ok, true)
      assert.equal(doc.grammar.error, null)
      assert.deepEqual(
        doc.samples.map((s) => [s.source, s.ok]),
        [['text#0', true], ['text#1', false]])
      assert.equal(doc.caveats[0].code, 'rejection-may-be-engine-limit')
    })

    it('all-accepted has no caveats', async () => {
      const r = await run([at('hi.gbnf'), '--text', 'hi', '--json'])
      assert.equal(r.code, 0)
      const doc = JSON.parse(r.stdout)
      assert.equal(doc.ok, true)
      assert.equal(doc.caveats, undefined)
    })

    it('a failed grammar reports empty samples, untested', async () => {
      const r = await run([at('noroot.gbnf'), at('ok.txt'), '--json'])
      assert.equal(r.code, 2)
      const doc = JSON.parse(r.stdout)
      assert.equal(doc.grammar.ok, false)
      assert.deepEqual(doc.samples, [])
    })

    it('samples report in source order: files, --text, stdin', async () => {
      const r = await run(
        [at('hi.gbnf'), at('ok.txt'), '-t', 'hello', '--stdin', '--json'],
        'hi')
      assert.equal(r.code, 0)
      const doc = JSON.parse(r.stdout)
      assert.deepEqual(
        doc.samples.map((s) => s.source),
        [at('ok.txt'), 'text#0', 'stdin'])
    })

    it('a usage error still answers in JSON when --json was asked for', async () => {
      for (const args of [['--json'], [at('hi.gbnf'), '--bogus', '--json']]) {
        const r = await run(args)
        assert.equal(r.code, 3, JSON.stringify(args))
        const doc = JSON.parse(r.stdout)
        assert.equal(doc.exit, 3)
        assert.equal(doc.error.name, 'UsageError')
      }
    })

    it('--ast includes the tree, and null for an accepted empty input', async () => {
      const a = await run([at('hi.gbnf'), '--text', 'hi', '--ast', '--json'])
      const tree = JSON.parse(a.stdout).samples[0].ast
      assert.equal(tree.rule, 'root')
      assert.equal(tree.src, 'hi')
      assert.deepEqual(tree.kids, [])

      // The engine settles '' before any rule runs, so an accepted
      // empty input has no node — the report says null, not undefined.
      const b = await run([at('star.gbnf'), '--text', '', '--ast', '--json'])
      assert.equal(b.code, 0)
      assert.equal(JSON.parse(b.stdout).samples[0].ast, null)
    })
  })


  describe('stdin', () => {

    it("reads the grammar when the argument is '-'", async () => {
      const r = await run(['-', '--text', 'hi'], 'root ::= "hi"')
      assert.equal(r.code, 0)
    })

    it('reads a sample with --stdin', async () => {
      const r = await run([at('hi.gbnf'), '--stdin'], 'hi')
      assert.equal(r.code, 0)
      assert.match(r.stdout, /sample stdin: accept/)
    })
  })


  describe('trailing newline', () => {

    it('rejects exactly, but hints when the newline is the cause', async () => {
      const r = await run([at('hi.gbnf'), at('nl.txt'), '--json'])
      assert.equal(r.code, 1)
      const doc = JSON.parse(r.stdout)
      assert.equal(doc.samples[0].ok, false)
      assert.match(doc.samples[0].hint, /--strip-final-newline/)
    })

    it('does not hint when the newline is not the cause', async () => {
      const r = await run([at('hi.gbnf'), '--text', 'HI\n', '--json'])
      const doc = JSON.parse(r.stdout)
      assert.equal(doc.samples[0].hint, undefined)
    })

    it('--strip-final-newline removes one, and reports the tested length', async () => {
      const r = await run(
        [at('hi.gbnf'), at('nl.txt'), '--strip-final-newline', '--json'])
      assert.equal(r.code, 0)
      const doc = JSON.parse(r.stdout)
      assert.equal(doc.samples[0].ok, true)
      assert.equal(doc.samples[0].length, 2)
    })

    it('--strip-final-newline handles CRLF, and removes exactly ONE', async () => {
      const crlf = await run(
        [at('hi.gbnf'), '--text', 'hi\r\n', '--strip-final-newline',
          '--json'])
      assert.equal(crlf.code, 0)
      assert.equal(JSON.parse(crlf.stdout).samples[0].length, 2)

      // Two newlines: one comes off, the survivor still rejects — and
      // with stripping explicit there is no hint to second-guess it.
      const two = await run(
        [at('hi.gbnf'), '--text', 'hi\n\n', '--strip-final-newline',
          '--json'])
      assert.equal(two.code, 1)
      const doc = JSON.parse(two.stdout)
      assert.equal(doc.samples[0].length, 3)
      assert.equal(doc.samples[0].hint, undefined)
    })

    it('the human report carries the hint too', async () => {
      const r = await run([at('hi.gbnf'), at('nl.txt')])
      assert.equal(r.code, 1)
      assert.match(r.stdout, /hint: .*--strip-final-newline/)
    })
  })


  describe('surface', () => {

    it('--version prints the package version (and -v is its alias)', async () => {
      for (const flag of ['--version', '-v']) {
        const r = await run([flag])
        assert.equal(r.code, 0)
        assert.equal(r.stdout.trim(), VERSION)
      }
    })

    it('--help documents the exit codes (and -h is its alias)', async () => {
      for (const flag of ['--help', '-h']) {
        const r = await run([flag])
        assert.equal(r.code, 0)
        assert.match(r.stdout, /exit codes:/)
        assert.match(r.stdout, /llama-gbnf-validator/)
      }
    })

    it('--quiet answers with the exit code alone (and -q is its alias)', async () => {
      for (const flag of ['--quiet', '-q']) {
        const r = await run([at('hi.gbnf'), '--text', 'HI', flag])
        assert.equal(r.code, 1)
        assert.equal(r.stdout, '')
        assert.equal(r.stderr, '')
      }
    })

    it('--ast prints the tree in the human report too', async () => {
      const r = await run([at('hi.gbnf'), '--text', 'hi', '--ast'])
      assert.equal(r.code, 0)
      assert.match(r.stdout, /"rule": "root"/)
      assert.match(r.stdout, /"src": "hi"/)
    })

    it('validates a real llama.cpp corpus grammar', async () => {
      const r = await run([
        Path.join(CORPUS, 'json.gbnf'),
        '--text', '{"answer": [1, 2, 3]}',
        '--text', '{"answer": [1, 2, 3],}',
        '--json',
      ])
      assert.equal(r.code, 1)
      const doc = JSON.parse(r.stdout)
      assert.deepEqual(doc.samples.map((s) => s.ok), [true, false])
    })
  })
})
