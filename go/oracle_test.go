// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// The canonical TypeScript, recorded. rs/tests/oracle/gbnf-oracle.json
// holds what ts/dist answered for 222 GBNF sources: every construct the
// notation has, every refusal, the eight llama.cpp grammars of
// test/corpus/ and the 77 schema-generated ones of test/live/
// (rs/tests/oracle/gen-oracle.js writes it). This port is held to the
// parts of each emitted spec that decide what the grammar accepts: a
// source TypeScript refuses is refused here, and for every other source
// the rules, lex.empty and the match tokens agree, each token by the
// characters it matches. A token's name and the regex dialect its pattern
// is spelled in are set aside, since Go writes RE2's `\x{61}` where
// JavaScript writes `\u0061` and names the token for what it wrote
// (DIVERGENCE.md 7).
//
// A literal compiled to a case-folding match token, where TypeScript
// writes the fixed token an exact match needs, is a match token
// TypeScript does not have. This port did that to every literal holding
// a letter until the IR carried HasCaseSens (`root ::= "b"` accepted
// "B"); this is the corpus-wide check that no literal does it again.
package gbnf

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

type oracleEntry struct {
	Name            string          `json:"name"`
	Src             string          `json:"src"`
	MatchTokens     []oracleToken   `json:"matchTokens"`
	LexEmpty        *bool           `json:"lexEmpty"`
	RuleNames       []string        `json:"ruleNames"`
	ParseError      json.RawMessage `json:"parseError"`
	CompileError    json.RawMessage `json:"compileError"`
	Unrepresentable string          `json:"unrepresentable"`
}

type oracleToken struct {
	Name   string `json:"name"`
	Source string `json:"source"`
}

// A code point escape in either dialect: JavaScript's `\uXXXX` and
// `\u{X...}`, RE2's `\x{X...}`.
var codePointEscape = regexp.MustCompile(`\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|\\x\{([0-9a-fA-F]+)\}`)

// patternKey writes every code point escape of a pattern one way, so two
// patterns that match the same characters, each spelled in its own
// runtime's dialect, have the same key.
func patternKey(source string) string {
	return codePointEscape.ReplaceAllStringFunc(source, func(m string) string {
		parts := codePointEscape.FindStringSubmatch(m)
		hex := parts[1] + parts[2] + parts[3]
		n, err := strconv.ParseUint(hex, 16, 32)
		if err != nil {
			return m
		}
		return "\\x{" + strconv.FormatUint(n, 16) + "}"
	})
}

func TestOracleAgreesWithTypeScript(t *testing.T) {
	inCheckout(t)
	raw, err := os.ReadFile(filepath.Join("..", "rs", "tests", "oracle", "gbnf-oracle.json"))
	if err != nil {
		t.Fatal(err)
	}
	var entries []oracleEntry
	if err := json.Unmarshal(raw, &entries); err != nil {
		t.Fatal(err)
	}
	refused, compared, skipped := 0, 0, 0
	for _, e := range entries {
		switch {
		case e.Unrepresentable != "":
			// A lone surrogate, which JSON cannot carry: DIVERGENCE.md 1.
			skipped++
		case e.ParseError != nil || e.CompileError != nil:
			refused++
			if _, err := Gbnf(e.Src, nil); err == nil {
				t.Errorf("%s: TypeScript refuses %q, and this port compiles it", e.Name, e.Src)
			}
		case e.MatchTokens != nil:
			compared++
			spec, err := Gbnf(e.Src, nil)
			if err != nil {
				t.Errorf("%s: TypeScript compiles %q, and this port refuses it: %v", e.Name, e.Src, err)
				continue
			}
			var want, got []string
			for _, tok := range e.MatchTokens {
				want = append(want, patternKey(tok.Source))
			}
			if spec.Options.Match != nil {
				for _, re := range spec.Options.Match.Token {
					got = append(got, patternKey(re.String()))
				}
			}
			sort.Strings(want)
			sort.Strings(got)
			if strings.Join(want, "\n") != strings.Join(got, "\n") {
				t.Errorf("%s: the match tokens differ from TypeScript's\n  want %q\n  got  %q", e.Name, want, got)
			}
			wantEmpty := e.LexEmpty != nil && *e.LexEmpty
			gotEmpty := spec.Options.Lex != nil && spec.Options.Lex.Empty != nil && *spec.Options.Lex.Empty
			if wantEmpty != gotEmpty {
				t.Errorf("%s: lex.empty is %v, and TypeScript's is %v", e.Name, gotEmpty, wantEmpty)
			}
			names := make([]string, 0, len(spec.Rule))
			for name := range spec.Rule {
				names = append(names, name)
			}
			wantNames := append([]string(nil), e.RuleNames...)
			sort.Strings(names)
			sort.Strings(wantNames)
			if strings.Join(names, " ") != strings.Join(wantNames, " ") {
				t.Errorf("%s: the rules differ from TypeScript's\n  want %v\n  got  %v", e.Name, wantNames, names)
			}
		}
	}
	// The census, so an oracle that lost its entries cannot pass by
	// comparing nothing: 185 compiled and compared, 33 refused, 4 lone
	// surrogates set aside.
	if compared != 185 || refused != 33 || skipped != 4 {
		t.Errorf("the oracle holds %d sources compared, %d refused and %d set aside; want 185, 33 and 4",
			compared, refused, skipped)
	}
}
