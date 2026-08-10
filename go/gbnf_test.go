// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// The Go front-end parses GBNF by hand where the TypeScript one drives
// the engine over a rule table, so internal shape parity is not
// available. What IS held in common is the accepted language and the
// emitted IR — these cases mirror ts/test/gbnf.test.js, and the corpus
// test below grades the same seven llama.cpp reference grammars.
package gbnf

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	bnf "github.com/tabnas/bnf/go"
)

func mustParse(t *testing.T, src string) *bnf.Grammar {
	t.Helper()
	g, err := ParseGbnf(src)
	if err != nil {
		t.Fatalf("ParseGbnf(%q) failed: %v", src, err)
	}
	return g
}

func TestParsesRuleIntoProduction(t *testing.T) {
	g := mustParse(t, `root ::= "a"`)
	if len(g.Productions) != 1 || g.Productions[0].Name != "root" {
		t.Fatalf("unexpected productions: %+v", g.Productions)
	}
	el := g.Productions[0].Alts[0][0]
	if el.Kind != bnf.KindTerm || el.Literal != "a" {
		t.Errorf("expected term \"a\", got %+v", el)
	}
	// GBNF's default is the OPPOSITE of RFC 5234's. Losing the flag would
	// silently accept "TRUE" for "true".
	if !el.CaseSensitive {
		t.Error("GBNF literals must be case-sensitive")
	}
}

func TestAlternationSequenceAndGroups(t *testing.T) {
	g := mustParse(t, `root ::= "a" "b" | "c"`)
	if len(g.Productions[0].Alts) != 2 {
		t.Fatalf("expected 2 alts, got %d", len(g.Productions[0].Alts))
	}
	g2 := mustParse(t, `root ::= ("a" | "b") "c"`)
	if g2.Productions[0].Alts[0][0].Kind != bnf.KindGroup {
		t.Error("expected a group")
	}
}

func TestEmptyAlternativeIsLegalGbnf(t *testing.T) {
	// llama.cpp's own json.gbnf writes optional whitespace this way, so
	// unlike the EBNF front-end this one must NOT refuse it.
	g := mustParse(t, "root ::= ws\nws ::= | \" \"")
	ws := g.Productions[1]
	if len(ws.Alts) != 2 || len(ws.Alts[0]) != 0 {
		t.Errorf("expected an empty first alt, got %+v", ws.Alts)
	}
}

func TestDropsEmptyStringLiteral(t *testing.T) {
	g := mustParse(t, `root ::= ""`)
	if len(g.Productions[0].Alts[0]) != 0 {
		t.Errorf("expected `\"\"` to contribute no element, got %+v",
			g.Productions[0].Alts[0])
	}
}

func TestKeepsLastOfTwoDefinitions(t *testing.T) {
	// GBNF has no `=/`; llama.cpp stores rules in a map, so a second
	// definition replaces the first rather than extending it.
	g := mustParse(t, "root ::= a\na ::= \"x\"\na ::= \"y\"")
	if len(g.Productions) != 2 {
		t.Fatalf("expected 2 productions, got %d", len(g.Productions))
	}
	if got := g.Productions[1].Alts[0][0].Literal; got != "y" {
		t.Errorf("expected the later definition to win, got %q", got)
	}
}

func TestCharacterClasses(t *testing.T) {
	// Patterns use RE2's `\x{…}` spelling. The TypeScript front-end
	// emits `\uXXXX` for the same class; the two runtimes agree on the
	// language, not on the source text, and the compiler converts
	// between them when serialising a spec across.
	cases := []struct{ src, pattern, flags string }{
		{`root ::= [a-z]`, `[\x{61}-\x{7a}]`, ""},
		{`root ::= [NBKQR]`, `[\x{4e}\x{42}\x{4b}\x{51}\x{52}]`, ""},
		// A trailing hyphen is a literal member: arithmetic.gbnf's
		// `[-+*/]` is four members, not a range.
		{`root ::= [-+*/]`, `[\x{2d}\x{2b}\x{2a}\x{2f}]`, ""},
		// A negated class matches the COMPLEMENT of its members, which
		// always contains every astral code point.
		{`root ::= [^\n]`, `[^\x{a}]`, "u"},
		{`root ::= .`, `[\s\S]`, "u"},
	}
	for _, c := range cases {
		g := mustParse(t, c.src)
		el := g.Productions[0].Alts[0][0]
		if el.Pattern != c.pattern || el.Flags != c.flags {
			t.Errorf("%s: got %q/%q, want %q/%q",
				c.src, el.Pattern, el.Flags, c.pattern, c.flags)
		}
	}
}

func TestAstralIsOneCharacter(t *testing.T) {
	// GBNF terminals are Unicode code points by definition. japanese.gbnf
	// is BMP-only, which is why this needs its own case.
	g := mustParse(t, `root ::= [\U0001F600-\U0001F64F]`)
	el := g.Productions[0].Alts[0][0]
	if el.Flags != "u" {
		t.Errorf("expected the u flag for an astral range, got %q", el.Flags)
	}
	if !strings.Contains(el.Pattern, `\x{1f600}`) {
		t.Errorf("expected a \\x{…} escape, got %q", el.Pattern)
	}
}

func TestEscapes(t *testing.T) {
	g := mustParse(t, `root ::= "\t\r\n\\\"" `)
	if got := g.Productions[0].Alts[0][0].Literal; got != "\t\r\n\\\"" {
		t.Errorf("escapes decoded wrong: %q", got)
	}
	for _, bad := range []string{
		`root ::= "\q"`, `root ::= "\x"`, `root ::= "\u12"`,
		`root ::= "\U00110000"`,
	} {
		if _, err := ParseGbnf(bad); err == nil {
			t.Errorf("%q should be refused", bad)
		}
	}
}

func TestRepetitionBraces(t *testing.T) {
	g := mustParse(t, `root ::= "x"{2,5}`)
	el := g.Productions[0].Alts[0][0]
	if el.Kind != bnf.KindRep || el.Min != 2 || el.Max != 5 {
		t.Errorf("expected rep{2,5}, got %+v", el)
	}
	g2 := mustParse(t, `root ::= "x"{3}`)
	if e := g2.Productions[0].Alts[0][0]; e.Min != 3 || e.Max != 3 {
		t.Errorf("expected rep{3,3}, got %+v", e)
	}
	// parse_space takes space, tab, CR and LF — and nothing wider.
	if _, err := ParseGbnf("root ::= \"x\"{ 1 }"); err != nil {
		t.Errorf("ASCII space inside braces should be legal: %v", err)
	}
	if _, err := ParseGbnf("root ::= \"x\"{ 1}"); err == nil {
		t.Error("U+00A0 inside braces should be refused")
	}
}

func TestPostfixStacksLeftToRight(t *testing.T) {
	g := mustParse(t, `root ::= "x"*?`)
	el := g.Productions[0].Alts[0][0]
	if el.Kind != bnf.KindOpt || el.Inner.Kind != bnf.KindStar {
		t.Errorf("expected opt(star(...)), got %v(%v)", el.Kind, el.Inner.Kind)
	}
}

func TestComments(t *testing.T) {
	g := mustParse(t, "# leading\nroot ::= \"a\" # trailing\n")
	if len(g.Productions) != 1 {
		t.Errorf("expected comments dropped, got %d", len(g.Productions))
	}
	// `#` inside a literal or class is not a comment.
	g2 := mustParse(t, `root ::= "#" [+#]`)
	if g2.Productions[0].Alts[0][0].Literal != "#" {
		t.Error("`#` inside a literal must not start a comment")
	}
}

func TestRejections(t *testing.T) {
	cases := []struct{ src, want string }{
		{`foo ::= "x"`, "no 'root' rule"},
		{`root ::= missing`, "unknown rule"},
		{`root ::= <think>`, "tokenizer-token terminal"},
		{`root ::= !</think>`, "tokenizer-token terminal"},
		{`root ::= []`, "empty character class"},
		{`root ::= [z-a]`, "descending range"},
	}
	for _, c := range cases {
		_, err := ParseGbnf(c.src)
		if err == nil {
			t.Errorf("%q was accepted; expected %q", c.src, c.want)
			continue
		}
		if !strings.Contains(err.Error(), c.want) {
			t.Errorf("%q: got %q, want it to mention %q", c.src, err, c.want)
		}
	}
}

func TestEmitsSpecWithExactLexing(t *testing.T) {
	spec, err := Gbnf(`root ::= "a"`, nil)
	if err != nil {
		t.Fatalf("Gbnf failed: %v", err)
	}
	if spec.Options.Rule.Start != "__start__" {
		t.Error("expected the __start__ wrapper")
	}
	// GBNF is scannerless, so every default matcher has to be off.
	for name, got := range map[string]*bool{
		"space": spec.Options.Space.Lex, "string": spec.Options.String.Lex,
		"number": spec.Options.Number.Lex, "comment": spec.Options.Comment.Lex,
	} {
		if got == nil || *got {
			t.Errorf("%s lexing must be disabled", name)
		}
	}
	if n := len(spec.Options.TokenSet["IGNORE"]); n != 0 {
		t.Errorf("IGNORE must be empty, got %d entries", n)
	}
}

func TestDerivesEmptyDrivesLexEmpty(t *testing.T) {
	// Whether the empty input is legal is a property of the grammar, and
	// it has to be decided at compile time.
	yes, err := Gbnf(`root ::= "x"*`, nil)
	if err != nil {
		t.Fatal(err)
	}
	if yes.Options.Lex.Empty == nil || !*yes.Options.Lex.Empty {
		t.Error("`root ::= \"x\"*` derives empty, so empty input is legal")
	}
	no, err := Gbnf(`root ::= "x"`, nil)
	if err != nil {
		t.Fatal(err)
	}
	if no.Options.Lex.Empty == nil || *no.Options.Lex.Empty {
		t.Error("`root ::= \"x\"` does not derive empty")
	}
}

func TestDiagnosticsSayGbnf(t *testing.T) {
	_, err := Gbnf(`root ::= root "x"`, nil)
	if err == nil {
		t.Fatal("expected a purely left-recursive rule to be refused")
	}
	if !strings.HasPrefix(err.Error(), "gbnf: ") {
		t.Errorf("expected a gbnf-prefixed diagnostic, got %q", err.Error())
	}
}

// The seven llama.cpp reference grammars. Every one must COMPILE; what
// they then accept is graded by the TypeScript corpus test, whose known
// gaps are documented in ts/doc/known-gaps.md and apply here too.
func TestCorpusCompiles(t *testing.T) {
	dir := filepath.Join("..", "test", "corpus")
	names := []string{
		"arithmetic", "c", "chess", "japanese", "json", "json_arr", "list",
	}
	for _, name := range names {
		src, err := os.ReadFile(filepath.Join(dir, name+".gbnf"))
		if err != nil {
			t.Fatalf("cannot read %s.gbnf: %v", name, err)
		}
		spec, err := Gbnf(string(src), nil)
		if err != nil {
			t.Errorf("%s.gbnf failed to compile: %v", name, err)
			continue
		}
		if spec.Rule["root"] == nil {
			t.Errorf("%s.gbnf compiled without a root rule", name)
		}
	}
}
