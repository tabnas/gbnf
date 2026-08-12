// Copyright (c) 2026 tabnas, MIT License

// Package gbnf is the Go port of @tabnas/gbnf: a llama.cpp GBNF
// front-end for the tabnas parsing engine. It parses GBNF text into the
// grammar IR that github.com/tabnas/bnf/go compiles.
//
// PORT STATUS: front-end implemented. ParseGbnf reads GBNF text —
// character classes, escapes, postfix repetition, comments — and the
// same validation passes as ts/src/converter.ts run here: mandatory
// root, defined references, tokenizer-token terminals rejected by
// policy. Gbnf/ToSpec/Install emit a spec carrying GBNF's exact lexing.
// Accept/reject conformance GRADING stays in ts/, because the Go
// engine has no negotiated lexing (lex.relex; see parser/go
// doc/differences.md) and this front-end has no markClassesEager port.
//
// The TypeScript implementation is canonical. The dialect, and the
// scannerless limitations documented in ts/doc/known-gaps.md, are the
// contract this port is held to.
package gbnf

// VERSION is this module's version. It MUST equal ts/package.json
// "version": the release orchestrator rewrites both, and the version
// test fails the build if they drift.
const VERSION = "0.1.3"
