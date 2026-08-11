/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

/*  gbnf.ts
 *  GBNF plugin — adds `tn.gbnf(src)` (compile and install) and
 *  `tn.gbnf.toSpec(src)` (compile without installing) to a Tabnas
 *  instance.
 *
 *  The conversion logic itself lives in ./converter.ts; this file
 *  exposes it both as a Plugin (for `tn.use(gbnf)` / `new Tabnas({
 *  plugins: [gbnf] })`) and as bare exports, for code that wants a
 *  GrammarSpec without an instance to install it on.
 */

import type {
  Tabnas,
  GrammarSpec,
  Plugin,
} from '@tabnas/parser'

import {
  gbnf as gbnfConvert,
  parseGbnf,
  emitGrammarSpec,
  eliminateLeftRecursion,
  gbnfRules,
  GbnfParseError,
  GbnfCompileError,
  GbnfConvertOptions,
} from './converter'


// Plugin entry point. Decorates the instance with a callable `gbnf`
// member that converts and installs a grammar, plus `gbnf.toSpec` for
// callers that just want the spec.
//
// Installing is what switches the instance to GBNF's exact lexing: the
// spec carries an empty ignore set and no default matchers (see
// `applyExactLexing` in the converter), and `tn.grammar()` applies
// `spec.options` to the instance. Use a fresh instance (`tn.make()`)
// per grammar — those settings are instance-wide, and a second grammar
// installed over the first inherits them.
const gbnf: Plugin = function gbnf(tn: Tabnas, _options?: any): void {
  const fn = ((src: string, opts?: GbnfConvertOptions): GrammarSpec => {
    const spec = gbnfConvert(src, opts)
    tn.grammar(spec)
    return spec
  }) as ((src: string, opts?: GbnfConvertOptions) => GrammarSpec) & {
    toSpec: (src: string, opts?: GbnfConvertOptions) => GrammarSpec
  }
  fn.toSpec = (src: string, opts?: GbnfConvertOptions): GrammarSpec =>
    gbnfConvert(src, opts)
  tn.gbnf = fn
}


// `toSpec` as a bare export, mirroring the instance member: compile
// GBNF text to a GrammarSpec and install nothing.
const toSpec = gbnfConvert


export {
  VERSION,
  gbnf,
  gbnfConvert,
  toSpec,
  parseGbnf,
  emitGrammarSpec,
  eliminateLeftRecursion,
  gbnfRules,
  GbnfParseError,
  GbnfCompileError,
}

export type { GbnfConvertOptions }


// VERSION is this package's version. It MUST equal package.json
// "version": the release orchestrator rewrites both, and the version
// test fails the build if they drift.
const VERSION = '0.1.2'
