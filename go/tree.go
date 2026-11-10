// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

package gbnf

// tree.go — a GBNF document read as the schema grammar-rules: its rules
// as the text writes them, uncompiled and in source order (tabnas/bnf's
// docs/grammar-rules.md, and section 13.1 of alchemy's
// docs/streaming-plan.md). The Go port of ts/src/tree.ts: the tree a host
// translates, whose events the part, alchemy/transduce.alc, makes from the
// rule passes of Make().
//
// The tree parser reads GBNF with the meta-grammar defineGbnfRules
// installs, its lexer and every alternate as they are, and actions of its
// own (treeActs below) in place of the ones that build the compiler's IR,
// so the rule passes a part reads are the meta-grammar's. A token whose
// text needs reading (a string, a class, a tokenizer terminal, a run of
// postfix operators) is given what it reads as its value by the action
// that reads it, since a part reads a token's value and never the work an
// action does with it. Objects are *tabnas.OrderedMap, so that their
// members keep the schema's order; numbers are float64.
//
// GBNF starts from the rule named root, wherever the text defines it, so
// the grammar's start is "root", before any rule.
//
// The tree holds what the schema allows, so the parser refuses what it
// cannot hold, each with a code of its own: an escape GBNF does not have,
// one past U+10FFFF, or, in a string, half of a surrogate pair standing
// alone (gbnf_escape), a class range that ends below where it starts
// (gbnf_class_range), an empty class (gbnf_empty_class), a repetition
// whose most is below its least (gbnf_reversed_repetition), a count past
// 2^53 - 1 (gbnf_count) and a group left open (gbnf_unclosed).

import (
	"strconv"
	"strings"
	"unicode/utf16"

	tabnas "github.com/tabnas/parser/go"
)

// maxCount is the largest repetition count the tree holds exactly: 2^53 - 1.
const maxCount = 9007199254740991

// treeOptions is the codes the tree parser refuses a source with, beside
// the engine's: the Error and Hint options Make gives the parser.
var treeOptions = tabnas.Options{
	Error: map[string]string{
		"gbnf_escape":              "the terminal {src} holds an escape GBNF does not have, or one that names no character",
		"gbnf_class_range":         "the character class {src} has a range that ends below where it starts",
		"gbnf_empty_class":         "the character class {src} is empty, and matches nothing",
		"gbnf_reversed_repetition": "the repetition {src} allows fewer than it requires: its most is below its least",
		"gbnf_count":               "a repetition count in {src} is past 9007199254740991, the largest whole number the tree holds",
		"gbnf_unclosed":            "a group is not closed",
	},
	Hint: map[string]string{
		"gbnf_escape":              `GBNF escapes are \t \r \n \\ \" \[ \] \- \xXX \uXXXX \UXXXXXXXX, naming a code point up to \U0010FFFF, and a surrogate in a string is half of a pair, \uD83D\uDE00.`,
		"gbnf_class_range":         "Write a range from its lower end to its higher, as [a-z].",
		"gbnf_empty_class":         "A class holds a character or a range at least.",
		"gbnf_reversed_repetition": "In {m,n} the n is the most and the m the least, so n is not below m.",
		"gbnf_count":               "A repetition count is a whole number no larger than 9007199254740991.",
		"gbnf_unclosed":            "Close the group with ).",
	},
}

// treeObject is an object of the tree, its members in the order given.
func treeObject(kv ...any) *tabnas.OrderedMap {
	m := tabnas.NewOrderedMap()
	for i := 0; i+1 < len(kv); i += 2 {
		m.Set(kv[i].(string), kv[i+1])
	}
	return m
}

// copyObject is a shallow copy of an object of the tree.
func copyObject(m *tabnas.OrderedMap) *tabnas.OrderedMap {
	out := tabnas.NewOrderedMap()
	for _, k := range m.Keys {
		out.Set(k, m.Vals[k])
	}
	return out
}

// treeList is a list a rule builds, held by pointer so that a child rule,
// which inherits the node, appends to its parent's.
type treeList = []any

// listOf reads the list a child rule built.
func listOf(r *tabnas.Rule) (treeList, bool) {
	if r == nil || r == tabnas.NoRule {
		return nil, false
	}
	p, ok := r.Node.(*treeList)
	if !ok {
		return nil, false
	}
	return append(treeList{}, (*p)...), true
}

// isSurrogate is whether cp is either half of a UTF-16 surrogate pair.
func isSurrogate(cp rune) bool { return 0xD800 <= cp && cp <= 0xDFFF }

// stringText is a string's text, the characters its escapes name, or the
// code it is refused with. Its code points are read as one UTF-16
// sequence, as the canonical runtime reads them, so that two escapes
// naming a surrogate pair's halves are the character the pair encodes;
// a half standing alone names no character.
func stringText(raw string) (string, string) {
	var units []uint16
	for i := 1; i < len(raw)-1; {
		cp, next, err := readChar(raw, i)
		if err != nil {
			return "", "gbnf_escape"
		}
		if isSurrogate(cp) {
			units = append(units, uint16(cp))
		} else {
			units = utf16.AppendRune(units, cp)
		}
		i = next
	}
	for i := 0; i < len(units); i++ {
		if !isSurrogate(rune(units[i])) {
			continue
		}
		if units[i] < 0xDC00 && i+1 < len(units) && 0xDC00 <= units[i+1] && units[i+1] <= 0xDFFF {
			i++
			continue
		}
		return "", "gbnf_escape"
	}
	return string(utf16.Decode(units)), ""
}

// classValue is a class's negation and members, read as the IR parser
// reads them (`^` first negates it, `a-b` is a range, and a `-` before the
// closing bracket is a member), or the code it is refused with.
func classValue(raw string) (*tabnas.OrderedMap, string) {
	i := 1
	end := len(raw) - 1
	negated := false
	if raw[i] == '^' {
		negated = true
		i++
	}
	members := []any{}
	for i < end {
		lo, next, err := readChar(raw, i)
		if err != nil {
			return nil, "gbnf_escape"
		}
		i = next
		if i < end && raw[i] == '-' && i+1 < end {
			hi, next2, err := readChar(raw, i+1)
			if err != nil {
				return nil, "gbnf_escape"
			}
			i = next2
			if hi < lo {
				return nil, "gbnf_class_range"
			}
			members = append(members, treeObject("from", float64(lo), "to", float64(hi)))
			continue
		}
		members = append(members, treeObject("from", float64(lo), "to", float64(lo)))
	}
	if 0 == len(members) {
		return nil, "gbnf_empty_class"
	}
	return treeObject("negated", negated, "members", members), ""
}

// countOf reads a repetition count, if the tree holds it exactly.
func countOf(digits string) (float64, bool) {
	n, err := strconv.ParseUint(digits, 10, 64)
	if err != nil || n > maxCount {
		return 0, false
	}
	return float64(n), true
}

// postfixValue is a run of postfix operators as its repetitions, in the
// order written, or the code it is refused with.
func postfixValue(src string) ([]any, string) {
	out := []any{}
	for _, m := range reOP.FindAllStringSubmatch(src, -1) {
		switch m[0][0] {
		case '*':
			out = append(out, treeObject("min", float64(0)))
		case '+':
			out = append(out, treeObject("min", float64(1)))
		case '?':
			out = append(out, treeObject("min", float64(0), "max", float64(1)))
		default:
			min, ok := countOf(m[1])
			if !ok {
				return nil, "gbnf_count"
			}
			// `{m}` is exactly m, `{m,}` m or more and `{m,n}` the closed
			// range: the comma is read off the source, since a group that
			// did not take part is "" as one that took nothing is.
			if !strings.Contains(m[0], ",") {
				out = append(out, treeObject("min", min, "max", min))
				continue
			}
			if m[2] == "" {
				out = append(out, treeObject("min", min))
				continue
			}
			max, ok := countOf(m[2])
			if !ok {
				return nil, "gbnf_count"
			}
			if max < min {
				return nil, "gbnf_reversed_repetition"
			}
			out = append(out, treeObject("min", min, "max", max))
		}
	}
	return out, ""
}

// treeElement appends the element an atom built, its repetitions
// appended, onto the alternative; or refuses a group the source ended
// inside.
func treeElement(r *tabnas.Rule, ctx *tabnas.Context, repeat []any) {
	var el *tabnas.OrderedMap
	if r.Child != nil && r.Child != tabnas.NoRule {
		el, _ = r.Child.Node.(*tabnas.OrderedMap)
	}
	if el == nil {
		ctx.ParseErr = ctx.T0.Bad("gbnf_unclosed")
		return
	}
	if repeat != nil {
		reps := make([]any, len(repeat))
		for i, rep := range repeat {
			reps[i] = copyObject(rep.(*tabnas.OrderedMap))
		}
		el.Set("repeat", reps)
	}
	if p, ok := r.Node.(*treeList); ok {
		*p = append(*p, el)
	}
}

// treeActs is what each action of the meta-grammar builds in the tree
// instead: the states' own, and the alternates', keyed as defineGbnfRules
// names them.
func treeActs() *gbnfActs {
	return &gbnfActs{
		bound: map[string]bool{},
		state: map[string]tabnas.StateAction{
			"gbnf.bo": func(r *tabnas.Rule, _ *tabnas.Context) {
				r.Node = treeObject("type", "grammar", "start", "root", "rules", []any{})
			},
			"prod.bc": func(r *tabnas.Rule, _ *tabnas.Context) {
				alts, ok := listOf(r.Child)
				if !ok {
					return
				}
				rule := treeObject("type", "rule", "name", r.EnsureU()["name"], "alternatives", alts)
				if g, ok := r.Node.(*tabnas.OrderedMap); ok {
					rules, _ := g.Get("rules")
					list, _ := rules.([]any)
					g.Set("rules", append(list, rule))
				}
			},
			"alts.bo": func(r *tabnas.Rule, _ *tabnas.Context) {
				r.Node = &treeList{}
			},
			"alts.bc": func(r *tabnas.Rule, _ *tabnas.Context) {
				seq, ok := listOf(r.Child)
				if !ok {
					return
				}
				if p, ok := r.Node.(*treeList); ok {
					*p = append(*p, seq)
				}
			},
			"seq.bo": func(r *tabnas.Rule, _ *tabnas.Context) {
				r.Node = &treeList{}
			},
			"atom.bo": func(r *tabnas.Rule, _ *tabnas.Context) {
				r.Node = nil
				r.EnsureU()["grouped"] = false
			},
		},
		alt: map[string]tabnas.AltAction{
			"prod.open #NM #DEF": func(r *tabnas.Rule, _ *tabnas.Context) {
				r.EnsureU()["name"] = r.O[0].Src
			},
			// The run's repetitions, which its token carries from here.
			"elem.close #POST": func(r *tabnas.Rule, ctx *tabnas.Context) {
				read, code := postfixValue(r.C[0].Src)
				if code != "" {
					ctx.ParseErr = r.C[0].Bad(code)
					return
				}
				r.C[0].Val = read
				treeElement(r, ctx, read)
			},
			"elem.close ": func(r *tabnas.Rule, ctx *tabnas.Context) {
				treeElement(r, ctx, nil)
			},
			"atom.open #GS": func(r *tabnas.Rule, ctx *tabnas.Context) {
				text, code := stringText(r.O[0].Src)
				if code != "" {
					ctx.ParseErr = r.O[0].Bad(code)
					return
				}
				r.O[0].Val = text
				r.Node = treeObject("type", "literal", "text", text, "caseSensitive", true)
			},
			"atom.open #CC": func(r *tabnas.Rule, ctx *tabnas.Context) {
				read, code := classValue(r.O[0].Src)
				if code != "" {
					ctx.ParseErr = r.O[0].Bad(code)
					return
				}
				r.O[0].Val = read
				negated, _ := read.Get("negated")
				list, _ := read.Get("members")
				members := []any{}
				for _, m := range list.([]any) {
					members = append(members, copyObject(m.(*tabnas.OrderedMap)))
				}
				r.Node = treeObject("type", "class", "negated", negated, "members", members)
			},
			"atom.open #DOT": func(r *tabnas.Rule, _ *tabnas.Context) {
				r.Node = treeObject("type", "any")
			},
			"atom.open #TOK": func(r *tabnas.Rule, _ *tabnas.Context) {
				src := r.O[0].Src
				negated := '!' == src[0]
				from := 1
				if negated {
					from = 2
				}
				text := src[from : len(src)-1]
				r.O[0].Val = treeObject("negated", negated, "text", text)
				r.Node = treeObject("type", "token", "negated", negated, "text", text)
			},
			"atom.open #NM": func(r *tabnas.Rule, _ *tabnas.Context) {
				r.Node = treeObject("type", "reference", "name", r.O[0].Src)
			},
			"atom.open #LP": func(r *tabnas.Rule, _ *tabnas.Context) {
				r.EnsureU()["grouped"] = true
			},
			"atom.close #RP": func(r *tabnas.Rule, _ *tabnas.Context) {
				alts, _ := listOf(r.Child)
				r.Node = treeObject("type", "group", "alternatives", alts)
			},
		},
	}
}

// Make builds a fresh parser that reads a GBNF document as the tree: the
// parser a host streams a document through with the part, whose rule
// passes the part reads, and whose value is the tree, an
// *tabnas.OrderedMap (nil for an empty source, which makes no pass).
//
// It reads a source a window at a time when it is parsed from a reader
// (Tabnas.ParseReader, Lex.Window): its matchers read the text only through
// the window, the meta-grammar's match tokens behind gbnfReach.
func Make() *tabnas.Tabnas {
	opts := gbnfOptions()
	opts.Error = treeOptions.Error
	opts.Hint = treeOptions.Hint
	tn := tabnas.Empty(opts)
	acts := treeActs()
	defineGbnfRules(tn, acts)
	// Every action the tree declares is one the table binds.
	if len(acts.bound) != len(acts.state)+len(acts.alt) {
		panic("gbnf: the tree declares an action the meta-grammar does not take")
	}
	window := true
	tn.SetOptions(tabnas.Options{Lex: &tabnas.LexOptions{
		Window: &window,
		Match:  map[string]*tabnas.MatchSpec{"gbnf-reach": reachMatcher(gbnfReach)},
	}})
	return tn
}

// gbnfReach reports whether the byte that decides how far GBNF's own
// matchers read lies in window, the text from the cursor, and when it does
// not, how many bytes they would read there. A string, a class and a
// tokenizer token read to the quote, bracket or angle that closes them, a
// backslash taking the byte after it, and `!` the `<` after it; a run of
// postfix operators reads every operator, count, comma, brace and space of
// the run and the byte after; a name reads its word and the byte after;
// `::=` reads three bytes. Every other token is the engine's, whose
// matchers read the window themselves.
func gbnfReach(window string) (bool, int) {
	if window == "" {
		return false, 0
	}
	switch c := window[0]; {
	case c == '"':
		return closingReach(window, 1, '"')
	case c == '[':
		return closingReach(window, 1, ']')
	case c == '<':
		return closingReach(window, 1, '>')
	case c == '!':
		if len(window) < 2 {
			return false, 1
		}
		if window[1] == '<' {
			return closingReach(window, 2, '>')
		}
		return true, 1
	case c == ':':
		return fixedReach(window, 3)
	case c == '*' || c == '+' || c == '?' || c == '{':
		return run(window, 1, func(c byte) bool {
			return strings.IndexByte("*+?{},0123456789 \t\r\n", c) >= 0
		})
	case isWordByte(c):
		return run(window, 1, isWordByte)
	}
	return true, 0
}

// isWordByte is a byte of a GBNF name, llama.cpp's is_word_char.
func isWordByte(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-'
}

// closingReach reports whether end follows from at on in window where no
// backslash escapes it, which decides where the token ends; and when it
// does not, the bytes read.
func closingReach(window string, at int, end byte) (bool, int) {
	for ; at < len(window); at++ {
		switch window[at] {
		case '\\':
			at++
		case end:
			return true, at
		}
	}
	return false, len(window)
}

// fixedReach reports whether window holds the n bytes a token of n bytes is
// decided by; and when it does not, the bytes read.
func fixedReach(window string, n int) (bool, int) {
	if len(window) >= n {
		return true, n
	}
	return false, len(window)
}

// run reports whether a byte outside within follows the run that within
// holds from at on in window, which decides where the run ends; and when
// none does, the bytes read.
func run(window string, at int, within func(byte) bool) (bool, int) {
	for ; at < len(window); at++ {
		if !within(window[at]) {
			return true, at
		}
	}
	return false, at
}

// reachMatcher is a lexer matcher that runs before every other one and
// cuts no token: in a parse from a reader a window at a time, the text after
// the cursor is the window's, which may end inside a token, so that a match
// token's expression would match a shorter token, or none, where the whole
// text has a longer one. It reads the window on, twice as far each time,
// until the byte that decides where the token ends lies inside it (reach)
// or the source has ended, so that every matcher after it sees what the
// whole text shows it. A whole text is all read.
func reachMatcher(reach func(string) (bool, int)) *tabnas.MatchSpec {
	return &tabnas.MatchSpec{
		Order: 900000,
		Make: func(_ *tabnas.LexConfig, _ *tabnas.Options) tabnas.LexMatcher {
			return func(lex *tabnas.Lex, _ *tabnas.Rule) *tabnas.Token {
				if !lex.Windowed() {
					return nil
				}
				ahead := 1
				for {
					held := lex.Fill(ahead)
					decided, read := reach(lex.Window())
					if decided || !held {
						return nil
					}
					ahead = max(read+1, 2*ahead)
				}
			}
		},
	}
}

// ParseGbnfTree reads a GBNF document whole as the tree. A source the
// meta-grammar refuses, or the tree cannot hold, fails with a *ParseError
// naming the line and column, its Cause the engine's error with its code.
// The parser is built per call, as ParseGbnf's is, so that two goroutines
// can read at once.
func ParseGbnfTree(src string) (*tabnas.OrderedMap, error) {
	out, err := Make().Parse(src)
	if err != nil {
		line, col := 0, 0
		if te, ok := err.(*tabnas.TabnasError); ok {
			line, col = te.Row, te.Col
		}
		loc := ""
		if line != 0 && col != 0 {
			loc = " at line " + strconv.Itoa(line) + ", column " + strconv.Itoa(col)
		}
		raw := strings.SplitN(err.Error(), "\n", 2)[0]
		return nil, &ParseError{
			Message: "gbnf: parse error" + loc + ": " + raw,
			Line:    line, Column: col, Cause: err,
		}
	}
	if tree, ok := out.(*tabnas.OrderedMap); ok {
		return tree, nil
	}
	// An empty source makes no rule pass, and the engine answers nothing
	// for it: it is the grammar of no rules, as a source of comments is.
	return treeObject("type", "grammar", "start", "root", "rules", []any{}), nil
}
