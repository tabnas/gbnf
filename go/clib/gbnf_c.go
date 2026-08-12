// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// Package main builds the C-ABI shared library: libtabnasgbnf.
//
//	go build -buildmode=c-shared -o libtabnasgbnf.so ./clib
//
// It exists so that languages with no tabnas port can validate text
// against a llama.cpp GBNF grammar. Python via ctypes is the motivating
// case — checking that a constrained-decoding grammar actually accepts
// what a model produced, from the language the model is usually driven
// from — but the surface is plain C and works from anything with an FFI.
// See build.sh for cross-compiling, and py/ for the Python binding.
//
// GBNF TEXT IN, VERDICT OUT. Unlike libtabnas (the engine's own C ABI,
// which is grammar-agnostic and takes a serialized GrammarSpec), this
// library takes the notation itself. The compile step happens inside,
// natively, and that is a correctness decision rather than a
// convenience: a GBNF grammar's lexing configuration — an empty ignore
// set, every default matcher off, negotiated lexing on — IS part of the
// language it accepts, and an in-process install carries it intact.
//
// EVERY CALL RETURNS JSON. A C ABI has one return value and no
// exceptions, so rather than smuggling errors through out-params or a
// thread-local slot, each entry point returns a malloc'd JSON document.
// That makes a binding in any language a two-liner — call, json.loads —
// and keeps the error contract identical everywhere.
//
// THREE OUTCOMES, NOT TWO. A broken grammar (ok:false, code parse or
// compile), an input outside the language (ok:true, accept:false), and
// an accepted input (ok:true, accept:true) are distinct. Collapsing the
// first two would tell a caller their model output was wrong when in
// fact their grammar was.
//
// OWNERSHIP. Every char* returned here is the caller's and must be
// released with gbnf_free. Every handle from gbnf_grammar must be
// released with gbnf_grammar_free. Nothing else crosses.
//
// LENGTHS ARE EXPLICIT. Grammar and source arguments take a byte length
// and are NOT read as NUL-terminated C strings. Input to a validator is
// arbitrary bytes and may legitimately contain a zero byte; truncating
// there would answer a question the caller did not ask.
//
// This file is the marshalling shim ONLY. The behaviour lives in core.go
// so that it can be unit-tested: Go does not support cgo in _test.go
// files, so nothing beside `import "C"` is reachable from a test.
package main

/*
#include <stdlib.h>
*/
import "C"

import "unsafe"

// goBytes copies a (pointer, length) pair into Go memory. The C memory
// belongs to the caller and may be freed the moment this returns.
//
// (NULL, 0) is accepted as the empty buffer, which is how C conveys one.
// Rejecting it would make empty input unrepresentable through the
// conventional spelling — and empty input is a real question to ask: a
// grammar like `root ::= "x"*` accepts it.
func goBytes(src *C.char, n C.int) (string, bool) {
	if n < 0 {
		return "", false
	}
	if src == nil {
		return "", n == 0
	}
	return C.GoStringN(src, n), true
}

//export gbnf_version
func gbnf_version() *C.char {
	return C.CString(versionDoc())
}

// gbnf_grammar compiles GBNF source and returns a handle to it.
//
//export gbnf_grammar
func gbnf_grammar(src *C.char, srcLen C.int) *C.char {
	text, ok := goBytes(src, srcLen)
	if !ok {
		return C.CString(failDoc("usage", "grammar pointer or length is invalid"))
	}
	return C.CString(loadGrammar(text))
}

// gbnf_compile turns GBNF source into a serialized recognition spec —
// pure data that libtabnas can load and run without this library
// present. Compile once here; validate anywhere.
//
//export gbnf_compile
func gbnf_compile(src *C.char, srcLen C.int) *C.char {
	text, ok := goBytes(src, srcLen)
	if !ok {
		return C.CString(failDoc("usage", "grammar pointer or length is invalid"))
	}
	return C.CString(compileSpec(text))
}

// gbnf_parse checks one input against a compiled grammar.
//
//export gbnf_parse
func gbnf_parse(handle C.longlong, src *C.char, srcLen C.int) *C.char {
	in, ok := goBytes(src, srcLen)
	if !ok {
		return C.CString(failDoc("usage", "source pointer or length is invalid"))
	}
	return C.CString(parseWith(int64(handle), in))
}

//export gbnf_grammar_free
func gbnf_grammar_free(handle C.longlong) {
	freeGrammar(int64(handle))
}

// gbnf_free releases a string returned by any function here. C.CString
// allocates with malloc, so this is free(3); callers must not use their
// own allocator's free.
//
//export gbnf_free
func gbnf_free(s *C.char) {
	if s != nil {
		C.free(unsafe.Pointer(s))
	}
}

func main() {}
