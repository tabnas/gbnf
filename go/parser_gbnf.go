// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// parser_gbnf.go — the GBNF front-end: llama.cpp GBNF text in, grammar
// IR out.
//
// Everything downstream of the IR belongs to github.com/tabnas/bnf/go
// and is shared with the ABNF and EBNF front-ends:
//
//	GBNF text --ParseGbnf--> bnf.Grammar --bnf.EmitGrammarSpec--> GrammarSpec
//
// The dialect is llama.cpp's `grammars/README.md`; ts/doc/known-gaps.md
// records where this front-end and llama.cpp's own parser diverge, and
// applies to this runtime equally.
//
// A DELIBERATE DIVERGENCE FROM THE TS FRONT-END, stated here rather than
// left to be found: the TypeScript parser expresses GBNF as a tabnas
// rule table and parses it with the engine. This one is hand-written
// recursive descent. The IR is the contract, and both implementations
// answer to the same accept/reject behaviour — but the mechanisms
// differ, so a defect in one will not automatically show up in the
// other. The same note applies to the EBNF Go port.
package gbnf

import (
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"

	bnf "github.com/tabnas/bnf/go"
)

// GBNF's escape vocabulary, exactly as llama.cpp defines it.
var simpleEscapes = map[byte]rune{
	't': '\t', 'r': '\r', 'n': '\n',
	'\\': '\\', '"': '"', '[': '[', ']': ']',
}

var hexEscapes = map[byte]int{'x': 2, 'u': 4, 'U': 8}

type parser struct {
	src  string
	i    int
	line int
	col  int
}

func newParser(src string) *parser {
	return &parser{src: src, line: 1, col: 1}
}

func (p *parser) eof() bool { return p.i >= len(p.src) }

func (p *parser) peek() byte {
	if p.eof() {
		return 0
	}
	return p.src[p.i]
}

func (p *parser) advance(n int) {
	for k := 0; k < n && !p.eof(); k++ {
		if p.src[p.i] == '\n' {
			p.line++
			p.col = 1
		} else {
			p.col++
		}
		p.i++
	}
}

func (p *parser) errf(format string, args ...any) *ParseError {
	return &ParseError{
		Message: fmt.Sprintf("gbnf: "+format, args...),
		Line:    p.line,
		Column:  p.col,
	}
}

// skipSpace consumes whitespace and `#` comments. Whitespace is exactly
// what llama.cpp's parse_space takes — space, tab, CR, LF — and NOT a
// wider Unicode notion, so this front-end cannot accept a grammar
// llama.cpp rejects.
func (p *parser) skipSpace() {
	for !p.eof() {
		c := p.peek()
		if c == ' ' || c == '\t' || c == '\r' || c == '\n' {
			p.advance(1)
			continue
		}
		if c == '#' {
			for !p.eof() && p.peek() != '\n' {
				p.advance(1)
			}
			continue
		}
		return
	}
}

// readChar reads one character — plain or escaped — starting at i within
// `whole`, returning the code point and the index just past it.
func (p *parser) readChar(whole string, i int) (rune, int, error) {
	if whole[i] != '\\' {
		r, size := utf8.DecodeRuneInString(whole[i:])
		return r, i + size, nil
	}
	if i+1 >= len(whole) {
		return 0, 0, p.errf("trailing backslash in terminal %s", whole)
	}
	mark := whole[i+1]
	if r, ok := simpleEscapes[mark]; ok {
		return r, i + 2, nil
	}
	if digits, ok := hexEscapes[mark]; ok {
		end := i + 2 + digits
		if end > len(whole) {
			end = len(whole)
		}
		hex := whole[i+2 : end]
		if len(hex) < digits || !allHex(hex) {
			return 0, 0, p.errf(
				"escape '\\%c' in terminal %s needs %d hex digits, found '%s'",
				mark, whole, digits, hex)
		}
		n, _ := strconv.ParseInt(hex, 16, 64)
		if n > 0x10FFFF {
			return 0, 0, p.errf(
				"escape '\\%c%s' in terminal %s is %d, which is not a Unicode "+
					"code point (the maximum is \\U0010FFFF)", mark, hex, whole, n)
		}
		return rune(n), i + 2 + digits, nil
	}
	return 0, 0, p.errf(
		"unknown escape '\\%c' in terminal %s. GBNF escapes are "+
			`\t \r \n \\ \" \[ \] \xXX \uXXXX \UXXXXXXXX`, mark, whole)
}

func allHex(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F') {
			return false
		}
	}
	return true
}

func classEscape(cp rune) string {
	// Go's RE2 spells a code point `\x{…}`; `\uXXXX` is the JavaScript
	// spelling and RE2 refuses to compile it. The shared compiler
	// converts `\x{…}` to `\uXXXX` when serialising for the other
	// runtime, so this is the right native form here.
	return "\\x{" + strconv.FormatInt(int64(cp), 16) + "}"
}

// decodeString turns a raw `"…"` literal into the string it denotes.
func (p *parser) decodeString(raw string) (string, error) {
	body := raw[1 : len(raw)-1]
	var b strings.Builder
	for i := 0; i < len(body); {
		cp, next, err := p.readChar(raw, i+1)
		if err != nil {
			return "", err
		}
		b.WriteRune(cp)
		i = next - 1
	}
	return b.String(), nil
}

// decodeCharClass lowers `[a-z]`, `[^\n]`, `[-+*/]` onto a regex
// element.
func (p *parser) decodeCharClass(raw string) (*bnf.Element, error) {
	i := 1
	end := len(raw) - 1
	negated := false
	if raw[i] == '^' {
		negated = true
		i++
	}

	var parts []string
	astral := false
	for i < end {
		lo, next, err := p.readChar(raw, i)
		if err != nil {
			return nil, err
		}
		i = next
		// A `-` immediately before the closing bracket is a literal
		// hyphen, not a range operator — llama.cpp checks `pos[1] != ']'`
		// the same way, which is what makes `[-+*/]` in its own
		// arithmetic.gbnf a four-member class rather than a syntax error.
		if i < end && raw[i] == '-' && i+1 < end {
			hi, next2, err := p.readChar(raw, i+1)
			if err != nil {
				return nil, err
			}
			i = next2
			if hi < lo {
				return nil, p.errf(
					"character class %s has a descending range (U+%04X to U+%04X)",
					raw, lo, hi)
			}
			if lo > 0xFFFF || hi > 0xFFFF {
				astral = true
			}
			parts = append(parts, classEscape(lo)+"-"+classEscape(hi))
			continue
		}
		if lo > 0xFFFF {
			astral = true
		}
		parts = append(parts, classEscape(lo))
	}

	if len(parts) == 0 {
		return nil, p.errf("empty character class %s matches nothing", raw)
	}

	neg := ""
	if negated {
		neg = "^"
	}
	// Unicode mode is decided by what the matcher can MATCH, not by what
	// was written: a negated class matches the complement of its members,
	// and that complement always contains every astral code point.
	flags := ""
	if negated || astral {
		flags = "u"
	}
	return &bnf.Element{
		Kind:    bnf.KindRegex,
		Pattern: "[" + neg + strings.Join(parts, "") + "]",
		Flags:   flags,
	}, nil
}

// ---- Recursive descent ---------------------------------------------

func isNameByte(c byte) bool {
	// llama.cpp's is_word_char is [A-Za-z0-9_-], so a name may start with
	// a digit or a dash — japanese.gbnf uses `jp-char`.
	return c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' ||
		c >= '0' && c <= '9' || c == '_' || c == '-'
}

func (p *parser) parseAtom() (*bnf.Element, error) {
	p.skipSpace()
	if p.eof() {
		return nil, p.errf("expected an expression")
	}
	switch c := p.peek(); {
	case c == '"':
		start := p.i
		p.advance(1)
		for !p.eof() {
			if p.peek() == '\\' {
				p.advance(2)
				continue
			}
			if p.peek() == '"' {
				break
			}
			p.advance(1)
		}
		if p.eof() {
			return nil, p.errf("unterminated string literal")
		}
		p.advance(1)
		raw := p.src[start:p.i]
		lit, err := p.decodeString(raw)
		if err != nil {
			return nil, err
		}
		if lit == "" {
			// `""` denotes zero characters, so it contributes no element.
			return nil, nil
		}
		// GBNF literals are case-SENSITIVE — the opposite of RFC 5234.
		return &bnf.Element{
			Kind: bnf.KindTerm, Literal: lit,
			CaseSensitive: true, HasCaseSens: true,
		}, nil

	case c == '[':
		start := p.i
		p.advance(1)
		for !p.eof() {
			if p.peek() == '\\' {
				p.advance(2)
				continue
			}
			if p.peek() == ']' {
				break
			}
			p.advance(1)
		}
		if p.eof() {
			return nil, p.errf("unterminated character class")
		}
		p.advance(1)
		return p.decodeCharClass(p.src[start:p.i])

	case c == '.':
		p.advance(1)
		// LLAMA_GRETYPE_CHAR_ANY: any single character, newlines
		// included. `[\s\S]` says that without needing the `s` flag
		// (which RE2 spells differently); `u` makes "one character" mean
		// one code point rather than one UTF-16 unit.
		return &bnf.Element{
			Kind: bnf.KindRegex, Pattern: `[\s\S]`, Flags: "u",
		}, nil

	case c == '(':
		p.advance(1)
		alts, err := p.parseAlts()
		if err != nil {
			return nil, err
		}
		p.skipSpace()
		if p.peek() != ')' {
			return nil, p.errf("unclosed group '('")
		}
		p.advance(1)
		return &bnf.Element{Kind: bnf.KindGroup, Alts: alts}, nil

	case c == '<' || c == '!':
		// Tokenizer-token terminals: `<think>`, `!</think>`, `<[1000]>`.
		// Parsed so a grammar containing one is not a *syntax* error, then
		// refused by name — see rejectTokenTerminals.
		start := p.i
		if c == '!' {
			p.advance(1)
		}
		if p.peek() != '<' {
			return nil, p.errf("unexpected %q", string(c))
		}
		for !p.eof() && p.peek() != '>' {
			p.advance(1)
		}
		if p.eof() {
			return nil, p.errf("unterminated tokenizer-token terminal")
		}
		p.advance(1)
		return &bnf.Element{Kind: bnf.KindProse, Text: p.src[start:p.i]}, nil

	default:
		start := p.i
		for !p.eof() && isNameByte(p.peek()) {
			p.advance(1)
		}
		if p.i == start {
			return nil, p.errf("unexpected %q", string(c))
		}
		return &bnf.Element{Kind: bnf.KindRef, Name: p.src[start:p.i]}, nil
	}
}

// parsePostfix applies a run of postfix operators left to right, so
// `x*?` is `(x*)?` — the same order llama.cpp's sequence loop uses.
func (p *parser) parsePostfix(el *bnf.Element) (*bnf.Element, error) {
	for {
		if p.eof() {
			return el, nil
		}
		switch p.peek() {
		case '*':
			p.advance(1)
			el = &bnf.Element{Kind: bnf.KindStar, Inner: el}
		case '+':
			p.advance(1)
			el = &bnf.Element{Kind: bnf.KindPlus, Inner: el}
		case '?':
			p.advance(1)
			el = &bnf.Element{Kind: bnf.KindOpt, Inner: el}
		case '{':
			min, max, err := p.parseRepBraces()
			if err != nil {
				return nil, err
			}
			el = &bnf.Element{Kind: bnf.KindRep, Min: min, Max: max, Inner: el}
		default:
			return el, nil
		}
	}
}

// parseRepBraces reads `{m}`, `{m,}` or `{m,n}`. Whitespace inside is
// llama.cpp-legal (parse_space runs after each operator) but ONLY the
// ASCII set it defines.
func (p *parser) parseRepBraces() (int, int, error) {
	p.advance(1) // `{`
	readNum := func() (int, bool) {
		p.skipRepSpace()
		start := p.i
		for !p.eof() && p.peek() >= '0' && p.peek() <= '9' {
			p.advance(1)
		}
		if p.i == start {
			return 0, false
		}
		n, _ := strconv.Atoi(p.src[start:p.i])
		return n, true
	}
	lo, ok := readNum()
	if !ok {
		return 0, 0, p.errf("repetition '{' needs a count")
	}
	p.skipRepSpace()
	hi := lo
	if p.peek() == ',' {
		p.advance(1)
		if n, ok := readNum(); ok {
			hi = n
		} else {
			hi = bnf.MaxInfinity
		}
		p.skipRepSpace()
	}
	if p.peek() != '}' {
		return 0, 0, p.errf("unclosed repetition '{'")
	}
	p.advance(1)
	return lo, hi, nil
}

// skipRepSpace is parse_space, exactly: space, tab, CR, LF. NOT a wider
// Unicode notion of whitespace, which would make this front-end accept
// grammars llama.cpp rejects.
func (p *parser) skipRepSpace() {
	for !p.eof() {
		switch p.peek() {
		case ' ', '\t', '\r', '\n':
			p.advance(1)
		default:
			return
		}
	}
}

func (p *parser) atSeqEnd() bool {
	if p.eof() {
		return true
	}
	switch p.peek() {
	case '|', ')':
		return true
	}
	// A new rule starts here: NAME followed by `::=`.
	save := *p
	defer func() { *p = save }()
	start := p.i
	for !p.eof() && isNameByte(p.peek()) {
		p.advance(1)
	}
	if p.i == start {
		return false
	}
	p.skipSpace()
	return strings.HasPrefix(p.src[p.i:], "::=")
}

func (p *parser) parseSeq() (bnf.Sequence, error) {
	// An EMPTY sequence is legal GBNF — llama.cpp's own json.gbnf writes
	// optional whitespace as `ws ::= | " " | "\n"`. So unlike the EBNF
	// front-end, this one must NOT refuse it.
	seq := bnf.Sequence{}
	for {
		p.skipSpace()
		if p.atSeqEnd() {
			return seq, nil
		}
		el, err := p.parseAtom()
		if err != nil {
			return nil, err
		}
		if el == nil {
			// `""` contributed nothing; postfix on it is meaningless too.
			continue
		}
		el, err = p.parsePostfix(el)
		if err != nil {
			return nil, err
		}
		seq = append(seq, el)
	}
}

func (p *parser) parseAlts() ([]bnf.Sequence, error) {
	var alts []bnf.Sequence
	for {
		seq, err := p.parseSeq()
		if err != nil {
			return nil, err
		}
		alts = append(alts, seq)
		p.skipSpace()
		if p.peek() != '|' {
			return alts, nil
		}
		p.advance(1)
	}
}

// ---- Grammar-level parse and validation ----------------------------

// ParseGbnf reads GBNF source into the shared grammar IR.
func ParseGbnf(src string) (*bnf.Grammar, error) {
	p := newParser(src)
	var prods []*bnf.Production

	for {
		p.skipSpace()
		if p.eof() {
			break
		}
		start := p.i
		for !p.eof() && isNameByte(p.peek()) {
			p.advance(1)
		}
		if p.i == start {
			return nil, p.errf("expected a rule name")
		}
		name := p.src[start:p.i]
		p.skipSpace()
		if !strings.HasPrefix(p.src[p.i:], "::=") {
			return nil, p.errf("expected '::=' after rule name '%s'", name)
		}
		p.advance(3)
		alts, err := p.parseAlts()
		if err != nil {
			return nil, err
		}
		prods = append(prods, &bnf.Production{Name: name, Alts: alts})
	}

	if len(prods) == 0 {
		return nil, &ParseError{Message: "gbnf: grammar defines no rules"}
	}
	prods = dedupeProductions(prods)
	if err := rejectTokenTerminals(prods); err != nil {
		return nil, err
	}
	if err := requireRoot(prods); err != nil {
		return nil, err
	}
	if err := requireDefinedRefs(prods); err != nil {
		return nil, err
	}
	return &bnf.Grammar{Productions: prods}, nil
}

// GBNF has no `=/`; llama.cpp stores rules in a map, so a second
// definition REPLACES the first rather than extending it.
func dedupeProductions(prods []*bnf.Production) []*bnf.Production {
	last := map[string]*bnf.Production{}
	var order []string
	for _, p := range prods {
		if _, seen := last[p.Name]; !seen {
			order = append(order, p.Name)
		}
		last[p.Name] = p
	}
	out := make([]*bnf.Production, 0, len(order))
	for _, n := range order {
		out = append(out, last[n])
	}
	return out
}

// Tokenizer-token terminals match entries of a sampler's VOCABULARY, not
// characters. Which text they cover is decided by the model's tokenizer,
// so the same grammar means different things on different models, and a
// text parser has no tokenizer at all. Both available approximations
// silently change the accepted language, which is the one failure mode
// an offline validator must not have — so they are refused by name.
func rejectTokenTerminals(prods []*bnf.Production) error {
	var walk func(el *bnf.Element, rule string) error
	walk = func(el *bnf.Element, rule string) error {
		switch el.Kind {
		case bnf.KindProse:
			return &CompileError{Message: fmt.Sprintf(
				"gbnf: rule '%s' uses the tokenizer-token terminal '%s'. These "+
					"match a sampler's vocabulary entries rather than characters, "+
					"so they have no meaning for a text parser and are not "+
					"compiled.", rule, el.Text)}
		case bnf.KindGroup:
			for _, a := range el.Alts {
				for _, e := range a {
					if err := walk(e, rule); err != nil {
						return err
					}
				}
			}
		case bnf.KindOpt, bnf.KindStar, bnf.KindPlus, bnf.KindRep:
			return walk(el.Inner, rule)
		}
		return nil
	}
	for _, p := range prods {
		for _, a := range p.Alts {
			for _, e := range a {
				if err := walk(e, p.Name); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// GBNF mandates a rule named `root`; llama.cpp starts there.
func requireRoot(prods []*bnf.Production) error {
	for _, p := range prods {
		if p.Name == "root" {
			return nil
		}
	}
	return &ParseError{Message: "gbnf: grammar has no 'root' rule; GBNF " +
		"starts at 'root', so one must be defined"}
}

func requireDefinedRefs(prods []*bnf.Production) error {
	defined := map[string]bool{}
	for _, p := range prods {
		defined[p.Name] = true
	}
	var walk func(el *bnf.Element, rule string) error
	walk = func(el *bnf.Element, rule string) error {
		switch el.Kind {
		case bnf.KindRef:
			if !defined[el.Name] {
				return &CompileError{Message: fmt.Sprintf(
					"gbnf: rule '%s' references unknown rule '%s'", rule, el.Name)}
			}
		case bnf.KindGroup:
			for _, a := range el.Alts {
				for _, e := range a {
					if err := walk(e, rule); err != nil {
						return err
					}
				}
			}
		case bnf.KindOpt, bnf.KindStar, bnf.KindPlus, bnf.KindRep:
			return walk(el.Inner, rule)
		}
		return nil
	}
	for _, p := range prods {
		for _, a := range p.Alts {
			for _, e := range a {
				if err := walk(e, p.Name); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// derivesEmpty reports whether the start rule can derive the empty
// string. Walked over the parsed IR — before the compiler desugars it —
// because the IR still says star/opt/rep outright, where the emitted
// spec has already turned them into mutually-referring helpers.
//
// The `seen` set makes a recursive rule terminate; a rule already on the
// stack contributes nothing new, so treating it as non-nullable is both
// safe and the least-fixed-point answer.
func derivesEmpty(g *bnf.Grammar, start string) bool {
	byName := map[string]*bnf.Production{}
	for _, p := range g.Productions {
		byName[p.Name] = p
	}
	seen := map[string]bool{}

	var elEmpty func(el *bnf.Element) bool
	var ruleEmpty func(name string) bool

	elEmpty = func(el *bnf.Element) bool {
		switch el.Kind {
		case bnf.KindOpt, bnf.KindStar:
			return true
		case bnf.KindRep:
			return el.Min == 0
		case bnf.KindPlus:
			return elEmpty(el.Inner)
		case bnf.KindGroup:
			for _, a := range el.Alts {
				if seqEmpty(a, elEmpty) {
					return true
				}
			}
			return false
		case bnf.KindRef:
			return ruleEmpty(el.Name)
		}
		return false
	}

	ruleEmpty = func(name string) bool {
		if seen[name] {
			return false
		}
		seen[name] = true
		defer delete(seen, name)
		p := byName[name]
		if p == nil {
			return false
		}
		for _, a := range p.Alts {
			if seqEmpty(a, elEmpty) {
				return true
			}
		}
		return false
	}

	return ruleEmpty(start)
}

func seqEmpty(a bnf.Sequence, elEmpty func(*bnf.Element) bool) bool {
	for _, el := range a {
		if !elEmpty(el) {
			return false
		}
	}
	return true
}
