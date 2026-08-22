// Copyright (c) 2026 tabnas, MIT License

// Package gbnf is the Go port of @tabnas/gbnf: a llama.cpp GBNF
// front-end for the tabnas parsing engine. It parses GBNF text into the
// grammar IR that github.com/tabnas/bnf/go compiles.
//
// PORT STATUS: front-end implemented. ParseGbnf reads GBNF text —
// character classes, escapes, postfix repetition, comments — and the
// same validation passes as ts/src/converter.ts run here: mandatory
// root, defined references, tokenizer-token terminals rejected by
// policy. Gbnf/ToSpec/Install emit a spec carrying GBNF's exact lexing,
// negotiated lexing included (Lex.Relex, parser/go v0.8.5) — with which,
// and with the contested-alternative guards from bnf/go v0.1.4, all
// eight llama.cpp corpus grammars grade accept/reject here exactly as
// they do in ts/. This front-end still has no markClassesEager port;
// it is inert where it does not apply.
//
// The TypeScript implementation is canonical. The dialect, and the
// scannerless limitations documented in ts/doc/known-gaps.md, are the
// contract this port is held to.
package gbnf

// VERSION is this module's version. It MUST equal ts/package.json
// "version": the release orchestrator rewrites both, and the version
// test fails the build if they drift.
const VERSION = "0.1.8"
