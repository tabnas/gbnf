// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// The Go front-end parses GBNF by hand where the TypeScript one drives
// the engine over a rule table, so internal shape parity is not
// available. What IS held in common is the accepted language and the
// emitted IR — these cases mirror ts/test/gbnf.test.js, and the corpus
// tests below grade the same eight llama.cpp reference grammars.
package gbnf

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	bnf "github.com/tabnas/bnf/go"
	tabnas "github.com/tabnas/parser/go"
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

// The eight llama.cpp reference grammars. Every one must COMPILE, and
// what they accept is graded below; the known gaps are documented in
// ts/doc/known-gaps.md and apply here too.
func TestCorpusCompiles(t *testing.T) {
	dir := filepath.Join("..", "test", "corpus")
	names := []string{
		"arithmetic", "c", "chess", "english", "japanese", "json", "json_arr",
		"list",
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

// Accept/reject grading, the direction that was TypeScript-only until
// the Go engine gained negotiated lexing (parser/go v0.8.5).
//
// The samples mirror ts/test/corpus.test.js — read off the grammar
// text, valid ones paired with near-misses one character outside the
// language. All eight grammars agree with TypeScript in both
// directions, since bnf/go v0.1.4 (see corpusExpectedFailures below).
var corpusAccept = map[string][]string{
	"arithmetic": {"a+b=c\n", "x=y\n"},
	"c":          {"int f(){return x;}", "int intx(){intx = 3;}"},
	"chess":      {"1. e4 e5\n2. Nxe4 e5\n"},
	"english":    {"Hello, world!", "a b c"},
	"japanese":   {"こんにちは"},
	"json":       {"{\"answer\": [1, 2, 3]}", "{\"a\": \"\\n\"}"},
	"json_arr":   {"[\n1,\n2\n]"},
	"list":       {"- a\n"},
}

var corpusReject = map[string][]string{
	"arithmetic": {"a=b", "a=b+c\n"},
	// Top level is function declarations only, so a bare statement is
	// outside the language — with or without spaces around the "=".
	// "int x = 1;\n" sat in corpusExpectedFailures for months claiming
	// to be in-language; the canonical TS front-end rejects it too.
	"c":     {"int x=1;\n", "int x = 1;\n"},
	"chess": {"1. e4\n"},
	// Every whitespace run must be followed by another word, so a
	// trailing newline is outside the language. "Hello world.\n" was
	// likewise a mislabelled expected-failure, not a gap.
	"english":  {"hello world\n", "Hello world.\n"},
	"japanese": {"hello"},
	"json":     {"{\"a\":1,}"},
	"json_arr": {"[\n1, 2\n]"},
	"list":     {"-a\n"},
}

// Samples that are INSIDE the grammar's language but that this runtime
// cannot yet parse. Asserted as failures, the way ts/test/corpus.test.js
// asserts its own: if one starts working the suite goes red, and this
// table plus ts/doc/known-gaps.md have to move together.
//
// EMPTY since @tabnas/bnf v0.1.4 ported the shared compiler's
// contested-alternative guards (FOLLOW / FOLLOW2 repetition exits,
// keyword-shadow guards, left factoring — tabnas/bnf#13): arithmetic's
// samples moved to corpusAccept, and the former c and english entries
// turned out to be OUTSIDE their languages (the canonical TS front-end
// rejects them too) and moved to corpusReject. The table and its test
// stay, so the next gap has somewhere honest to live.
var corpusExpectedFailures = map[string][]string{}

func corpusParse(t *testing.T, name, sample string) error {
	t.Helper()
	src, err := os.ReadFile(filepath.Join("..", "test", "corpus", name+".gbnf"))
	if err != nil {
		t.Fatalf("cannot read %s.gbnf: %v", name, err)
	}
	tn := tabnas.Make()
	if _, err := Install(tn, string(src), nil); err != nil {
		t.Fatalf("%s.gbnf failed to compile: %v", name, err)
	}
	_, err = tn.Parse(sample)
	return err
}

func TestCorpusAccepts(t *testing.T) {
	for name, samples := range corpusAccept {
		for _, s := range samples {
			if err := corpusParse(t, name, s); err != nil {
				t.Errorf("%s.gbnf rejected %q, which is in its language: %v",
					name, s, err)
			}
		}
	}
}

// The direction that matters just as much: a validator that accepts
// everything is not validating.
func TestCorpusRejects(t *testing.T) {
	for name, samples := range corpusReject {
		for _, s := range samples {
			if err := corpusParse(t, name, s); err == nil {
				t.Errorf("%s.gbnf accepted %q, which is outside its language",
					name, s)
			}
		}
	}
}

func TestCorpusKnownGaps(t *testing.T) {
	for name, samples := range corpusExpectedFailures {
		for _, s := range samples {
			if err := corpusParse(t, name, s); err == nil {
				t.Errorf("%s.gbnf now parses %q. That is good news, and it "+
					"means the gap record is out of date — update "+
					"ts/doc/known-gaps.md and go/README.md, and move this "+
					"case into corpusAccept.", name, s)
			}
		}
	}
}
