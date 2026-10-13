// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// The pins of DIVERGENCE.md 7: where the spec this port emits is spelled
// otherwise than TypeScript's, for the same source. Each test asserts what
// this port writes and names what TypeScript writes, so a port that starts
// agreeing fails as loudly as one that drifts further, and the row goes
// with its pin. go/oracle_test.go holds what the spec ACCEPTS to
// TypeScript's over the whole corpus; these hold how it is SPELLED.
package gbnf

import (
	"encoding/json"
	"strings"
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

// The keys of the object at path in a JSON text, in the order the text
// writes them, which a map read back cannot show.
func keyOrder(t *testing.T, text string, path ...string) []string {
	t.Helper()
	dec := json.NewDecoder(strings.NewReader(text))
	next := func() json.Token {
		tok, err := dec.Token()
		if err != nil {
			t.Fatal(err)
		}
		return tok
	}
	// walk reads the value the decoder is at, and returns the keys of the
	// object that path names inside it (the value's own keys for an empty
	// path), or nil when it holds no such object.
	var walk func(path []string) []string
	walk = func(path []string) []string {
		delim, ok := next().(json.Delim)
		if !ok {
			return nil
		}
		var found []string
		for dec.More() {
			if delim == '[' {
				walk(nil)
				continue
			}
			key := next().(string)
			switch {
			case len(path) == 0:
				found = append(found, key)
				walk(nil)
			case key == path[0]:
				found = walk(path[1:])
			default:
				walk(nil)
			}
		}
		next()
		return found
	}
	return walk(path)
}

// Whether the shared compiler this port is built against writes a spec in
// TypeScript's order and its matchers as TypeScript writes them, as
// tabnas/bnf#114 does. Rows 1 and 4 are its Go serializer's, and close
// together when it does: so their pins follow the compiler, asserting this
// port's spelling while the serializer writes the match tokens' order as a
// list of its own, and TypeScript's once it writes none. Each repository
// tests the other at its default branch, so the fix in tabnas-bnf can be
// tested against this suite before it lands. When go/go.mod takes the bnf
// release that carries it, delete rows 1 and 4 and their pins.
func writesTypeScriptsSpelling(t *testing.T) bool {
	t.Helper()
	options, _ := hostSpec(t, `root ::= [a-z] [0-9]`)["options"].(map[string]any)
	match, _ := options["match"].(map[string]any)
	_, listed := match["tokenOrder"]
	return !listed
}

func matchTokens(t *testing.T, tree map[string]any) map[string]any {
	t.Helper()
	options, _ := tree["options"].(map[string]any)
	match, _ := options["match"].(map[string]any)
	tokens, _ := match["token"].(map[string]any)
	return tokens
}

// Row 1. TypeScript writes the compiler's order, the grammar's rules and
// then its tokens, and no tokenOrder: [a-z]'s token is allocated first,
// though its name sorts after [0-9]'s. The pin follows the compiler it is
// built against (writesTypeScriptsSpelling).
func TestDivergenceTheMatchTokensOrderIsAListOfItsOwn(t *testing.T) {
	text := hostText(t, `root ::= [a-z] [0-9]`)
	written := keyOrder(t, text, "options", "match", "token")
	if writesTypeScriptsSpelling(t) {
		if len(written) != 2 || written[0] != "#RX___X_61___X_7A" || written[1] != "#RX___X_30___X_39" {
			t.Errorf("the shared compiler writes no tokenOrder, yet the match tokens are "+
				"written %v, not in the order it allocated them; when go/go.mod takes the "+
				"bnf release that writes TypeScript's order, delete DIVERGENCE.md 7's first row", written)
		}
		return
	}
	var tree map[string]any
	if err := json.Unmarshal([]byte(text), &tree); err != nil {
		t.Fatal(err)
	}
	options, _ := tree["options"].(map[string]any)
	match, _ := options["match"].(map[string]any)
	order, ok := match["tokenOrder"].([]any)
	if !ok || len(order) != 2 || order[0] != "#RX___X_61___X_7A" || order[1] != "#RX___X_30___X_39" ||
		len(written) != 2 || written[0] != "#RX___X_30___X_39" {
		t.Errorf("this port writes the match tokens in name order, %v, and their order as "+
			"tokenOrder, and wrote %v; if it no longer does, delete DIVERGENCE.md 7's first row",
			written, match["tokenOrder"])
	}
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

// Row 4. TypeScript writes `@~/^[^\u0061]/u` and
// `@~/^[\u{1f600}-\u{1f64f}]/u`. The pin follows the compiler it is built
// against (writesTypeScriptsSpelling).
func TestDivergenceAClassLosesItsUFlag(t *testing.T) {
	typeScripts := writesTypeScriptsSpelling(t)
	for src, want := range map[string][2]string{
		// this port's spelling, then TypeScript's
		`root ::= [^a]`:                    {`@~/^[^\u0061]/`, `@~/^[^\u0061]/u`},
		`root ::= [\U0001F600-\U0001F64F]`: {`@~/^[\u1f600-\u1f64f]/`, `@~/^[\u{1f600}-\u{1f64f}]/u`},
	} {
		tokens := matchTokens(t, hostSpec(t, src))
		expect := want[0]
		if typeScripts {
			expect = want[1]
		}
		found := false
		for _, got := range tokens {
			found = found || got == expect
		}
		if !found || len(tokens) != 1 {
			if typeScripts {
				t.Errorf("%s: the shared compiler writes the match tokens' order as "+
					"TypeScript does, yet this class is written %v, not %s; when go/go.mod "+
					"takes the bnf release that writes TypeScript's spelling, delete "+
					"DIVERGENCE.md 7's fourth row", src, tokens, expect)
			} else {
				t.Errorf("%s: this port writes %s, and wrote %v; if it writes TypeScript's, "+
					"delete DIVERGENCE.md 7's fourth row", src, expect, tokens)
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
