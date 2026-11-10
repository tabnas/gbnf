// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

package gbnf

// tree_test.go — the tree a host translates, ParseGbnfTree: a GBNF
// document read as the schema grammar-rules. test/spec/tree.tsv holds each
// grammar to its tree's JSON text, member order included, as the
// TypeScript and Rust runners (ts/test/tree.test.js, rs/tests/tree_test.rs)
// hold theirs; the order is part of the contract, since a host streams the
// members in that order and the part makes the same events from the rule
// passes of Make().
//
// Repetition is replacement (AGENTS.md): the rules of a grammar, the
// alternatives of a rule or a group and the elements of an alternative
// add no rule depth however many there are.

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	bnf "github.com/tabnas/bnf/go"
	tabnas "github.com/tabnas/parser/go"
)

// jsString is a string as JavaScript's JSON.stringify writes it: `"` and
// `\` escaped, the five controls JSON names by a letter so named, any
// other control as \u00XX, and every other character as itself.
func jsString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if r < 0x20 {
				fmt.Fprintf(&b, `\u%04x`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

// treeJSON is a tree's JSON text, as the TypeScript and Rust runners write
// it: its members in order, a whole number without a fraction, and a
// string as JSON.stringify writes it.
func treeJSON(v any) (string, error) {
	var b strings.Builder
	if err := writeTreeJSON(&b, v); err != nil {
		return "", err
	}
	return b.String(), nil
}

func writeTreeJSON(b *strings.Builder, v any) error {
	switch x := v.(type) {
	case *tabnas.OrderedMap:
		b.WriteByte('{')
		for i, k := range x.Keys {
			if i > 0 {
				b.WriteByte(',')
			}
			b.WriteString(jsString(k))
			b.WriteByte(':')
			if err := writeTreeJSON(b, x.Vals[k]); err != nil {
				return err
			}
		}
		b.WriteByte('}')
	case []any:
		b.WriteByte('[')
		for i, item := range x {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := writeTreeJSON(b, item); err != nil {
				return err
			}
		}
		b.WriteByte(']')
	case string:
		b.WriteString(jsString(x))
	case bool:
		b.WriteString(strconv.FormatBool(x))
	case float64:
		if x == math.Trunc(x) && math.Abs(x) < 1<<53 {
			b.WriteString(strconv.FormatInt(int64(x), 10))
		} else {
			b.WriteString(strconv.FormatFloat(x, 'g', -1, 64))
		}
	case nil:
		b.WriteString("null")
	default:
		return fmt.Errorf("a %T in the tree", v)
	}
	return nil
}

// treeCode is the engine's code an error from ParseGbnfTree carries.
func treeCode(err error) string {
	var te *tabnas.TabnasError
	if errors.As(err, &te) {
		return te.Code
	}
	return ""
}

// treeRow is a row of test/spec/tree.tsv.
type treeRow struct {
	line     int
	grammar  string
	expected string
}

// treeRows reads the fixture rows: a header, then a grammar and its
// expected cell to a line, a line starting with `#` a comment. A grammar
// cell's `\n`, `\r`, `\t` and `\\` are the characters they name, as
// tabnas-support reads a cell; the expected cell is the tree's JSON text,
// or ERROR:<code>.
func treeRows(t *testing.T) []treeRow {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "test", "spec", "tree.tsv"))
	if err != nil {
		t.Fatal(err)
	}
	unescape := strings.NewReplacer(`\\`, `\`, `\n`, "\n", `\r`, "\r", `\t`, "\t")
	var rows []treeRow
	for i, line := range strings.Split(string(raw), "\n") {
		if 0 == i || "" == line || strings.HasPrefix(line, "#") {
			continue
		}
		cells := strings.SplitN(line, "\t", 2)
		if len(cells) != 2 {
			t.Fatalf("tree.tsv:%d has no expected cell", i+1)
		}
		rows = append(rows, treeRow{line: i + 1, grammar: unescape.Replace(cells[0]), expected: cells[1]})
	}
	return rows
}

func TestSpecTree(t *testing.T) {
	inCheckout(t)
	for _, row := range treeRows(t) {
		tree, err := ParseGbnfTree(row.grammar)
		if want, ok := strings.CutPrefix(row.expected, "ERROR:"); ok {
			if got := treeCode(err); got != want {
				t.Errorf("tree.tsv:%d %q: refused with %q (%v), want %q", row.line, row.grammar, got, err, want)
			}
			continue
		}
		if err != nil {
			t.Errorf("tree.tsv:%d %q: %v", row.line, row.grammar, err)
			continue
		}
		if err := bnf.CheckRules(tree); err != nil {
			t.Errorf("tree.tsv:%d %q: not a grammar-rules tree: %v", row.line, row.grammar, err)
		}
		got, err := treeJSON(tree)
		if err != nil {
			t.Fatal(err)
		}
		if got != row.expected {
			t.Errorf("tree.tsv:%d %q\n  got:      %s\n  expected: %s", row.line, row.grammar, got, row.expected)
		}
	}
}

// Every grammar of the fixtures and the corpora that the tree parser reads
// is a tree of the schema.
func TestTreesAreGrammarRules(t *testing.T) {
	inCheckout(t)
	var sources []string
	for _, row := range treeRows(t) {
		sources = append(sources, row.grammar)
	}
	files, _ := filepath.Glob(filepath.Join("..", "test", "corpus", "*.gbnf"))
	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		sources = append(sources, string(raw))
	}
	raw, err := os.ReadFile(filepath.Join("..", "test", "live", "json-schema-corpus.json"))
	if err != nil {
		t.Fatal(err)
	}
	var live struct {
		Cases []struct {
			Grammar string `json:"grammar"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &live); err != nil {
		t.Fatal(err)
	}
	for _, c := range live.Cases {
		sources = append(sources, c.Grammar)
	}
	read := 0
	for _, src := range sources {
		tree, err := ParseGbnfTree(src)
		if err != nil {
			continue
		}
		if err := bnf.CheckRules(tree); err != nil {
			t.Errorf("%q: %v", src, err)
		}
		read++
	}
	if read <= 100 {
		t.Fatalf("%d trees read", read)
	}
}

// The tree parser's actions are the ones the meta-grammar's table carries,
// keyed to it, so the rule passes are the meta-grammar's: Make panics on
// an action the table does not take, and the table on one it lacks.
func TestTreeActionsAreTheTables(t *testing.T) {
	acts := treeActs()
	defineGbnfRules(tabnas.Empty(gbnfOptions()), acts)
	for key := range acts.state {
		if !acts.bound[key] {
			t.Errorf("the state action %s is not one the table takes", key)
		}
	}
	for key := range acts.alt {
		if !acts.bound[key] {
			t.Errorf("the action %s is not one the table takes", key)
		}
	}
}

func TestMakeIsFresh(t *testing.T) {
	a, b := Make(), Make()
	if a == b {
		t.Fatal("Make returned one parser twice")
	}
	got, err := a.Parse("root ::= \"y\"\n")
	if err != nil {
		t.Fatal(err)
	}
	want, _ := ParseGbnfTree("root ::= \"y\"\n")
	gotText, _ := treeJSON(got)
	wantText, _ := treeJSON(want)
	if gotText != wantText {
		t.Fatalf("Make's value %s, the tree %s", gotText, wantText)
	}
}

// treeDepth is the deepest rule a parse of src reaches.
func treeDepth(t *testing.T, src string) int {
	t.Helper()
	j := Make()
	deepest := 0
	j.SubRuleDone(func(rule *tabnas.Rule, _ *tabnas.Context, done tabnas.RuleDone) {
		if !done.Probe && rule.D > deepest {
			deepest = rule.D
		}
	})
	if _, err := j.Parse(src); err != nil {
		t.Fatal(err)
	}
	return deepest
}

func TestTreeRepetitionAddsNoDepth(t *testing.T) {
	const n = 10000
	join := func(n int, item func(i int) string, sep string) string {
		parts := make([]string, n)
		for i := range parts {
			parts[i] = item(i)
		}
		return strings.Join(parts, sep)
	}
	repeated := []struct {
		what string
		doc  func(n int) string
	}{
		{"rules of a grammar", func(n int) string {
			return join(n, func(i int) string { return fmt.Sprintf("r%d ::= \"x\"\n", i) }, "")
		}},
		{"alternatives of a rule", func(n int) string {
			return "a ::= " + join(n, func(i int) string { return fmt.Sprintf("r%d", i) }, " | ") + "\n"
		}},
		{"elements of an alternative", func(n int) string {
			return "a ::= " + join(n, func(i int) string { return fmt.Sprintf("r%d*", i) }, " ") + "\n"
		}},
		{"alternatives of a group", func(n int) string {
			return "a ::= ( " + join(n, func(i int) string { return fmt.Sprintf("[%c]", 'a'+i%26) }, " | ") + " )\n"
		}},
		{"elements of a group", func(n int) string {
			return "a ::= ( " + strings.Repeat("\"x\" ", n) + ")?\n"
		}},
	}
	for _, c := range repeated {
		// Two items, since a list's first item can sit apart from its
		// repeated ones: the loop's own item is the second.
		if got, want := treeDepth(t, c.doc(n)), treeDepth(t, c.doc(2)); got != want {
			t.Errorf("the %s: %d reach depth %d, two reach %d", c.what, n, got, want)
		}
	}
}
