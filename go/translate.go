/* Copyright (c) 2026 Richard Rodger and other contributors, MIT License */

package gbnf

import _ "embed"

// TranslationPart is one optional alchemy source and the entry point a host calls.
type TranslationPart struct {
	Entry  string
	Source string
}

// TranslationParts is the package-local structural translation interface.
type TranslationParts struct {
	Manifest  string
	Lift      *TranslationPart
	Embed     *TranslationPart
	Render    *TranslationPart
	Transduce *TranslationPart
	// Spec is the render of the grammar-spec route, the manifest's
	// translate.spec: a compiled grammar spec written back as GBNF.
	Spec *TranslationPart
}

//go:embed translate/manifest.json
var translationManifest string

//go:embed translate/render.alc
var translationRender string

//go:embed translate/transduce.alc
var translationTransduce string

//go:embed translate/render-spec.alc
var translationRenderSpec string

var translationParts = TranslationParts{
	Manifest:  translationManifest,
	Render:    &TranslationPart{Entry: "gbnf-render", Source: translationRender},
	Transduce: &TranslationPart{Entry: "gbnf-transduce", Source: translationTransduce},
	Spec:      &TranslationPart{Entry: "gbnf-render-spec", Source: translationRenderSpec},
}

// Translate returns the translation parts of GBNF documents: the
// manifest, the part that streams a document's tree, its rules in source
// order (the schema grammar-rules, which ABNF and EBNF share), from the
// rule passes of Make(), and the render that writes such a tree back as
// GBNF; and, as Spec, the render of the grammar-spec route, which writes
// the GrammarSpec the compiler emits back as GBNF. There is no lift and no
// embed. Each call returns a copy of its own, so that what one caller
// changes is not what another reads.
func Translate() *TranslationParts {
	parts := translationParts
	parts.Lift = copyPart(parts.Lift)
	parts.Embed = copyPart(parts.Embed)
	parts.Render = copyPart(parts.Render)
	parts.Transduce = copyPart(parts.Transduce)
	parts.Spec = copyPart(parts.Spec)
	return &parts
}

// copyPart is a part of its own, so that no caller reaches another's.
func copyPart(part *TranslationPart) *TranslationPart {
	if part == nil {
		return nil
	}
	copied := *part
	return &copied
}
