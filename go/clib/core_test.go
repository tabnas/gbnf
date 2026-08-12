// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

package main

// The library's contract, tested where it is testable. The cgo shim in
// gbnf_c.go cannot be unit-tested (Go forbids cgo in _test.go), which is
// exactly why the behaviour lives in core.go — everything below runs
// against the same functions the exported symbols call.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"

	tabnas "github.com/tabnas/parser/go"
)

func doc(t *testing.T, s string) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		t.Fatalf("result is not JSON: %v (%q)", err, s)
	}
	return m
}

func corpus(t *testing.T, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("..", "..", "test", "corpus", name+".gbnf"))
	if err != nil {
		t.Skipf("corpus grammar %s unavailable: %v", name, err)
	}
	return string(b)
}

func mustLoad(t *testing.T, name string) int64 {
	t.Helper()
	res := doc(t, loadGrammar(corpus(t, name)))
	if res["ok"] != true {
		t.Fatalf("%s failed to compile: %v", name, res)
	}
	h := int64(res["handle"].(float64))
	t.Cleanup(func() { freeGrammar(h) })
	return h
}

func TestVersionDoc(t *testing.T) {
	got := doc(t, versionDoc())
	if got["ok"] != true || got["version"] == "" || got["engine"] == "" {
		t.Errorf("version: %v", got)
	}
}

// The corpus, both directions, through the C surface. These are the same
// samples go/gbnf_test.go grades natively, so a disagreement here is a
// disagreement between the library and the package it wraps.
func TestCorpusBothDirections(t *testing.T) {
	// All EIGHT corpus grammars, matching go/gbnf_test.go and
	// ts/test/corpus.test.js. A census short of the full set would let a
	// C-ABI regression in an omitted grammar pass a test that claims
	// whole-corpus conformance.
	accept := map[string][]string{
		"arithmetic": {"a+b=c\n", "x=y\n"},
		"c":          {"int f(){return x;}", "int intx(){intx = 3;}"},
		"chess":      {"1. e4 e5\n2. Nxe4 e5\n"},
		"english":    {"Hello, world!", "a b c"},
		"japanese":   {"こんにちは"},
		"json":       {"{\"answer\": [1, 2, 3]}", "{\"a\": \"\\n\"}"},
		"json_arr":   {"[\n1,\n2\n]"},
		"list":       {"- a\n"},
	}
	reject := map[string][]string{
		"arithmetic": {"a=b", "a=b+c\n"},
		"c":          {"int x=1;\n", "int x = 1;\n"},
		"chess":      {"1. e4\n"},
		"english":    {"hello world\n", "Hello world.\n"},
		"japanese":   {"hello"},
		"json":       {"{\"a\":1,}"},
		"json_arr":   {"[\n1, 2\n]"},
		"list":       {"-a\n"},
	}

	// The census itself, pinned the way the TS suite pins it: a grammar
	// added to the corpus without samples here should show up as a gap.
	const corpusSize = 8
	if len(accept) != corpusSize || len(reject) != corpusSize {
		t.Fatalf("corpus census is %d accept / %d reject, want %d each",
			len(accept), len(reject), corpusSize)
	}

	for name, samples := range accept {
		h := mustLoad(t, name)
		for _, s := range samples {
			got := doc(t, parseWith(h, s))
			if got["ok"] != true || got["accept"] != true {
				t.Errorf("%s.gbnf rejected %q, which is in its language: %v",
					name, s, got)
			}
		}
	}
	// The direction that matters just as much: a validator that accepts
	// everything is not a validator.
	for name, samples := range reject {
		h := mustLoad(t, name)
		for _, s := range samples {
			got := doc(t, parseWith(h, s))
			if got["ok"] != true {
				t.Errorf("%s.gbnf: rejection must be an answer, not a call "+
					"failure, for %q: %v", name, s, got)
				continue
			}
			if got["accept"] != false {
				t.Errorf("%s.gbnf accepted %q, which is outside its language",
					name, s)
			}
		}
	}
}

// The property that makes gbnf_compile safe to offer at all: a grammar
// compiled here and reloaded into a BARE engine must accept and reject
// exactly what a native install does.
//
// "It emitted valid JSON" is not the property. Until @tabnas/bnf v0.1.5
// the serialized form silently dropped GBNF's lexing configuration, so
// the spec loaded fine and then answered differently — arithmetic.gbnf
// rejecting "a+b=c" because the reloaded grammar lexed "a+b" as one text
// token. This grades the round trip against the corpus in BOTH
// directions, so that class of regression fails here rather than in
// somebody's pipeline.
func TestCompiledSpecAgreesWithNativeInstall(t *testing.T) {
	accept := map[string][]string{
		"arithmetic": {"a+b=c\n", "x=y\n"},
		"c":          {"int f(){return x;}", "int intx(){intx = 3;}"},
		"chess":      {"1. e4 e5\n2. Nxe4 e5\n"},
		"english":    {"Hello, world!", "a b c"},
		"japanese":   {"こんにちは"},
		"json":       {"{\"answer\": [1, 2, 3]}", "{\"a\": \"\\n\"}"},
		"json_arr":   {"[\n1,\n2\n]"},
		"list":       {"- a\n"},
	}
	reject := map[string][]string{
		"arithmetic": {"a=b", "a=b+c\n"},
		"c":          {"int x=1;\n", "int x = 1;\n"},
		"chess":      {"1. e4\n"},
		"english":    {"hello world\n", "Hello world.\n"},
		"japanese":   {"hello"},
		"json":       {"{\"a\":1,}"},
		"json_arr":   {"[\n1, 2\n]"},
		"list":       {"-a\n"},
	}

	graded := 0
	for name := range accept {
		res := doc(t, compileSpec(corpus(t, name)))
		if res["ok"] != true {
			t.Errorf("%s.gbnf did not compile to a spec: %v", name, res)
			continue
		}

		// A bare engine: no GBNF front-end involved, exactly as a
		// libtabnas caller in another language would have it.
		gs, err := tabnas.GrammarSpecFromJSON([]byte(res["spec"].(string)))
		if err != nil {
			t.Errorf("%s.gbnf: emitted spec will not load: %v", name, err)
			continue
		}
		tn := tabnas.Make()
		if err := tn.Grammar(gs); err != nil {
			t.Errorf("%s.gbnf: emitted spec will not install: %v", name, err)
			continue
		}

		for _, s := range accept[name] {
			if _, err := tn.Parse(s); err != nil {
				t.Errorf("%s.gbnf compiled spec REJECTED %q, which a native "+
					"install accepts: %v", name, s, firstLine(err.Error()))
			}
			graded++
		}
		for _, s := range reject[name] {
			if _, err := tn.Parse(s); err == nil {
				t.Errorf("%s.gbnf compiled spec ACCEPTED %q, which is outside "+
					"its language", name, s)
			}
			graded++
		}
	}
	if graded != 23 {
		t.Errorf("graded %d samples, expected the full 23-sample census", graded)
	}
}

// A grammar that will not compile must not yield a spec — otherwise a
// caller could ship an empty grammar believing it compiled.
func TestCompileRefusesABrokenGrammar(t *testing.T) {
	for _, src := range []string{"root ::= [", "root ::= nosuchrule", ""} {
		res := doc(t, compileSpec(src))
		if res["ok"] != false {
			t.Errorf("%q compiled to a spec: %v", src, res)
		}
		if _, leaked := res["spec"]; leaked {
			t.Errorf("%q: a failure must not carry a spec: %v", src, res)
		}
	}
}

// Three outcomes, not two. A caller must be able to tell "your grammar
// is broken" from "your input is not in the language" without reading
// message text — otherwise a tool reports a model's output as wrong when
// the grammar was at fault.
func TestBrokenGrammarIsNotARejection(t *testing.T) {
	for _, c := range []struct{ name, src string }{
		{"unparseable", "root ::= ["},
		{"undefined reference", "root ::= nosuchrule"},
		{"no root rule", "other ::= \"a\""},
		{"empty", ""},
	} {
		res := doc(t, loadGrammar(c.src))
		if res["ok"] != false {
			h := int64(res["handle"].(float64))
			verdict := doc(t, parseWith(h, "anything at all"))
			freeGrammar(h)
			t.Errorf("%s: compiled as a valid grammar, and then answered %v",
				c.name, verdict)
			continue
		}
		if _, isVerdict := res["accept"]; isVerdict {
			t.Errorf("%s: a broken grammar must not carry an accept field: %v",
				c.name, res)
		}
	}
}

func TestRejectionMessageIsOneCleanLine(t *testing.T) {
	h := mustLoad(t, "json")
	got := doc(t, parseWith(h, "{oops"))
	e, ok := got["error"].(map[string]any)
	if !ok {
		t.Fatalf("a rejection should explain itself: %v", got)
	}
	msg, _ := e["message"].(string)
	if msg == "" {
		t.Error("rejection message is empty")
	}
	for _, bad := range []string{"\n", "\x1b"} {
		if containsStr(msg, bad) {
			t.Errorf("message carries %q, which a JSON field is not: %q", bad, msg)
		}
	}
}

func containsStr(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func TestCallErrorsAreDistinctFromRejections(t *testing.T) {
	if got := doc(t, parseWith(99999, "anything")); got["ok"] != false {
		t.Errorf("an unknown handle must be ok:false, got %v", got)
	}
}

func TestFreedHandleStopsWorking(t *testing.T) {
	res := doc(t, loadGrammar(corpus(t, "list")))
	h := int64(res["handle"].(float64))
	freeGrammar(h)
	if got := doc(t, parseWith(h, "- a\n")); got["ok"] != false {
		t.Errorf("a freed handle must stop working, got %v", got)
	}
}

func TestHandlesAreIndependent(t *testing.T) {
	a := mustLoad(t, "list")
	res := doc(t, loadGrammar(corpus(t, "json")))
	b := int64(res["handle"].(float64))
	freeGrammar(b)
	if got := doc(t, parseWith(a, "- a\n")); got["accept"] != true {
		t.Errorf("freeing one grammar disturbed another: %v", got)
	}
}

// A *Tabnas is not safe for concurrent Parse and an FFI caller does not
// have to serialise — CPython releases the GIL for a ctypes call. Run
// under -race, this is the test that justifies the mutex.
func TestConcurrentParseIsSafe(t *testing.T) {
	h := mustLoad(t, "json")
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			src := `{"a":1}`
			if i%2 == 1 {
				src = "{oops"
			}
			if got := doc(t, parseWith(h, src)); got["ok"] != true {
				t.Errorf("concurrent parse failed: %v", got)
			}
		}(i)
	}
	wg.Wait()
}
