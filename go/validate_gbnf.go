// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// validate_gbnf.go — the semantic checks that run after the notation is
// read and BEFORE the IR reaches github.com/tabnas/bnf/go.
//
// The ordering is load-bearing: the shared compiler maps an undefined
// TX/NR/ST/VL reference onto the engine's own lexer tokens — right for
// ABNF, wrong for GBNF, where those are ordinary rule names. Checking
// first means a typo is reported as a typo.
package gbnf

import (
	"fmt"

	bnf "github.com/tabnas/bnf/go"
)

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
