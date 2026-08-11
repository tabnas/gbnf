#!/usr/bin/env node
/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

/*  cli.ts
 *  gbnf-check — offline GBNF validation from the command line.
 *
 *  Compiles a grammar with the converter and checks sample inputs with
 *  `tn.parse`, so "would the sampler have been allowed to emit this?"
 *  needs no model in the loop. The exit code alone answers it for shell
 *  scripts and CI; `--json` emits a stable machine-readable report for
 *  tooling and AI agents.
 *
 *  Exit codes:
 *    0  the grammar compiles and every sample was accepted
 *    1  the grammar compiles but at least one sample was rejected
 *    2  the grammar does not compile
 *    3  usage or I/O error
 *
 *  Newlines are the classic footgun: `echo hi > s.txt` writes "hi\n",
 *  and a grammar with no trailing-newline rule rejects that. The
 *  default stays exact — silently stripping input would change the
 *  accepted language, the one thing this package must never do — but a
 *  rejection is re-checked without one final newline, and a hint is
 *  reported when that parse would have succeeded. `--strip-final-newline`
 *  makes the stripping explicit.
 */

import Fs from 'node:fs'
import { parseArgs } from 'node:util'

import { VERSION, gbnf as gbnfPlugin } from './gbnf'


const KNOWN_GAPS_URL =
  'https://github.com/tabnas/gbnf/blob/main/ts/doc/known-gaps.md'

const USAGE = `usage: gbnf-check [options] <grammar.gbnf | -> [sample-file ...]

Compile a GBNF grammar and check sample inputs against it — offline,
without a model. With no samples the grammar is only compiled.

The grammar is read from the named file, or from stdin when the
argument is '-'. Each sample must match the grammar in FULL: GBNF is
scannerless, so every character counts, trailing newlines included.

options:
  -t, --text <s>          check <s> itself instead of reading a file
                          (repeatable; checked after the file samples)
      --stdin             read one sample from stdin (not with a '-'
                          grammar)
      --json              write a machine-readable JSON report to stdout
      --ast               include each accepted sample's AST in the
                          report
      --strip-final-newline
                          remove one trailing newline from every sample
                          before parsing
  -q, --quiet             no report; the exit code is the answer
  -h, --help              this text
  -v, --version           print the package version

exit codes:
  0  the grammar compiles and every sample was accepted
  1  the grammar compiles but at least one sample was rejected
  2  the grammar does not compile
  3  usage or I/O error

examples:
  gbnf-check chess.gbnf                    # does the grammar compile?
  gbnf-check chess.gbnf moves.txt          # does the file match it?
  gbnf-check json.gbnf --text '{"a":1}'    # does this string match?
  gbnf-check json.gbnf --stdin < out.json  # pipe a sample in
  gbnf-check json.gbnf --text '{}' --json  # JSON report, for tooling

A rejection is this engine's answer, not always the grammar's: a
grammar that needs backtracking can reject here and still constrain a
sampler correctly. See ${KNOWN_GAPS_URL}.
The compiler also accepts a superset of llama.cpp's line-break rules,
so check a new grammar with llama-gbnf-validator before shipping it to
a sampler.
`


// The engine colors its messages for terminals; a report has to carry
// the text alone.
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '')


// One error, normalised for the report. Compile errors carry
// `rule` (GbnfCompileError) or `line`/`column` (GbnfParseError); the
// engine's own parse failures carry `code` ('unexpected', ...) and
// `lineNumber`/`columnNumber`. Only the fields the error actually has
// appear.
type ErrorInfo = {
  name: string
  message: string
  code?: string
  rule?: string
  line?: number
  column?: number
}

function errorInfo(e: any): ErrorInfo {
  const message = stripAnsi(String(e?.message ?? e)).split('\n')[0]
  const info: ErrorInfo = { name: e?.name ?? 'Error', message }
  if ('string' === typeof e?.code) info.code = e.code
  if ('string' === typeof e?.rule) info.rule = e.rule
  const line = e?.line ?? e?.lineNumber
  const column = e?.column ?? e?.columnNumber
  if ('number' === typeof line) info.line = line
  if ('number' === typeof column) info.column = column
  return info
}

function describeError(err: ErrorInfo): string {
  // GbnfParseError already embeds its location in the message
  // ('gbnf: parse error at line L, column C: ...'); only append one
  // when the message does not carry it, as the engine's errors do not.
  const loc = (err.line != null && err.column != null &&
    !err.message.includes(`line ${err.line}`))
    ? ` (line ${err.line}, column ${err.column})`
    : ''
  return err.message + loc
}


type SampleReport = {
  source: string
  ok: boolean
  // The length actually parsed, in UTF-16 units (JS `.length`) — after
  // `--strip-final-newline`, so a report says what was tested.
  length: number
  error?: ErrorInfo
  hint?: string
  ast?: unknown
}


// A usage or I/O failure. When the caller asked for `--json` the report
// contract holds even here — tooling should never have to parse prose —
// otherwise prose goes to stderr.
function usageFail(message: string, wantJson: boolean): number {
  if (wantJson) {
    process.stdout.write(JSON.stringify({
      tool: 'gbnf-check',
      version: VERSION,
      ok: false,
      exit: 3,
      error: { name: 'UsageError', message },
    }, null, 2) + '\n')
  } else {
    process.stderr.write(
      `gbnf-check: ${message}\n` +
      `run 'gbnf-check --help' for usage\n`)
  }
  return 3
}


function main(argv: string[]): number {
  // Checked before parseArgs so an unknown-option failure can still
  // honor the JSON contract the caller asked for. Only the tokens
  // before a `--` separator count: after it, `--json` is a file name.
  const optEnd = argv.indexOf('--')
  const wantJson = argv
    .slice(0, optEnd < 0 ? argv.length : optEnd)
    .includes('--json')

  let args
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        text: { type: 'string', short: 't', multiple: true },
        stdin: { type: 'boolean' },
        json: { type: 'boolean' },
        ast: { type: 'boolean' },
        'strip-final-newline': { type: 'boolean' },
        quiet: { type: 'boolean', short: 'q' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    })
  } catch (e: any) {
    return usageFail(String(e?.message ?? e), wantJson)
  }

  const flags = args.values

  if (flags.help) {
    process.stdout.write(USAGE)
    return 0
  }
  if (flags.version) {
    process.stdout.write(VERSION + '\n')
    return 0
  }
  if (flags.quiet && flags.json) {
    return usageFail('--quiet and --json are mutually exclusive', wantJson)
  }

  const grammarSource = args.positionals[0]
  if (undefined === grammarSource) {
    return usageFail('no grammar given', wantJson)
  }
  if ('-' === grammarSource && flags.stdin) {
    return usageFail(
      `the grammar is already read from stdin ('-'); --stdin cannot ` +
      `also read a sample from it`, wantJson)
  }

  let grammarText: string
  try {
    grammarText = '-' === grammarSource
      ? Fs.readFileSync(0, 'utf8')
      : Fs.readFileSync(grammarSource, 'utf8')
  } catch (e: any) {
    return usageFail(
      `cannot read grammar ${grammarSource}: ${e?.message ?? e}`, wantJson)
  }

  // All samples are collected before any parsing so an unreadable file
  // is a usage error for the whole run, not a half-finished report.
  const samples: { source: string; text: string }[] = []
  try {
    for (const file of args.positionals.slice(1)) {
      samples.push({ source: file, text: Fs.readFileSync(file, 'utf8') })
    }
  } catch (e: any) {
    return usageFail(`cannot read sample: ${e?.message ?? e}`, wantJson)
  }
  for (const [i, text] of (flags.text ?? []).entries()) {
    samples.push({ source: `text#${i}`, text })
  }
  if (flags.stdin) {
    try {
      samples.push({ source: 'stdin', text: Fs.readFileSync(0, 'utf8') })
    } catch (e: any) {
      return usageFail(
        `cannot read sample from stdin: ${e?.message ?? e}`, wantJson)
    }
  }

  if (flags['strip-final-newline']) {
    for (const s of samples) s.text = s.text.replace(/\r?\n$/, '')
  }

  const { Tabnas } = require('@tabnas/parser')
  const tn = new Tabnas({ plugins: [gbnfPlugin] })

  let grammarError: ErrorInfo | null = null
  try {
    tn.gbnf(grammarText)
  } catch (e) {
    grammarError = errorInfo(e)
  }

  const reports: SampleReport[] = []
  if (null == grammarError) {
    for (const s of samples) {
      const rep: SampleReport = {
        source: s.source,
        ok: false,
        length: s.text.length,
      }
      try {
        // An accepted EMPTY input parses to `undefined` rather than a
        // node (the engine settles '' before any rule runs), so `ast`
        // is null there — reaching this line at all means accepted.
        const ast = tn.parse(s.text)
        rep.ok = true
        if (flags.ast) rep.ast = ast ?? null
      } catch (e) {
        rep.error = errorInfo(e)
        if (!flags['strip-final-newline'] && /\r?\n$/.test(s.text)) {
          try {
            tn.parse(s.text.replace(/\r?\n$/, ''))
            rep.hint =
              'the sample ends with a newline the grammar does not ' +
              'accept, and parses without it; re-run with ' +
              '--strip-final-newline or drop the trailing newline'
          } catch (e2) {
            // The newline is not what failed the parse.
          }
        }
      }
      reports.push(rep)
    }
  }

  const rejected = reports.filter((r) => !r.ok)
  const exit = grammarError ? 2 : 0 < rejected.length ? 1 : 0

  if (flags.json) {
    const doc: Record<string, unknown> = {
      tool: 'gbnf-check',
      version: VERSION,
      ok: 0 === exit,
      exit,
      grammar: {
        source: grammarSource,
        ok: null == grammarError,
        error: grammarError,
      },
      samples: reports,
    }
    if (null == grammarError && 0 < rejected.length) {
      doc.caveats = [{
        code: 'rejection-may-be-engine-limit',
        message:
          `a rejection is this engine's answer, not always the ` +
          `grammar's: a grammar that needs backtracking can reject ` +
          `here and still constrain a sampler correctly`,
        url: KNOWN_GAPS_URL,
      }]
    }
    process.stdout.write(JSON.stringify(doc, null, 2) + '\n')
  } else if (!flags.quiet) {
    const lines: string[] = []
    lines.push(`grammar ${grammarSource}: ` +
      (grammarError ? `FAIL — ${describeError(grammarError)}` : 'ok'))
    for (const rep of reports) {
      if (rep.ok) {
        lines.push(`sample ${rep.source}: accept`)
        if (flags.ast) lines.push(JSON.stringify(rep.ast ?? null, null, 2))
      } else {
        lines.push(`sample ${rep.source}: REJECT — ` +
          describeError(rep.error as ErrorInfo))
        if (rep.hint) lines.push(`  hint: ${rep.hint}`)
      }
    }
    if (null == grammarError && 0 < rejected.length) {
      lines.push(
        'note: a rejection can be an engine limit rather than the ' +
        `grammar's answer; see ${KNOWN_GAPS_URL}`)
    }
    process.stdout.write(lines.join('\n') + '\n')
  }

  return exit
}


/* istanbul ignore next */
if (require.main === module) {
  // exitCode, not exit(): stdout must be allowed to flush.
  process.exitCode = main(process.argv.slice(2))
}

export { main }
