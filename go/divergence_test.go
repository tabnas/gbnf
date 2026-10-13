// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// The pins of DIVERGENCE.md 7: where the spec this port emits is spelled
// otherwise than TypeScript's, for the same source. Each test asserts what
// this port writes and names what TypeScript writes, so a port that starts
// agreeing fails as loudly as one that drifts further, and the row goes
// with its pin. go/oracle_test.go holds what the spec ACCEPTS to
// TypeScript's over the whole corpus, and how its rules and match tokens
// are written; these hold the rest of how it is SPELLED. Rows 1 and 4
// closed with tabnas-bnf 0.1.30, and their pins went with them.
package gbnf

import (
	"encoding/json"
	"testing"

	bnf "github.com/tabnas/bnf/go"
)

// The spec as a host reads it from this port: the pure-data spec, written
// by the shared compiler's serializer.
func hostText(t *testing.T, src string) string {
	t.Helper()
	spec, err := Gbnf(src, &ConvertOptions{Builtins: true})
	if err != nil {
		t.Fatal(err)
	}
	pure, err := bnf.ToPureSpec(spec)
	if err != nil {
		t.Fatal(err)
	}
	return bnf.ToJsonic(pure, true, 2)
}

// The same, parsed back.
func hostSpec(t *testing.T, src string) map[string]any {
	t.Helper()
	var tree map[string]any
	if err := json.Unmarshal([]byte(hostText(t, src)), &tree); err != nil {
		t.Fatal(err)
	}
	return tree
}

func matchTokens(t *testing.T, tree map[string]any) map[string]any {
	t.Helper()
	options, _ := tree["options"].(map[string]any)
	match, _ := options["match"].(map[string]any)
	tokens, _ := match["token"].(map[string]any)
	return tokens
}

// Row 2. TypeScript names this class `#RX___U0061__U007A`, for its
// pattern `[\u0061-\u007a]`.
func TestDivergenceAClassIsNamedForItsRE2Spelling(t *testing.T) {
	tokens := matchTokens(t, hostSpec(t, `root ::= [a-z]`))
	if _, ok := tokens["#RX___X_61___X_7A"]; !ok || len(tokens) != 1 {
		t.Errorf("this port names [a-z] for RE2's [\\x{61}-\\x{7a}], and named %v; "+
			"if it is #RX___U0061__U007A, delete DIVERGENCE.md 7's second row", tokens)
	}
	if got := tokens["#RX___X_61___X_7A"]; got != `@~/^[\u0061-\u007a]/` {
		t.Errorf("the pattern is written back in JavaScript's spelling, and is %v", got)
	}
}

// Row 3. TypeScript clears `eager$` from both classes here, since [a-z]
// holds the "x" a literal begins with (markClassesEager refuses, and
// clearClassesEager clears), and keeps it for `root ::= [a-z]+ [0-9]`.
func TestDivergenceEveryClassIsEager(t *testing.T) {
	for _, src := range []string{`root ::= [a-z]+ "x" | [0-9]`, `root ::= [a-z]+ [0-9]`} {
		spec, err := Gbnf(src, nil)
		if err != nil {
			t.Fatal(err)
		}
		for _, name := range []string{"#RX___X_61___X_7A", "#RX___X_30___X_39"} {
			if !spec.Options.Match.TokenEager[name] {
				t.Errorf("%s: this port flags every class eager, and %s is not; if the decision "+
					"is TypeScript's, delete DIVERGENCE.md 7's third row", src, name)
			}
		}
	}
}

// Row 5. TypeScript's loop ends on "x" ahead of [0-9], in the order the
// compiler meets them.
func TestDivergenceALoopsExitGuardsAreInNameOrder(t *testing.T) {
	tree := hostSpec(t, `root ::= [a-c]* ("x" | [0-9])`)
	rules, _ := tree["rule"].(map[string]any)
	loop, _ := rules["_gen1_star_x"].(map[string]any)
	open, _ := loop["open"].([]any)
	at := map[string]int{}
	for i, alt := range open {
		if a, ok := alt.(map[string]any); ok {
			if s, ok := a["s"].(string); ok {
				at[s] = i
			}
		}
	}
	class, okClass := at["#RX___X_30___X_39"]
	x, okX := at["#X"]
	if !okClass || !okX || class > x {
		t.Errorf("this port puts the loop's exit guard on [0-9] ahead of the one on \"x\", "+
			"and the loop is %v; if \"x\" comes first, delete DIVERGENCE.md 7's fifth row", open)
	}
}
