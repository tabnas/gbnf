// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// The canonical TypeScript, recorded. rs/tests/oracle/gbnf-oracle.json
// holds what ts/dist answered for 222 GBNF sources: every construct the
// notation has, every refusal, the eight llama.cpp grammars of
// test/corpus/ and the 77 schema-generated ones of test/live/
// (rs/tests/oracle/gen-oracle.js writes it). This port is held to it part
// by part. A source TypeScript refuses is refused here, and for every
// other source these agree with TypeScript's:
//
//   - the match tokens, each by the characters it matches, whether it
//     folds case, and its place in the order the lexer tries them;
//   - the fixed tokens, name and text;
//   - lex.empty, the token sets, the other options and the provenance;
//   - every rule's definition, its open and close alternates in full: the
//     tokens each names, what it pushes, replaces or leaves unconsumed,
//     its conditions and counters, and the tree builders it runs.
//
// The rule definitions, the token sets, the other options and the
// provenance are compared as digests of a canonical text of the
// pure-data spec a host reads, which gen-oracle.js records for
// TypeScript and purePartsOf below computes the same way for this port
// (the generator's `--canon NAME` prints TypeScript's texts, to read
// beside the text a failure here prints). The fixed tokens and the match
// tokens are compared as written.
//
// What is set aside is exactly what DIVERGENCE.md records, each by the
// row that excuses it, so a difference no row names fails:
//
//   - entry 1: the four sources whose TypeScript answer holds a lone
//     surrogate, which JSON cannot carry, and `root ::= "\uD83D\uDE00"`,
//     whose fixed token is held to the two U+FFFD the entry records;
//   - entry 7, row 1: key order, which the canonical text sorts, and
//     tokenOrder, which is held to TypeScript's match token order;
//   - row 2: a class token's name, compared by the characters it matches,
//     and a token set's, compared by its members;
//   - row 3: the eager flag, held to what the row records, that this port
//     flags every class eager;
//   - row 4: the u flag, and the text the serializer writes for a
//     pattern, since the pattern this port compiles is what is compared;
//   - row 5: the order within a run of adjacent alternates alike in
//     everything but the token they name, which is compared as a set.
//
// A row that closes takes its exemption with it: change the comparison
// here, and the canonical text in gen-oracle.js with it.
//
// It was written after this port compiled every literal holding a letter
// to a case-folding match token, where TypeScript writes the fixed token
// an exact match needs (`root ::= "b"` accepted "B"). Each of these was
// checked to fail it: a literal decoded to another fixed token, a field of
// an alternate changed, two alternates unlike each other swapped, a
// negated class lexed as its members, and the run normalisation dropped.
package gbnf

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
	"unicode/utf16"

	bnf "github.com/tabnas/bnf/go"
	tabnas "github.com/tabnas/parser/go"
)

type oracleEntry struct {
	Name            string          `json:"name"`
	Src             string          `json:"src"`
	MatchTokens     []oracleToken   `json:"matchTokens"`
	LexEmpty        *bool           `json:"lexEmpty"`
	RuleNames       []string        `json:"ruleNames"`
	Pure            *oraclePure     `json:"pure"`
	ParseError      json.RawMessage `json:"parseError"`
	CompileError    json.RawMessage `json:"compileError"`
	Unrepresentable string          `json:"unrepresentable"`
}

type oracleToken struct {
	Name   string `json:"name"`
	Source string `json:"source"`
	Flags  string `json:"flags"`
	Eager  bool   `json:"eager"`
}

// What gen-oracle.js records of TypeScript's pure-data spec: the fixed
// tokens as written, and digests of the canonical text of the rest, one
// per rule in the order of ruleNames.
type oraclePure struct {
	Fixed     map[string]string `json:"fixed"`
	Rest      string            `json:"rest"`
	TokenSets string            `json:"tokenSets"`
	Meta      string            `json:"meta"`
	Rules     []string          `json:"rules"`
}

// DIVERGENCE.md 1, the Go column: a pair of surrogate escapes is one
// character to TypeScript and two U+FFFD here. The source's fixed tokens
// are held to what the entry records for this port.
var surrogatePairFixed = map[string]map[string]string{
	`root ::= "\uD83D\uDE00"`: {"#T": "\ufffd\ufffd"},
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
			for _, problem := range oracleDifferences(e) {
				t.Errorf("%s: %s", e.Name, problem)
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

// oracleDifferences lists how the specs this port writes for one source
// differ from what TypeScript wrote, apart from what DIVERGENCE.md records.
func oracleDifferences(e oracleEntry) []string {
	spec, err := Gbnf(e.Src, nil)
	if err != nil {
		return []string{fmt.Sprintf("TypeScript compiles %q, and this port refuses it: %v", e.Src, err)}
	}
	_, out := classTokenNames(spec, e.MatchTokens)

	wantEmpty := e.LexEmpty != nil && *e.LexEmpty
	gotEmpty := spec.Options.Lex != nil && spec.Options.Lex.Empty != nil && *spec.Options.Lex.Empty
	if wantEmpty != gotEmpty {
		out = append(out, fmt.Sprintf("lex.empty is %v, and TypeScript's is %v", gotEmpty, wantEmpty))
	}
	names := make([]string, 0, len(spec.Rule))
	for name := range spec.Rule {
		names = append(names, name)
	}
	wantNames := append([]string(nil), e.RuleNames...)
	sort.Strings(names)
	sort.Strings(wantNames)
	if strings.Join(names, " ") != strings.Join(wantNames, " ") {
		out = append(out, fmt.Sprintf("the rules differ from TypeScript's\n  want %v\n  got  %v", wantNames, names))
	}

	if e.Pure == nil {
		return append(out, "the oracle records no pure-data spec for it: regenerate it with gen-oracle.js")
	}
	return append(out, pureDifferences(e)...)
}

// classTokenNames maps each match token of the spec to the TypeScript
// token that matches the same characters, and lists what is not as
// TypeScript has it. A token's name is the dialect's (row 2) and its u
// flag TypeScript's alone (row 4); whether it folds case is compared, and
// so is the order the lexer tries the tokens in, which this port writes as
// tokenOrder (row 1). Every match token here is eager (row 3).
func classTokenNames(spec *tabnas.GrammarSpec, want []oracleToken) (map[string]string, []string) {
	var out []string
	byKey := map[string]oracleToken{}
	for _, tok := range want {
		key := patternKey(tok.Source)
		if prior, ok := byKey[key]; ok {
			out = append(out, fmt.Sprintf("TypeScript's match tokens %s and %s match the same characters", prior.Name, tok.Name))
		}
		byKey[key] = tok
	}
	rename := map[string]string{}
	taken := map[string]string{}
	match := spec.Options.Match
	if match != nil {
		goNames := make([]string, 0, len(match.Token))
		for name := range match.Token {
			goNames = append(goNames, name)
		}
		sort.Strings(goNames)
		for _, name := range goNames {
			source := match.Token[name].String()
			folds := strings.HasPrefix(source, "(?i)")
			tok, ok := byKey[patternKey(strings.TrimPrefix(source, "(?i)"))]
			if !ok {
				out = append(out, fmt.Sprintf("the match token %s, %s, matches characters no TypeScript match token does", name, source))
				continue
			}
			if prior, ok := taken[tok.Name]; ok {
				out = append(out, fmt.Sprintf("the match tokens %s and %s both match the characters of TypeScript's %s", prior, name, tok.Name))
			}
			taken[tok.Name] = name
			rename[name] = tok.Name
			if folds != strings.Contains(tok.Flags, "i") {
				out = append(out, fmt.Sprintf("the match token %s folds case: %v, and TypeScript's %s: %v", name, folds, tok.Name, !folds))
			}
			if !match.TokenEager[name] {
				out = append(out, fmt.Sprintf("the match token %s is not eager, where DIVERGENCE.md 7 row 3 records every class here eager", name))
			}
		}
	}
	if len(rename) != len(want) {
		out = append(out, fmt.Sprintf("TypeScript writes %d match tokens, and %d of this port's match them", len(want), len(rename)))
	}
	var order, wantOrder []string
	if match != nil {
		for _, name := range match.TokenOrder {
			if renamed, ok := rename[name]; ok {
				name = renamed
			}
			order = append(order, name)
		}
	}
	for _, tok := range want {
		wantOrder = append(wantOrder, tok.Name)
	}
	if strings.Join(order, " ") != strings.Join(wantOrder, " ") {
		out = append(out, fmt.Sprintf("the match tokens are tried in another order than TypeScript's\n  want %v\n  got  %v", wantOrder, order))
	}
	return rename, out
}

// pureDifferences compares the pure-data spec this port writes, the tree a
// host reads, with what gen-oracle.js recorded of TypeScript's.
func pureDifferences(e oracleEntry) []string {
	spec, err := Gbnf(e.Src, &ConvertOptions{Builtins: true})
	if err != nil {
		return []string{fmt.Sprintf("this port refuses it with builtins: %v", err)}
	}
	rename, out := classTokenNames(spec, e.MatchTokens)
	pure, err := bnf.ToPureSpec(spec)
	if err != nil {
		return append(out, fmt.Sprintf("this port writes no pure-data spec for it: %v", err))
	}
	decoder := json.NewDecoder(strings.NewReader(bnf.ToJsonic(pure, true, 0)))
	decoder.UseNumber()
	var tree map[string]any
	if err := decoder.Decode(&tree); err != nil {
		return append(out, fmt.Sprintf("the pure-data spec this port writes is not JSON: %v", err))
	}
	parts, err := purePartsOf(tree, func(name string) string {
		if renamed, ok := rename[name]; ok {
			return renamed
		}
		return name
	})
	if err != nil {
		return append(out, err.Error())
	}

	wantFixed := e.Pure.Fixed
	if recorded, ok := surrogatePairFixed[e.Src]; ok {
		wantFixed = recorded
	}
	if got, want := fmt.Sprint(parts.fixed), fmt.Sprint(wantFixed); got != want {
		out = append(out, fmt.Sprintf("the fixed tokens differ from TypeScript's\n  want %q\n  got  %q", wantFixed, parts.fixed))
	}
	for _, part := range []struct{ what, want, text string }{
		{"the options other than the tokens", e.Pure.Rest, parts.rest},
		{"the token sets", e.Pure.TokenSets, parts.tokenSets},
		{"the provenance", e.Pure.Meta, parts.meta},
	} {
		if got := digestOf(part.text); got != part.want {
			out = append(out, fmt.Sprintf("%s differ from TypeScript's (digest %s, not %s); this port's canonical text is %s", part.what, got, part.want, part.text))
		}
	}

	if len(e.Pure.Rules) != len(e.RuleNames) {
		return append(out, "the oracle records a digest for other rules than it names: regenerate it with gen-oracle.js")
	}
	want := map[string]string{}
	for i, name := range e.RuleNames {
		want[name] = e.Pure.Rules[i]
	}
	differ := 0
	for _, rule := range parts.rules {
		digest, ok := want[rule.name]
		if !ok {
			continue // named above, with the rules TypeScript writes
		}
		if got := digestOf(rule.text); got != digest {
			differ++
			if differ <= 5 {
				out = append(out, fmt.Sprintf("the rule %s differs from TypeScript's (digest %s, not %s); this port's canonical text is %s", rule.name, got, digest, rule.text))
			}
		}
	}
	if 5 < differ {
		out = append(out, fmt.Sprintf("and %d more rules differ from TypeScript's", differ-5))
	}
	return out
}

// ---- The canonical text ------------------------------------------------
//
// The same text gen-oracle.js digests, taken after the normalisations
// DIVERGENCE.md 7 records: keys sorted (row 1), a token set written as its
// members wherever a rule names it and the sets as a sorted list of those,
// with every class token under the name of the TypeScript token that
// matches the same characters (row 2), and each maximal run of adjacent
// alternates alike in everything but `s` sorted (row 5). Keep it in step
// with pureParts there.

type pureParts struct {
	fixed     map[string]string
	rest      string
	tokenSets string
	meta      string
	rules     []canonRule
}

type canonRule struct{ name, text string }

func purePartsOf(spec map[string]any, rename func(string) string) (*pureParts, error) {
	options, _ := spec["options"].(map[string]any)
	sets, _ := options["tokenSet"].(map[string]any)
	isSet := func(name string) bool {
		_, ok := sets[name]
		return ok && name != "IGNORE"
	}
	setMembers := func(name string) []string {
		list, _ := sets[name].([]any)
		out := make([]string, 0, len(list))
		for _, member := range list {
			text, _ := member.(string)
			out = append(out, rename(text))
		}
		sort.Strings(out)
		return out
	}
	members := func(name string) string {
		return "{" + strings.Join(setMembers(name), ",") + "}"
	}
	token := func(t string) string {
		if strings.HasPrefix(t, "#") && isSet(t[1:]) {
			return members(t[1:])
		}
		return rename(t)
	}
	var names func(value any, key string) any
	names = func(value any, key string) any {
		switch x := value.(type) {
		case []any:
			out := make([]any, len(x))
			for i, item := range x {
				out[i] = names(item, "")
			}
			return out
		case map[string]any:
			out := map[string]any{}
			for k, item := range x {
				out[k] = names(item, k)
			}
			return out
		case string:
			if key == "s" {
				parts := strings.Split(x, " ")
				for i := range parts {
					parts[i] = token(parts[i])
				}
				return strings.Join(parts, " ")
			}
			return token(x)
		}
		return value
	}
	runs := func(alts []any) ([]any, error) {
		var out, run []any
		var runShape string
		flush := func() error {
			texts := make([]string, len(run))
			byText := map[string]any{}
			for i, alt := range run {
				text, err := canonText(alt)
				if err != nil {
					return err
				}
				texts[i] = text
				byText[text] = alt
			}
			sort.Strings(texts)
			for _, text := range texts {
				out = append(out, byText[text])
			}
			run = nil
			return nil
		}
		for _, alt := range alts {
			fields, _ := alt.(map[string]any)
			_, named := fields["s"]
			shape := ""
			if named {
				rest := map[string]any{}
				for k, v := range fields {
					if k != "s" {
						rest[k] = v
					}
				}
				text, err := canonText(rest)
				if err != nil {
					return nil, err
				}
				shape = text
			}
			if 0 < len(run) && !(named && shape == runShape) {
				if err := flush(); err != nil {
					return nil, err
				}
			}
			if named {
				if len(run) == 0 {
					runShape = shape
				}
				run = append(run, alt)
			} else {
				out = append(out, alt)
			}
		}
		if err := flush(); err != nil {
			return nil, err
		}
		if out == nil {
			out = []any{}
		}
		return out, nil
	}

	parts := &pureParts{fixed: map[string]string{}}
	if fixed, ok := options["fixed"].(map[string]any); ok {
		if tokens, ok := fixed["token"].(map[string]any); ok {
			for name, text := range tokens {
				parts.fixed[name], _ = text.(string)
			}
		}
	}

	rest := copyJSON(options).(map[string]any)
	delete(rest, "tokenSet")
	if fixed, ok := rest["fixed"].(map[string]any); ok {
		delete(fixed, "token")
		if len(fixed) == 0 {
			delete(rest, "fixed")
		}
	}
	if match, ok := rest["match"].(map[string]any); ok {
		delete(match, "token")
		delete(match, "tokenOrder")
		if len(match) == 0 {
			delete(rest, "match")
		}
	}
	var err error
	if parts.rest, err = canonText(map[string]any{"options": rest, "v": spec["v"]}); err != nil {
		return nil, err
	}

	ignore := []any{}
	for _, name := range setMembers("IGNORE") {
		ignore = append(ignore, name)
	}
	others := []string{}
	for name := range sets {
		if isSet(name) {
			others = append(others, members(name))
		}
	}
	sort.Strings(others)
	otherSets := make([]any, len(others))
	for i, text := range others {
		otherSets[i] = text
	}
	if parts.tokenSets, err = canonText(map[string]any{"ignore": ignore, "sets": otherSets}); err != nil {
		return nil, err
	}
	if parts.meta, err = canonText(spec["meta"]); err != nil {
		return nil, err
	}

	rules, _ := spec["rule"].(map[string]any)
	ruleNames := make([]string, 0, len(rules))
	for name := range rules {
		ruleNames = append(ruleNames, name)
	}
	sort.Strings(ruleNames)
	for _, name := range ruleNames {
		def, _ := rules[name].(map[string]any)
		phases := map[string]any{}
		for _, phase := range []string{"open", "close"} {
			alts, _ := names(def[phase], "").([]any)
			ordered, err := runs(alts)
			if err != nil {
				return nil, err
			}
			phases[phase] = ordered
		}
		text, err := canonText(phases)
		if err != nil {
			return nil, err
		}
		parts.rules = append(parts.rules, canonRule{name, text})
	}
	return parts, nil
}

func copyJSON(value any) any {
	switch x := value.(type) {
	case []any:
		out := make([]any, len(x))
		for i, item := range x {
			out[i] = copyJSON(item)
		}
		return out
	case map[string]any:
		out := map[string]any{}
		for k, item := range x {
			out[k] = copyJSON(item)
		}
		return out
	}
	return value
}

// canonText writes JSON with its keys sorted, no space, every character
// outside printable ASCII as a UTF-16 escape, and integers the only
// numbers: gen-oracle.js's canonText.
func canonText(value any) (string, error) {
	var b strings.Builder
	if err := writeCanon(&b, value); err != nil {
		return "", err
	}
	return b.String(), nil
}

func writeCanon(b *strings.Builder, value any) error {
	switch x := value.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		b.WriteString(strconv.FormatBool(x))
	case json.Number:
		n, err := strconv.ParseInt(string(x), 10, 64)
		if err != nil {
			return fmt.Errorf("the pure-data spec holds a number that is not an integer: %s", x)
		}
		b.WriteString(strconv.FormatInt(n, 10))
	case string:
		writeQuoted(b, x)
	case []any:
		b.WriteByte('[')
		for i, item := range x {
			if 0 < i {
				b.WriteByte(',')
			}
			if err := writeCanon(b, item); err != nil {
				return err
			}
		}
		b.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(x))
		for k := range x {
			for _, r := range k {
				if r < 0x20 || 0x7e < r {
					return fmt.Errorf("the pure-data spec holds a key outside printable ASCII: %q", k)
				}
			}
			keys = append(keys, k)
		}
		sort.Strings(keys)
		b.WriteByte('{')
		for i, k := range keys {
			if 0 < i {
				b.WriteByte(',')
			}
			writeQuoted(b, k)
			b.WriteByte(':')
			if err := writeCanon(b, x[k]); err != nil {
				return err
			}
		}
		b.WriteByte('}')
	default:
		return fmt.Errorf("the pure-data spec holds a %T", value)
	}
	return nil
}

func writeQuoted(b *strings.Builder, text string) {
	b.WriteByte('"')
	for _, r := range text {
		switch {
		case r == '"' || r == '\\':
			b.WriteByte('\\')
			b.WriteRune(r)
		case r < 0x20 || 0x7e < r:
			if 0xffff < r {
				high, low := utf16.EncodeRune(r)
				writeUnit(b, high)
				writeUnit(b, low)
			} else {
				writeUnit(b, r)
			}
		default:
			b.WriteRune(r)
		}
	}
	b.WriteByte('"')
}

func writeUnit(b *strings.Builder, unit rune) {
	digits := strconv.FormatInt(int64(unit), 16)
	b.WriteString("\\u" + strings.Repeat("0", 4-len(digits)) + digits)
}

func digestOf(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])[:16]
}
