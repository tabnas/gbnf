// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// parser_gbnf.go — the GBNF front-end: llama.cpp GBNF text in, grammar
// IR out.
//
// Everything downstream of the IR belongs to github.com/tabnas/bnf/go
// and is shared with the ABNF and EBNF front-ends:
//
//	GBNF text --ParseGbnf--> bnf.Grammar --bnf.EmitGrammarSpec--> GrammarSpec
//
// The grammar that reads GBNF is ITSELF a tabnas grammar —
// `defineGbnfRules` below is a table of open/close rule alternates
// executed by the very engine this front-end compiles for, mirroring
// `gbnfRules` in ts/src/converter.ts. That is the point of having a
// parser engine: the notation is declared once, in the engine's own
// terms, rather than reimplemented by hand per runtime. An earlier
// version of this file was hand-written recursive descent; it was
// replaced by this, and the whole suite — including all eight corpus
// grammars graded both ways and all 70 live-corpus grammars — passed
// unchanged, which is the evidence that the language did not move.
//
// The dialect is llama.cpp's `grammars/README.md`; ts/doc/known-gaps.md
// records where this front-end and llama.cpp's own parser diverge, and
// applies to this runtime equally.
//
// TWO GO-SPECIFIC DEPARTURES from the TS table, both forced by the
// language rather than chosen:
//
//   - Accumulating nodes are POINTERS to slices. TS pushes into a shared
//     array because JS arrays are references; a Go `append` may
//     reallocate, so a child appending to a value-copy of its parent's
//     slice would silently drop elements. `*[]T` restores the semantics
//     the rule table assumes.
//   - A terminal decoder cannot throw. Actions have no error return, so
//     a decode failure is recorded on per-parse state reached through
//     ctx.Meta and re-raised by ParseGbnf, which mirrors what the TS
//     engine does by letting the exception propagate.
package gbnf

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	bnf "github.com/tabnas/bnf/go"
	tabnas "github.com/tabnas/parser/go"
)

// GBNF's escape vocabulary, exactly as llama.cpp defines it.
var simpleEscapes = map[byte]rune{
	't': '\t', 'r': '\r', 'n': '\n',
	'\\': '\\', '"': '"', '[': '[', ']': ']',
}

var hexEscapes = map[byte]int{'x': 2, 'u': 4, 'U': 8}

// ---- Token vocabulary ----------------------------------------------
//
// Every terminal whose body is free-form — strings, character classes,
// repetition braces, tokenizer terminals, rule names — is lexed WHOLE by
// one anchored regex flagged eager, which opts the matcher out of the
// lexer's rule-position gate. GBNF's terminals are unambiguous by their
// first character (`"` `[` `{` `<` `!` and word chars are each claimed by
// exactly one matcher), so tokenisation does not need to know what the
// parser expects.

// Whitespace exactly as llama.cpp's parse_space defines it — NOT a wider
// Unicode notion, which would accept grammars llama.cpp rejects.
const spClass = `[ \t\r\n]`

// `{m}` / `{m,}` / `{m,n}`, with llama.cpp-legal spacing throughout. The
// non-capturing form is for the run matcher, which only needs the extent;
// the capturing form is for applyPostfix, which needs the counts.
const repNC = `\{` + spClass + `*(?:[0-9]+)` + spClass +
	`*(?:,` + spClass + `*(?:[0-9]*)` + spClass + `*)?\}`

const repCap = `\{` + spClass + `*([0-9]+)` + spClass +
	`*(?:,` + spClass + `*([0-9]*)` + spClass + `*)?\}`

var (
	reGS  = regexp.MustCompile(`^"(?:\\[\s\S]|[^"\\])*"`)
	reCC  = regexp.MustCompile(`^\[(?:\\[\s\S]|[^\]\\])*\]`)
	reTOK = regexp.MustCompile(`^!?<(?:\\[\s\S]|[^>\\])*>`)
	reNM  = regexp.MustCompile(`^[A-Za-z0-9_-]+`)
	// A RUN of postfix operators, lexed as one token so `elem` stays a
	// two-alternate rule rather than a loop: a close-state loop needs a
	// push or replace on every iteration, and there is no child rule to
	// push for a `*`. Chaining (`x*?`) moves into applyPostfix.
	rePOST = regexp.MustCompile(`^(?:[*+?]|` + repNC + `)(?:` + spClass +
		`*(?:[*+?]|` + repNC + `))*`)
	// The individual operators within such a run, left to right.
	reOP = regexp.MustCompile(`[*+?]|` + repCap)
)

// ---- Per-parse state ------------------------------------------------

const metaKey = "gbnf.state"

// gbnfState carries the first decoder failure out of a rule action.
// Per-parse (reached via ctx.Meta) rather than package-level, so
// concurrent ParseGbnf calls cannot see each other's errors.
type gbnfState struct{ err error }

func stateOf(ctx *tabnas.Context) *gbnfState {
	if ctx == nil || ctx.Meta == nil {
		return nil
	}
	st, _ := ctx.Meta[metaKey].(*gbnfState)
	return st
}

// failAt records a decode failure, keeping the FIRST one: later actions
// still run (the engine does not know to stop), and the earliest error is
// the one that explains the grammar.
func failAt(ctx *tabnas.Context, tok *tabnas.Token, format string, args ...any) {
	st := stateOf(ctx)
	if st == nil || st.err != nil {
		return
	}
	pe := &ParseError{Message: fmt.Sprintf("gbnf: "+format, args...)}
	if tok != nil {
		pe.Line = tok.RI
		pe.Column = tok.CI
	}
	st.err = pe
}

// ---- Terminal decoding ----------------------------------------------

// readChar reads one character — plain or escaped — starting at i within
// `whole`, returning the code point and the index just past it.
func readChar(whole string, i int) (rune, int, error) {
	if whole[i] != '\\' {
		r, size := utf8.DecodeRuneInString(whole[i:])
		return r, i + size, nil
	}
	if i+1 >= len(whole) {
		return 0, 0, fmt.Errorf("trailing backslash in terminal %s", whole)
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
			return 0, 0, fmt.Errorf(
				"escape '\\%c' in terminal %s needs %d hex digits, found '%s'",
				mark, whole, digits, hex)
		}
		n, _ := strconv.ParseInt(hex, 16, 64)
		if n > 0x10FFFF {
			return 0, 0, fmt.Errorf(
				"escape '\\%c%s' in terminal %s is %d, which is not a Unicode "+
					"code point (the maximum is \\U0010FFFF)", mark, hex, whole, n)
		}
		return rune(n), i + 2 + digits, nil
	}
	return 0, 0, fmt.Errorf(
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
func decodeString(raw string) (string, error) {
	body := raw[1 : len(raw)-1]
	var b strings.Builder
	for i := 0; i < len(body); {
		cp, next, err := readChar(raw, i+1)
		if err != nil {
			return "", err
		}
		b.WriteRune(cp)
		i = next - 1
	}
	return b.String(), nil
}

// decodeCharClass lowers `[a-z]`, `[^\n]`, `[-+*/]` onto a regex element.
// The class is re-emitted rather than passed through: GBNF and RE2 agree
// on `[`, `]`, `^` and `-` and on nothing else.
func decodeCharClass(raw string, tkn *tabnas.Token) (*bnf.Element, error) {
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
		lo, next, err := readChar(raw, i)
		if err != nil {
			return nil, err
		}
		i = next
		// A `-` immediately before the closing bracket is a literal
		// hyphen, not a range operator — llama.cpp checks `pos[1] != ']'`
		// the same way, which is what makes `[-+*/]` in its own
		// arithmetic.gbnf a four-member class rather than a syntax error.
		if i < end && raw[i] == '-' && i+1 < end {
			hi, next2, err := readChar(raw, i+1)
			if err != nil {
				return nil, err
			}
			i = next2
			if hi < lo {
				return nil, fmt.Errorf(
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
		return nil, fmt.Errorf("empty character class %s matches nothing", raw)
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
		Sp:      spanOf(tkn),
	}, nil
}

// ---- Repetition ------------------------------------------------------

// applyPostfix applies a run of postfix operators left to right, so `x*?`
// is `(x*)?` — the order llama.cpp's own sequence loop applies them in.
func applyPostfix(item *bnf.Element, src string) (*bnf.Element, error) {
	out := item
	for _, m := range reOP.FindAllStringSubmatch(src, -1) {
		switch m[0][0] {
		case '*':
			out = &bnf.Element{Kind: bnf.KindStar, Inner: out}
		case '+':
			out = &bnf.Element{Kind: bnf.KindPlus, Inner: out}
		case '?':
			out = &bnf.Element{Kind: bnf.KindOpt, Inner: out}
		default:
			min, _ := strconv.Atoi(m[1])
			max := min
			// `{m}` (no comma) is exactly m; `{m,}` is m or more; `{m,n}`
			// is the closed range. FindAllStringSubmatch gives "" for a
			// group that did not participate, so the comma is detected by
			// looking at the source rather than at m[2].
			if strings.Contains(m[0], ",") {
				if m[2] == "" {
					max = bnf.MaxInfinity
				} else {
					max, _ = strconv.Atoi(m[2])
				}
			}
			el, err := repeat(out, min, max, m[0])
			if err != nil {
				return nil, err
			}
			out = el
		}
	}
	return out, nil
}

// repeat lowers a repetition count onto the IR. star/plus/opt are the
// shapes the shared compiler desugars into paired helper rules; rep
// covers everything else. The degenerate braces collapse exactly as the
// TS front-end collapses them, so both runtimes emit the same IR.
func repeat(inner *bnf.Element, min, max int, src string) (*bnf.Element, error) {
	if max < min {
		return nil, fmt.Errorf(
			"repetition %s has an upper bound below its lower bound", src)
	}
	switch {
	case min == 1 && max == 1:
		return inner, nil
	case min == 0 && max == bnf.MaxInfinity:
		return &bnf.Element{Kind: bnf.KindStar, Inner: inner}, nil
	case min == 1 && max == bnf.MaxInfinity:
		return &bnf.Element{Kind: bnf.KindPlus, Inner: inner}, nil
	case min == 0 && max == 1:
		return &bnf.Element{Kind: bnf.KindOpt, Inner: inner}, nil
	}
	return &bnf.Element{Kind: bnf.KindRep, Min: min, Max: max, Inner: inner}, nil
}

// ---- The meta-grammar ------------------------------------------------
//
//	gbnf = prod*
//	prod = NM '::=' alts
//	alts = seq ('|' seq)*
//	seq  = elem*                (an EMPTY seq is legal GBNF:
//	                             `ws ::= | " " | "\n"`)
//	elem = atom POST?
//	atom = NM | GS | CC | DOT | TOK | '(' alts ')'

// newGbnfParser builds an instance configured to read GBNF.
//
// Built per call rather than cached, unlike the TS front-end's memoised
// instance: a *Tabnas is not safe for concurrent Parse, and a package
// singleton would make ParseGbnf unsafe to call from two goroutines.
func newGbnfParser() *tabnas.Tabnas {
	off := false
	on := true
	str := func(s string) *string { return &s }

	tn := tabnas.Empty(tabnas.Options{
		Rule: &tabnas.RuleOptions{Start: "gbnf"},
		Fixed: &tabnas.FixedOptions{
			Token: map[string]*string{
				// Clear the JSON-oriented defaults: `{`, `}`, `[`, `]`, `:`
				// and `,` all belong to GBNF terminals that are lexed whole
				// by the match matchers, and must not be stolen a character
				// at a time.
				"#OB": nil, "#CB": nil, "#OS": nil,
				"#CS": nil, "#CL": nil, "#CA": nil,
				"#DEF": str("::="),
				"#ALT": str("|"),
				"#LP":  str("("),
				"#RP":  str(")"),
				"#DOT": str("."),
			},
		},
		Match: &tabnas.MatchOptions{
			Token: map[string]*regexp.Regexp{
				"#GS": reGS, "#CC": reCC, "#POST": rePOST,
				"#TOK": reTOK, "#NM": reNM,
			},
			// Eager: fire wherever the regex matches, and let the parser
			// reject a token it did not expect. GBNF's terminals are
			// distinguished by their first character, so tokenisation is
			// independent of parse state.
			TokenEager: map[string]bool{
				"#GS": true, "#CC": true, "#POST": true,
				"#TOK": true, "#NM": true,
			},
			// Longest-first where two could overlap: a `{` run must be
			// claimed by #POST, never by a bare name.
			TokenOrder: []string{"#GS", "#CC", "#TOK", "#POST", "#NM"},
		},
		// Nothing below is GBNF syntax: numbers, quoted strings, barewords
		// and keyword values are all covered by the match tokens above.
		Number: &tabnas.NumberOptions{Lex: &off},
		String: &tabnas.StringOptions{Lex: &off},
		Text:   &tabnas.TextOptions{Lex: &off},
		Value:  &tabnas.ValueOptions{Lex: &off},
		Comment: &tabnas.CommentOptions{
			// GBNF comments run from `#` to end of line. A `#` inside a
			// string or a character class is never seen here: both are
			// match tokens, and the match matcher runs first.
			Def: map[string]*tabnas.CommentDef{
				"hash":  {Line: true, Start: "#", Lex: &on, EatLine: &off},
				"slash": nil,
				"multi": nil,
			},
		},
	})

	defineGbnfRules(tn)
	return tn
}

// alt is one alternate, written as a struct literal so the rule table
// below reads as a table — the nearest Go gets to the object literals
// ts/src/converter.ts uses. Zero fields are simply absent, exactly as an
// omitted key is in TS.
type alt struct {
	S    string           // per-position token names, e.g. "#NM #DEF"
	P    string           // push rule
	R    string           // replace rule
	B    int              // backtrack this many tokens
	G    string           // group tag
	Act  tabnas.AltAction // match action
	Cond tabnas.AltCond   // guard
}

// defineGbnfRules installs the meta-grammar:
//
//	gbnf = prod*
//	prod = NM '::=' alts
//	alts = seq ('|' seq)*
//	seq  = elem*                (an EMPTY seq is legal GBNF:
//	                             `ws ::= | " " | "\n"`)
//	elem = atom POST?
//	atom = NM | GS | CC | DOT | TOK | '(' alts ')'
func defineGbnfRules(tn *tabnas.Tabnas) {
	// Token names resolve against THIS instance's tin allocation.
	spec := func(a alt) *tabnas.AltSpec {
		out := &tabnas.AltSpec{P: a.P, R: a.R, B: a.B, G: a.G, A: a.Act, C: a.Cond}
		for _, n := range strings.Fields(a.S) {
			out.S = append(out.S, []tabnas.Tin{tn.Token(n)})
		}
		return out
	}
	alts := func(as ...alt) []*tabnas.AltSpec {
		out := make([]*tabnas.AltSpec, len(as))
		for i, a := range as {
			out[i] = spec(a)
		}
		return out
	}
	rule := func(name string, define func(rs *tabnas.RuleSpec)) {
		tn.Rule(name, func(rs *tabnas.RuleSpec, p *tabnas.Parser) { define(rs) })
	}

	// Top level: accumulates productions into r.Node.
	rule("gbnf", func(rs *tabnas.RuleSpec) {
		rs.AddBO(func(r *tabnas.Rule, ctx *tabnas.Context) {
			r.Node = &[]*bnf.Production{}
		})
		rs.AddOpen(alts(
			alt{S: "#ZZ", G: "empty"},
			alt{P: "prod"},
		)...)
		rs.AddClose(alts(alt{S: "#ZZ"})...)
	})

	// One production per invocation; tail-recurses for the next. Inherits
	// its parent's node (the productions slice) and appends in bc once its
	// `alts` child has returned.
	rule("prod", func(rs *tabnas.RuleSpec) {
		rs.AddBO(func(r *tabnas.Rule, ctx *tabnas.Context) { ensureU(r) })
		rs.AddOpen(alts(alt{
			S: "#NM #DEF",
			Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
				r.U["name"] = r.O[0].Src
				r.U["nameTkn"] = r.O[0]
			},
			P: "alts",
		})...)
		// `NM ::=` means the next production has begun — back up 2 tokens
		// so a fresh `prod` invocation sees them. `::=` can only ever
		// follow a rule name at the start of a production, so this
		// two-token lookahead is exact.
		rs.AddClose(alts(
			alt{S: "#NM #DEF", B: 2, R: "prod"},
			alt{B: 1},
		)...)
		rs.AddBC(func(r *tabnas.Rule, ctx *tabnas.Context) {
			as, ok := childAlts(r)
			if !ok {
				return
			}
			name, _ := r.U["name"].(string)
			ps := r.Node.(*[]*bnf.Production)
			nameTkn, _ := r.U["nameTkn"].(*tabnas.Token)
			// The name, not the body: that is what an outline entry,
			// go-to-definition and a whole-rule diagnostic want.
			*ps = append(*ps, &bnf.Production{
				Name: name, Alts: *as, Sp: spanOf(nameTkn),
			})
		})
	})

	// A list of alternative sequences separated by `|`. Owns its own
	// slice and appends each seq result.
	rule("alts", func(rs *tabnas.RuleSpec) {
		rs.AddBO(func(r *tabnas.Rule, ctx *tabnas.Context) {
			r.Node = &[]bnf.Sequence{}
		})
		rs.AddOpen(alts(alt{P: "seq"})...)
		rs.AddClose(alts(
			alt{S: "#ALT", P: "seq"},
			alt{B: 1},
		)...)
		rs.AddBC(func(r *tabnas.Rule, ctx *tabnas.Context) {
			seq, ok := childSeq(r)
			if !ok {
				return
			}
			as := r.Node.(*[]bnf.Sequence)
			*as = append(*as, *seq)
		})
	})

	// A (possibly empty) sequence of elements. The boundary alternates
	// come first and match without consuming (`B` cancels the token
	// consumption) so the enclosing rule sees the token itself. An empty
	// sequence is legal and meaningful: llama.cpp's own json.gbnf writes
	// optional whitespace as `ws ::= | " " | "\n" [ \t]{0,20}`, whose
	// first alternative matches nothing.
	rule("seq", func(rs *tabnas.RuleSpec) {
		rs.AddBO(func(r *tabnas.Rule, ctx *tabnas.Context) {
			r.Node = &bnf.Sequence{}
		})
		bounds := []alt{
			{S: "#NM #DEF", B: 2, G: "end"},
			{S: "#ALT", B: 1, G: "end"},
			{S: "#RP", B: 1, G: "end"},
			{S: "#ZZ", B: 1, G: "end"},
			{P: "elem"},
		}
		rs.AddOpen(alts(bounds...)...)
		rs.AddClose(alts(bounds...)...)
	})

	// One element: an atom followed by an optional postfix run. The run
	// arrives as a SINGLE #POST token, which is what makes this a
	// two-alternate rule rather than a loop.
	rule("elem", func(rs *tabnas.RuleSpec) {
		push := func(r *tabnas.Rule, el *bnf.Element) {
			seq := r.Node.(*bnf.Sequence)
			*seq = append(*seq, el)
		}
		rs.AddOpen(alts(alt{P: "atom"})...)
		rs.AddClose(alts(
			// `r.C`, not `r.O`: tokens matched by a close-state alternate
			// land in the rule's close-token array.
			alt{S: "#POST", Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
				item := childElement(r)
				if item == nil {
					return
				}
				el, err := applyPostfix(item, r.C[0].Src)
				if err != nil {
					failAt(ctx, r.C[0], "%s", err)
					return
				}
				push(r, el)
			}},
			alt{Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
				if item := childElement(r); item != nil {
					push(r, item)
				}
			}},
		)...)
	})

	// The atom body. Sets its OWN r.Node so the enclosing `elem` can read
	// it from r.Child.Node. A nil node is load-bearing: an empty string
	// literal (`""`) contributes no element at all, and `elem` skips
	// pushing when the atom left its node unset.
	rule("atom", func(rs *tabnas.RuleSpec) {
		rs.AddBO(func(r *tabnas.Rule, ctx *tabnas.Context) {
			r.Node = nil
			ensureU(r)
			r.U["grouped"] = false
		})
		rs.AddOpen(alts(
			alt{S: "#GS", Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
				lit, err := decodeString(r.O[0].Src)
				if err != nil {
					failAt(ctx, r.O[0], "%s", err)
					return
				}
				// GBNF string literals are CASE-SENSITIVE — the opposite of
				// RFC 5234's default. The flag is what makes the emitter
				// lower this to a plain fixed token instead of a
				// case-folding regex, so dropping it would silently accept
				// "TRUE" for "true".
				if lit != "" {
					r.Node = &bnf.Element{
						Kind: bnf.KindTerm, Literal: lit, CaseSensitive: true,
						Sp: spanOf(r.O[0]),
					}
				}
			}},
			alt{S: "#CC", Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
				el, err := decodeCharClass(r.O[0].Src, r.O[0])
				if err != nil {
					failAt(ctx, r.O[0], "%s", err)
					return
				}
				r.Node = el
			}},
			// `.` is llama.cpp's LLAMA_GRETYPE_CHAR_ANY: any single
			// character, newlines included. The u flag makes "one
			// character" mean one code point.
			alt{S: "#DOT", Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
				r.Node = &bnf.Element{
					Kind: bnf.KindRegex, Pattern: `[\s\S]`, Flags: "u",
					Sp: spanOf(r.O[0]),
				}
			}},
			// Tokenizer-token terminals parse, then are rejected by name in
			// rejectTokenTerminals — carried on KindProse, the IR's "not
			// compilable, keep the text for the diagnostic" element.
			alt{S: "#TOK", Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
				r.Node = &bnf.Element{
					Kind: bnf.KindProse, Text: r.O[0].Src, Sp: spanOf(r.O[0]),
				}
			}},
			alt{S: "#NM", Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
				r.Node = &bnf.Element{
					Kind: bnf.KindRef, Name: r.O[0].Src, Sp: spanOf(r.O[0]),
				}
			}},
			alt{S: "#LP", P: "alts", Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
				r.U["grouped"] = true
				r.U["open"] = r.O[0]
			}},
		)...)
		rs.AddClose(alts(
			// Only a group consumes the `)`. Without the condition this
			// alternate would eat the closing paren of the ENCLOSING group
			// after a simple atom — `( "a" )` would lose its `)`.
			alt{
				S: "#RP",
				Cond: func(r *tabnas.Rule, ctx *tabnas.Context) bool {
					g, _ := r.U["grouped"].(bool)
					return g
				},
				Act: func(r *tabnas.Rule, ctx *tabnas.Context) {
					as, ok := childAlts(r)
					if !ok {
						return
					}
					open, _ := r.U["open"].(*tabnas.Token)
					r.Node = &bnf.Element{
						Kind: bnf.KindGroup, Alts: *as, Sp: spanTo(open, closeTok(r)),
					}
				},
			},
			// Simple atoms already set r.Node in open; pop without consuming.
			alt{B: 1},
		)...)
	})
}

// ensureU makes a rule's custom-prop map writable. TS creates `r.u` for
// every rule; Go leaves the map nil until something declares it, and an
// action writing to a nil map panics inside the engine.
func ensureU(r *tabnas.Rule) {
	if r.U == nil {
		r.U = map[string]any{}
	}
}

// Child-node accessors. The engine leaves Child unset (or its Node nil)
// when a rule closed without producing one, which is the normal shape for
// an empty alternative — so a missing child is silence, not an error.

func childAlts(r *tabnas.Rule) (*[]bnf.Sequence, bool) {
	if r.Child == nil {
		return nil, false
	}
	a, ok := r.Child.Node.(*[]bnf.Sequence)
	return a, ok
}

func childSeq(r *tabnas.Rule) (*bnf.Sequence, bool) {
	if r.Child == nil {
		return nil, false
	}
	s, ok := r.Child.Node.(*bnf.Sequence)
	return s, ok
}

func childElement(r *tabnas.Rule) *bnf.Element {
	if r.Child == nil {
		return nil
	}
	el, _ := r.Child.Node.(*bnf.Element)
	return el
}

// ---- Grammar-level parse and validation ------------------------------

// ParseGbnf parses GBNF source into the grammar IR. The returned Grammar
// is ready for bnf.EmitGrammarSpec: `root` is present, every reference
// resolves, and no tokenizer terminals remain.
func ParseGbnf(src string) (*bnf.Grammar, error) {
	tn := newGbnfParser()
	st := &gbnfState{}

	out, err := tn.ParseMeta(src, map[string]any{metaKey: st})

	// A terminal decoder's own diagnostic already names the offending
	// escape or class, and is more use than the engine's positional
	// complaint about the token it could not place. Prefer it.
	if st.err != nil {
		return nil, st.err
	}
	if err != nil {
		return nil, wrapParseError(err)
	}

	prods, _ := out.(*[]*bnf.Production)
	if prods == nil || len(*prods) == 0 {
		return nil, &ParseError{Message: "gbnf: no productions found"}
	}

	productions := dedupeProductions(*prods)
	if err := rejectTokenTerminals(productions); err != nil {
		return nil, err
	}
	if err := requireRoot(productions); err != nil {
		return nil, err
	}
	if err := requireDefinedRefs(productions); err != nil {
		return nil, err
	}
	return &bnf.Grammar{Productions: productions}, nil
}

// wrapParseError restamps an engine diagnostic as this front-end's, so a
// caller sees one error vocabulary regardless of which layer failed.
func wrapParseError(err error) error {
	msg := err.Error()
	if i := strings.IndexByte(msg, '\n'); i >= 0 {
		msg = msg[:i]
	}
	return &ParseError{Message: "gbnf: " + msg, Cause: err}
}

// spanOf is the source span of a token, for the IR (bnf.SrcSpan). Every
// field is copied straight off the token: the compiler stores whatever
// units the front-end's own engine tokens use, precisely so that no
// arithmetic — and so no off-by-one — happens at this boundary. Go
// tokens carry no length, so the end comes from the matched source.
func spanOf(tkn *tabnas.Token) *bnf.SrcSpan {
	if tkn == nil {
		return nil
	}
	return &bnf.SrcSpan{
		S: tkn.SI, E: tkn.SI + len(tkn.Src), R: tkn.RI, C: tkn.CI,
	}
}

// spanTo is one span covering two tokens — a group runs from its `(` to
// its `)`. Falls back to whichever end is known when the other is not.
func spanTo(from, to *tabnas.Token) *bnf.SrcSpan {
	a := spanOf(from)
	b := spanOf(to)
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	return &bnf.SrcSpan{S: a.S, E: b.E, R: a.R, C: a.C}
}

// closeTok is the first token matched in a rule's CLOSE phase — the `)`
// of a group. Returns nil when the rule closed without matching one, so
// a span falls back to its opener.
func closeTok(r *tabnas.Rule) *tabnas.Token {
	if 0 < r.CN {
		return r.C[0]
	}
	return nil
}
