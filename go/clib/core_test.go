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
	accept := map[string][]string{
		"arithmetic": {"a+b=c\n", "x=y\n"},
		"chess":      {"1. e4 e5\n2. Nxe4 e5\n"},
		"english":    {"Hello, world!", "a b c"},
		"japanese":   {"こんにちは"},
		"json":       {"{\"answer\": [1, 2, 3]}", "{\"a\": \"\\n\"}"},
		"list":       {"- a\n"},
	}
	reject := map[string][]string{
		"arithmetic": {"a=b", "a=b+c\n"},
		"chess":      {"1. e4\n"},
		"english":    {"hello world\n"},
		"japanese":   {"hello"},
		"json":       {"{\"a\":1,}"},
		"list":       {"-a\n"},
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
