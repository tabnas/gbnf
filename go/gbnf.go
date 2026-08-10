// Copyright (c) 2026 tabnas, MIT License

// Package gbnf is the Go port of @tabnas/gbnf: a llama.cpp GBNF
// front-end for the tabnas parsing engine. It parses GBNF text into the
// grammar IR that github.com/tabnas/bnf/go compiles.
//
// PORT STATUS: not yet implemented. The TypeScript implementation is
// canonical and lands first by design; this package currently exposes
// only VERSION so the module builds and the release tooling has
// something to check. The front-end — the meta-grammar, character-class
// and escape decoders, exact-lexing configuration, and the rejection of
// tokenizer-token terminals — is ported in a later change, mirroring
// ts/src/converter.ts.
//
// The dialect, and the scannerless limitations documented in
// ts/doc/known-gaps.md, are the contract this port will be held to.
package gbnf

// VERSION is this module's version. It MUST equal ts/package.json
// "version": the release orchestrator rewrites both, and the version
// test fails the build if they drift.
const VERSION = "0.1.0"
