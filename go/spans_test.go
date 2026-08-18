package gbnf

import (
	"encoding/json"
	"strings"
	"testing"

	bnf "github.com/tabnas/bnf/go"
)

// Source spans (plan C5). The front-end records where each element and
// production came from, so a compile failure carries a range and a tool
// can underline the offending text.
//
// Every assertion slices the ORIGINAL SOURCE with the span and compares
// the text. That is the only check worth making: an offset pair that is
// self-consistent but points at the wrong characters would satisfy any
// assertion about the numbers themselves.
//
// Mirrors ts/test/gbnf.test.js `describe('source spans')`.

const spanSrc = "root ::= item\n" +
	"item ::= \"hi\" | [a-z] | . | ref | (alt | two)\n" +
	"ref ::= \"r\"\n" +
	"alt ::= \"a\"\n" +
	"two ::= \"b\""

func spanGrammar(t *testing.T) *bnf.Grammar {
	t.Helper()
	g, err := ParseGbnf(spanSrc)
	if err != nil {
		t.Fatalf("ParseGbnf: %v", err)
	}
	return g
}

func spanText(t *testing.T, sp *bnf.SrcSpan) string {
	t.Helper()
	if sp == nil {
		t.Fatal("expected a span, got none")
	}
	return spanSrc[sp.S:sp.E]
}

func spanProd(t *testing.T, name string) *bnf.Production {
	t.Helper()
	for _, p := range spanGrammar(t).Productions {
		if p.Name == name {
			return p
		}
	}
	t.Fatalf("no production %q", name)
	return nil
}

func TestProductionSpansItsName(t *testing.T) {
	p := spanProd(t, "item")
	if got := spanText(t, p.Sp); got != "item" {
		t.Errorf("production span = %q, want %q", got, "item")
	}
	if p.Sp.R != 2 || p.Sp.C != 1 {
		t.Errorf("row/col = %d:%d, want 2:1 (1-based, as the engine reports)",
			p.Sp.R, p.Sp.C)
	}
}

func TestAtomSpans(t *testing.T) {
	alts := spanProd(t, "item").Alts
	for _, c := range []struct {
		i    int
		want string
	}{
		{0, `"hi"`}, {1, "[a-z]"}, {2, "."}, {3, "ref"},
	} {
		if got := spanText(t, alts[c.i][0].Sp); got != c.want {
			t.Errorf("alt %d span = %q, want %q", c.i, got, c.want)
		}
	}
}

func TestGroupSpansItsDelimiters(t *testing.T) {
	group := spanProd(t, "item").Alts[4][0]
	if group.Kind != bnf.KindGroup {
		t.Fatalf("expected a group, got %v", group.Kind)
	}
	if got := spanText(t, group.Sp); got != "(alt | two)" {
		t.Errorf("group span = %q, want %q", got, "(alt | two)")
	}
	if got := spanText(t, group.Alts[0][0].Sp); got != "alt" {
		t.Errorf("inner span = %q, want %q", got, "alt")
	}
	if got := spanText(t, group.Alts[1][0].Sp); got != "two" {
		t.Errorf("inner span = %q, want %q", got, "two")
	}
}

// A span whose offset and row/column disagree is worse than no span: a
// consumer picking either one gets a different answer.
func TestSpanRowAndColumnAgreeWithTheOffset(t *testing.T) {
	for _, p := range spanGrammar(t).Productions {
		if p.Sp == nil {
			continue
		}
		before := spanSrc[:p.Sp.S]
		row := strings.Count(before, "\n") + 1
		col := p.Sp.S - (strings.LastIndex(before, "\n") + 1) + 1
		if p.Sp.R != row {
			t.Errorf("%s: row = %d, want %d (from the offset)", p.Name, p.Sp.R, row)
		}
		if p.Sp.C != col {
			t.Errorf("%s: col = %d, want %d (from the offset)", p.Name, p.Sp.C, col)
		}
	}
}

// The tokenizer-token terminal is not compilable — the syntax layer
// accepts it so a grammar containing one is not a *syntax* error, and
// validation then rejects it by name. Carrying a span is what lets that
// rejection point at the offending text.
func TestTokenTerminalCarriesASpan(t *testing.T) {
	src := "root ::= item\nitem ::= \"a\" | <tok>"
	g, err := ParseGbnf(src)
	if err != nil {
		// Rejected at parse time: the diagnostic is the point, and it
		// should name the rule.
		if !strings.Contains(err.Error(), "item") {
			t.Errorf("rejection does not name the rule: %v", err)
		}
		return
	}
	// Accepted into the IR: then it must carry a span.
	for _, p := range g.Productions {
		for _, alt := range p.Alts {
			for _, el := range alt {
				if el.Kind == bnf.KindProse {
					if el.Sp == nil {
						t.Fatal("tokenizer-token terminal carried no span")
					}
					if got := src[el.Sp.S:el.Sp.E]; got != "<tok>" {
						t.Errorf("span = %q, want %q", got, "<tok>")
					}
					return
				}
			}
		}
	}
}

func TestSpansDoNotReachTheEmittedGrammar(t *testing.T) {
	spec, err := Gbnf("root ::= item\nitem ::= \"hi\" | (a | b)\na ::= \"x\"\nb ::= \"y\"", nil)
	if err != nil {
		t.Fatalf("Gbnf: %v", err)
	}
	raw, err := json.Marshal(spec.Rule)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(raw), `"Sp"`) ||
		strings.Contains(string(raw), `"sp"`) {
		t.Errorf("a span reached the emitted grammar:\n%s", raw)
	}
}
