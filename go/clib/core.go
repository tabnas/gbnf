// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// core.go — the library's behaviour, in plain Go.
//
// The cgo layer in gbnf_c.go is a thin shim over this: it converts
// (pointer, length) pairs to Go strings and Go strings to malloc'd C
// strings, and does nothing else. The split is not decoration — Go does
// not support cgo in _test.go files, so anything living beside
// `import "C"` cannot be unit-tested at all. Keeping the logic here is
// what makes the contract testable (core_test.go).
package main

import (
	"encoding/json"
	"strconv"
	"strings"
	"sync"

	bnf "github.com/tabnas/bnf/go"
	gbnf "github.com/tabnas/gbnf/go"
	tabnas "github.com/tabnas/parser/go"
)

// A compiled grammar. The mutex is not optional: a *Tabnas is not safe
// for concurrent Parse, and an FFI caller is under no obligation to
// serialise — CPython, for one, releases the GIL for the duration of a
// ctypes call, so two Python threads reach this at once.
type grammar struct {
	mu sync.Mutex
	tn *tabnas.Tabnas
}

var (
	reg    sync.RWMutex
	nextID int64
	loaded = map[int64]*grammar{}
)

// reply marshals a result document. Marshalling cannot fail for the
// shapes built here, and there is nowhere to report it if it did, so a
// failure degrades to a fixed error document rather than something the
// caller cannot decode.
func reply(v map[string]any) string {
	out, err := json.Marshal(v)
	if err != nil {
		return `{"ok":false,"error":{"code":"internal",` +
			`"message":"result could not be encoded"}}`
	}
	return string(out)
}

func failDoc(code, message string) string {
	return reply(map[string]any{
		"ok":    false,
		"error": map[string]any{"code": code, "message": message},
	})
}

func versionDoc() string {
	return reply(map[string]any{
		"ok": true, "version": gbnf.VERSION, "engine": tabnas.VERSION,
	})
}

// loadGrammar compiles GBNF source and installs it on a fresh instance.
//
// The grammar is installed NATIVELY — compiled straight onto a *Tabnas
// in this process — rather than serialized and reloaded. That is a
// correctness decision, not a performance one: a GBNF grammar's lexing
// configuration (an empty ignore set, every default matcher off,
// negotiated lexing on) IS part of its accepted language, and it travels
// intact through an in-process install. See README for why the
// compile-here-run-there route is a separate question.
func loadGrammar(src string) string {
	tn := tabnas.Make()
	if _, err := gbnf.Install(tn, src, nil); err != nil {
		return failDoc(grammarErrCode(err), firstLine(err.Error()))
	}

	// A grammar with no start rule would accept every input rather than
	// reject it — the worst failure a validator has. GBNF's compiler
	// names the start rule `root`, and a source without one should have
	// failed above; this is the belt to that braces, checked where the
	// handle would otherwise be published.
	start := tn.Config().RuleStart
	if start == "" {
		start = "val"
	}
	if tn.RSM()[start] == nil {
		return failDoc("compile", "grammar defines no start rule "+
			strconv.Quote(start)+", so no input could be validated against it")
	}

	reg.Lock()
	nextID++
	id := nextID
	loaded[id] = &grammar{tn: tn}
	reg.Unlock()
	return reply(map[string]any{"ok": true, "handle": id})
}

// compileSpec compiles GBNF source into a serialized recognition spec —
// pure data that libtabnas (or any tabnas runtime) can load and run
// without this front-end present.
//
// This is the "compile here, validate anywhere" door, and it is a
// SEPARATE question from gbnf_parse. Installing natively keeps the
// grammar's lexing configuration by construction; serializing has to
// carry it deliberately, and until @tabnas/bnf v0.1.5 it did not — the
// emitted spec dropped GBNF's empty ignore set and disabled matchers,
// so a reloaded arithmetic.gbnf lexed "a+b" as one text token and
// rejected "a+b=c". That is why this function did not ship with the
// rest of the surface, and why core_test.go grades what it emits
// against the corpus in both directions rather than merely checking
// that it is valid JSON.
//
// Recognition rather than pure form: the AST does not cross this
// boundary, so the tree-building hooks would be dead weight in a spec
// whose only job is to answer accept/reject.
func compileSpec(src string) string {
	// Builtins: true is required, not optional — ToRecognitionSpec
	// refuses a spec whose actions are still closures, and closures
	// cannot cross a data boundary at all.
	spec, err := gbnf.Gbnf(src, &gbnf.ConvertOptions{Builtins: true})
	if err != nil {
		return failDoc(grammarErrCode(err), firstLine(err.Error()))
	}

	data, err := bnf.ToRecognitionSpec(spec)
	if err != nil {
		return failDoc("compile", firstLine(err.Error()))
	}

	// ToJsonic, not encoding/json: a regex is emitted as an "@/src/flags"
	// sentinel that the engine decodes on load. encoding/json sees the
	// holder's unexported fields and writes {}, which would drop every
	// match token and leave a grammar that lexes nothing.
	return reply(map[string]any{"ok": true, "spec": bnf.ToJsonic(data, true, 0)})
}

// parseWith answers whether src is in the grammar's language.
//
// A rejection is an ANSWER, not a failure of the call: ok:true with
// accept:false. ok:false is reserved for the call itself being wrong —
// an unknown handle, a broken grammar, an engine bug — so a caller can
// tell "your input is not in the language" from "you called me wrong"
// without reading messages.
func parseWith(handle int64, src string) string {
	reg.RLock()
	g := loaded[handle]
	reg.RUnlock()
	if g == nil {
		return failDoc("handle", "no grammar is loaded under that handle")
	}

	g.mu.Lock()
	_, err := g.tn.Parse(src)
	g.mu.Unlock()

	if err != nil {
		code := errCode(err)

		// An "internal" error is the engine's no-panic guarantee firing:
		// a bug in the engine, a matcher or an action, recovered rather
		// than crashing. It is NOT a judgement about the input, and
		// dressing it up as accept:false would hand the caller an
		// authoritative-looking rejection for a question never answered.
		if code == "internal" {
			return failDoc(code, firstLine(err.Error()))
		}

		return reply(map[string]any{
			"ok": true, "accept": false,
			"error": map[string]any{
				"code":    code,
				"message": firstLine(err.Error()),
			},
		})
	}
	return reply(map[string]any{"ok": true, "accept": true})
}

func freeGrammar(handle int64) {
	reg.Lock()
	delete(loaded, handle)
	reg.Unlock()
}

// grammarErrCode separates "your GBNF does not parse" from "your GBNF
// parsed but cannot be compiled". Both are the caller's grammar being
// wrong rather than their input, so both are ok:false — but a tool
// reporting to a human wants to say which.
func grammarErrCode(err error) string {
	switch err.(type) {
	case *gbnf.ParseError:
		return "parse"
	case *gbnf.CompileError:
		return "compile"
	}
	return "grammar"
}

// firstLine trims an engine diagnostic to its headline and strips the
// terminal colouring it carries for humans. A JSON field is neither.
func firstLine(msg string) string {
	if i := strings.IndexByte(msg, '\n'); i >= 0 {
		msg = msg[:i]
	}
	return stripANSI(msg)
}

func stripANSI(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); {
		if s[i] == 0x1b {
			for i < len(s) && s[i] != 'm' {
				i++
			}
			if i < len(s) {
				i++
			}
			continue
		}
		b.WriteByte(s[i])
		i++
	}
	return b.String()
}

// errCode surfaces the engine's own error code when there is one, so a
// caller can branch on the kind of failure rather than on message text.
func errCode(err error) string {
	if te, ok := err.(*tabnas.TabnasError); ok && te.Code != "" {
		return te.Code
	}
	return "error"
}
