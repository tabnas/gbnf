// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

package main

// The GBNF-specific guarantees of libtabnasgbnf, in a file the clib
// template does not own (core_test.go is stamped; this is not).
//
// Under the uniform ABI, tabnas_parse takes GBNF grammar TEXT and, when
// it compiles, answers with the grammar's recognition spec as `value`.
// That value is what a caller hands to the engine's own library
// (libtabnasparser's tabnas_grammar) to validate text with no GBNF
// front-end present, so it is only worth offering if a bare engine
// loaded from it accepts and rejects exactly what a native install does.
// "It is valid JSON" is not that property: until @tabnas/bnf v0.1.5 the
// serialized form dropped GBNF's lexing configuration, so the spec
// loaded cleanly and then lexed "a+b" in arithmetic.gbnf as one token
// and rejected "a+b=c".

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	gbnf "github.com/tabnas/gbnf/go"
	tabnas "github.com/tabnas/parser/go"
)

// The same samples go/gbnf_test.go grades natively and py/test_gbnf.py
// grades through the two C libraries. All EIGHT corpus grammars: a
// census short of the full set would let a regression in an omitted
// grammar pass a test that claims whole-corpus conformance.
var (
	valueAccept = map[string][]string{
		"arithmetic": {"a+b=c\n", "x=y\n"},
		"c":          {"int f(){return x;}", "int intx(){intx = 3;}"},
		"chess":      {"1. e4 e5\n2. Nxe4 e5\n"},
		"english":    {"Hello, world!", "a b c"},
		"japanese":   {"こんにちは"},
		"json":       {"{\"answer\": [1, 2, 3]}", "{\"a\": \"\\n\"}"},
		"json_arr":   {"[\n1,\n2\n]"},
		"list":       {"- a\n"},
	}
	valueReject = map[string][]string{
		"arithmetic": {"a=b", "a=b+c\n"},
		"c":          {"int x=1;\n", "int x = 1;\n"},
		"chess":      {"1. e4\n"},
		"english":    {"hello world\n", "Hello world.\n"},
		"japanese":   {"hello"},
		"json":       {"{\"a\":1,}"},
		"json_arr":   {"[\n1, 2\n]"},
		"list":       {"-a\n"},
	}
)

const (
	valueCorpusSize = 8
	valueSampleSize = 23
)

func corpusSource(t *testing.T, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("..", "..", "test", "corpus", name+".gbnf"))
	if err != nil {
		t.Fatalf("corpus grammar %s: %v", name, err)
	}
	return string(b)
}

// replyFields decodes a reply document, keeping each member raw so that
// `value` reaches the engine as the exact bytes the library emitted.
func replyFields(t *testing.T, doc string) map[string]json.RawMessage {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal([]byte(doc), &m); err != nil {
		t.Fatalf("reply is not JSON: %v\n%s", err, doc)
	}
	return m
}

func gbnfHandle(t *testing.T) int64 {
	t.Helper()
	m := replyFields(t, loadGrammar(""))
	var h int64
	if string(m["ok"]) != "true" || json.Unmarshal(m["handle"], &h) != nil || h <= 0 {
		t.Fatalf("loadGrammar failed: %v", m)
	}
	t.Cleanup(func() { freeGrammar(h) })
	return h
}

// bareEngine loads a serialized spec into an engine with no GBNF
// front-end involved, as a libtabnasparser caller in another language
// would have it.
func bareEngine(t *testing.T, name string, spec []byte) *tabnas.Tabnas {
	t.Helper()
	gs, err := tabnas.GrammarSpecFromJSON(spec)
	if err != nil {
		t.Fatalf("%s.gbnf: value will not load as a GrammarSpec: %v", name, err)
	}
	tn := tabnas.Make()
	if err := tn.Grammar(gs); err != nil {
		t.Fatalf("%s.gbnf: value will not install: %v", name, err)
	}
	return tn
}

// The value, loaded into a bare engine, grades the corpus in BOTH
// directions and agrees with a native install sample by sample. It is
// graded twice: as the library's own bytes, and after an ordinary JSON
// decode and re-encode (encoding/json sorts object keys), because a
// caller in another language will do exactly that before handing it
// on, and the format notes promise that it is safe.
func TestValueRunsOnTheBareEngine(t *testing.T) {
	if len(valueAccept) != valueCorpusSize || len(valueReject) != valueCorpusSize {
		t.Fatalf("corpus census is %d accept / %d reject, want %d each",
			len(valueAccept), len(valueReject), valueCorpusSize)
	}

	h := gbnfHandle(t)
	graded := 0
	for name, accepts := range valueAccept {
		src := corpusSource(t, name)
		m := replyFields(t, parseWith(h, src))
		if string(m["ok"]) != "true" || string(m["accept"]) != "true" {
			t.Errorf("%s.gbnf did not compile: %s", name, m["error"])
			continue
		}
		raw := []byte(m["value"])

		var decoded any
		if err := json.Unmarshal(raw, &decoded); err != nil {
			t.Fatalf("%s.gbnf: value is not JSON: %v", name, err)
		}
		reencoded, err := json.Marshal(decoded)
		if err != nil {
			t.Fatalf("%s.gbnf: value will not re-encode: %v", name, err)
		}

		native := tabnas.Make()
		if _, err := gbnf.Install(native, src, nil); err != nil {
			t.Fatalf("%s.gbnf: native install failed: %v", name, err)
		}

		engines := map[string]*tabnas.Tabnas{
			"value":      bareEngine(t, name, raw),
			"re-encoded": bareEngine(t, name, reencoded),
		}
		grade := func(s string, want bool) {
			_, nerr := native.Parse(s)
			if (nerr == nil) != want {
				t.Errorf("%s.gbnf: native install answered %v for %q, want %v",
					name, nerr == nil, s, want)
			}
			for form, tn := range engines {
				if _, err := tn.Parse(s); (err == nil) != want {
					t.Errorf("%s.gbnf (%s): bare engine answered %v for %q, "+
						"want %v (native: %v)", name, form, err == nil, s, want,
						nerr == nil)
				}
			}
			graded++
		}
		for _, s := range accepts {
			grade(s, true)
		}
		for _, s := range valueReject[name] {
			grade(s, false)
		}
	}
	if graded != valueSampleSize {
		t.Errorf("graded %d samples, want the full %d-sample census",
			graded, valueSampleSize)
	}
}

// A grammar that does not compile is a REJECTION of the GBNF text
// (ok:true, accept:false) and never yields a value — otherwise a caller
// could ship an empty grammar believing it compiled. Each case is one
// of the conditions the format notes name for accept:true.
func TestBrokenGrammarYieldsNoValue(t *testing.T) {
	h := gbnfHandle(t)
	for _, c := range []struct{ why, src string }{
		{"unparseable", "root ::= ["},
		{"undefined reference", "root ::= nosuchrule"},
		{"no root rule", "other ::= \"a\""},
		{"empty", ""},
		{"tokenizer-token terminal", "root ::= <[1000]>\n"},
		{"purely left-recursive", "root ::= root \"a\"\n"},
	} {
		m := replyFields(t, parseWith(h, c.src))
		if string(m["ok"]) != "true" {
			t.Errorf("%s: a broken grammar is an answer, not a failed call: %v",
				c.why, m)
			continue
		}
		if string(m["accept"]) != "false" {
			t.Errorf("%s: %q was accepted as GBNF", c.why, c.src)
		}
		if _, leaked := m["value"]; leaked {
			t.Errorf("%s: a rejection must not carry a value: %v", c.why, m)
		}
		if len(m["error"]) == 0 || string(m["error"]) == "null" {
			t.Errorf("%s: a rejection should explain itself: %v", c.why, m)
		}
	}
}
