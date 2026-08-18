// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// facade.go — the package's public surface, mirroring ts/src/gbnf.ts.
package gbnf

import (
	"strings"

	bnf "github.com/tabnas/bnf/go"
	tabnas "github.com/tabnas/parser/go"
)

// The IR types under this package's own names. Aliases, not definitions:
// a value has to cross the package boundary.
type (
	GbnfElement    = bnf.Element
	GbnfSequence   = bnf.Sequence
	GbnfProduction = bnf.Production
	GbnfGrammar    = bnf.Grammar
)

// ConvertOptions is the shared compiler's options plus this front-end's
// own knob.
type ConvertOptions struct {
	Start        string
	Tag          string
	Builtins     bool
	Marks        bool
	WordKeywords bool
}

// ParseError is raised when the GBNF source itself cannot be read.
type ParseError struct {
	Message string
	Line    int
	Column  int
	Cause   error
}

func (e *ParseError) Error() string { return e.Message }
func (e *ParseError) Unwrap() error { return e.Cause }

// CompileError is raised when the GBNF parsed cleanly but the grammar
// cannot be compiled — a tokenizer-token terminal, an unknown rule
// reference, a purely left-recursive rule.
type CompileError struct {
	Message string
	Cause   error
}

func (e *CompileError) Error() string { return e.Message }
func (e *CompileError) Unwrap() error { return e.Cause }

// Gbnf converts GBNF source into a tabnas grammar spec.
//
// Installing the result is what switches an instance to GBNF's exact
// lexing: the spec carries an empty ignore set and no default matchers.
// Use a fresh instance per grammar — those settings are instance-wide.
func Gbnf(src string, opts *ConvertOptions) (*tabnas.GrammarSpec, error) {
	grammar, err := ParseGbnf(src)
	if err != nil {
		return nil, err
	}
	if opts == nil {
		opts = &ConvertOptions{}
	}
	start := opts.Start
	if start == "" {
		start = "root"
	}
	tag := opts.Tag
	if tag == "" {
		tag = "gbnf"
	}
	spec, err := emitSafely(grammar, &bnf.ConvertOptions{
		Start: start, Tag: tag,
		Builtins: opts.Builtins, Marks: opts.Marks,
		WordKeywords: opts.WordKeywords,
	})
	if err != nil {
		return nil, err
	}
	applyExactLexing(spec, derivesEmpty(grammar, start))
	return spec, nil
}

// emitSafely runs the shared compiler and turns its failure into a
// GBNF-flavoured error.
//
// The recover is load-bearing, not decoration: the Go compiler pipeline
// PANICS on a grammar it cannot compile, where the TypeScript one throws
// a catchable error. Panicking at invalid user input is the wrong
// contract for a library, but the behaviour is inherited and abnf/go's
// suite pins it, so it is contained here rather than changed underneath
// another package.
func emitSafely(
	g *bnf.Grammar, opts *bnf.ConvertOptions,
) (spec *tabnas.GrammarSpec, err error) {
	defer func() {
		if r := recover(); r != nil {
			// The panicked value is kept as the cause, not just its
			// text: the compiler raises the purely-left-recursive
			// rejection as a *bnf.EmitError so the SPAN survives the
			// panic, and stringifying here would discard it at the
			// last step. With the cause attached, `errors.As` recovers
			// the range on this path exactly as on the return path
			// below.
			switch v := r.(type) {
			case error:
				err = &CompileError{Message: restamp(v.Error()), Cause: v}
			case string:
				err = &CompileError{Message: restamp(v)}
			default:
				panic(r)
			}
		}
	}()
	spec, err = bnf.EmitGrammarSpec(g, opts)
	if err != nil {
		return nil, &CompileError{Message: restamp(err.Error()), Cause: err}
	}
	return spec, nil
}

func restamp(msg string) string {
	for _, p := range []string{"bnf: ", "abnf: "} {
		if strings.HasPrefix(msg, p) {
			return "gbnf: " + msg[len(p):]
		}
	}
	return msg
}

// applyExactLexing turns off every default matcher and empties the
// ignore set. GBNF is scannerless — its grammar describes the input one
// character at a time — so anything the lexer does on its own initiative
// (skipping space, recognising numbers, claiming quoted strings) changes
// the accepted language.
func applyExactLexing(spec *tabnas.GrammarSpec, acceptsEmpty bool) {
	off := false
	if spec.Options == nil {
		spec.Options = &tabnas.Options{}
	}
	spec.Options.TokenSet = map[string][]string{"IGNORE": {}}
	spec.Options.Space = &tabnas.SpaceOptions{Lex: &off}
	spec.Options.Line = &tabnas.LineOptions{Lex: &off}
	spec.Options.Comment = &tabnas.CommentOptions{Lex: &off}
	spec.Options.String = &tabnas.StringOptions{Lex: &off}
	spec.Options.Number = &tabnas.NumberOptions{Lex: &off}
	spec.Options.Text = &tabnas.TextOptions{Lex: &off}
	spec.Options.Value = &tabnas.ValueOptions{Lex: &off}
	// Negotiated lexing, the same opt-in the TS front-end makes. GBNF is
	// scannerless, so one character can legitimately be a different token
	// for different alternates ('"' is an escapable char inside a string
	// body and the closing quote at its end; '\n' is a ws-class member and
	// a literal). Without it an alternate fails on the first cut's
	// identity; with it the alternate re-cuts the span under its own tins.
	//
	// No capability probe here, unlike ts/src/converter.ts: Go resolves
	// this field at compile time, so a parser too old to know Relex fails
	// the build rather than silently ignoring the option.
	on := true
	spec.Options.Lex = &tabnas.LexOptions{Empty: &acceptsEmpty, Relex: &on}
}

// ToSpec is Gbnf under the name the TS package uses.
func ToSpec(src string, opts *ConvertOptions) (*tabnas.GrammarSpec, error) {
	return Gbnf(src, opts)
}

// EliminateLeftRecursion exposes that pass for a caller that wants to
// inspect the rewritten IR.
func EliminateLeftRecursion(g *GbnfGrammar) *GbnfGrammar {
	return bnf.EliminateLeftRecursion(g)
}

// Install converts GBNF source and installs it on a tabnas instance.
func Install(
	j *tabnas.Tabnas, src string, opts *ConvertOptions,
) (*tabnas.GrammarSpec, error) {
	spec, err := Gbnf(src, opts)
	if err != nil {
		return nil, err
	}
	if err := j.Grammar(spec); err != nil {
		return nil, err
	}
	return spec, nil
}
