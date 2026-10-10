// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

//! A llama.cpp [GBNF](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)
//! grammar compiler for the [`tabnas`](https://github.com/tabnas/parser)
//! parsing engine.
//!
//! GBNF is what llama.cpp, XGrammar, KoboldCpp and LocalAI use to
//! constrain a sampler, and none of them can answer "does this string
//! match my grammar?" without a model. This crate can: it reads GBNF text
//! and emits a tabnas `GrammarSpec`, which parses inputs in that grammar
//! and builds a `{rule, src, kids}` tree.
//!
//! ```text
//! GBNF text ──parse_gbnf──▶ Grammar ──emit_grammar_spec──▶ GrammarSpec
//! ```
//!
//! [`parse_gbnf`] is the notation front-end and is what this crate adds;
//! everything downstream of the IR lives in
//! [`tabnas_bnf`](https://github.com/tabnas/bnf) and is shared with the
//! ABNF and EBNF front-ends. [`render_gbnf`] is the inverse arrow, which
//! turns any of those front-ends' IR back into GBNF text.
//!
//! ```
//! let mut parser = tabnas::Tabnas::new();
//! tabnas_gbnf::gbnf(&mut parser, "root ::= \"hi\" | \"hello\"", None).unwrap();
//! let tree = parser.parse("hello").unwrap();
//! assert_eq!(tree.to_json()["rule"], "root");
//! ```
//!
//! This is the Rust port of the canonical TypeScript implementation in
//! `ts/src`; the TypeScript version is authoritative and this crate
//! tracks it.

pub mod cli;
mod converter;
mod parser_gbnf;
mod render;
mod terminal;

/// The README's Rust examples run as doctests, so a stale one fails the
/// gate rather than misleading the reader. Its `toml` and `bash` fences
/// are skipped; rustdoc runs only the `rust` ones.
#[cfg(doctest)]
#[doc = include_str!("../README.md")]
mod readme_examples {}

use std::fmt;

use tabnas::{Plugin, PluginError, Tabnas, Value};

pub use converter::{parse_gbnf, GbnfCompileError, GbnfParseError};
pub use parser_gbnf::gbnf_rules;
pub use render::{render_gbnf, GbnfRenderError, GbnfRenderOptions};

pub use tabnas_bnf::{
    eliminate_left_recursion, ConvertOptions, Element, EmitError, Grammar, GrammarSpec, Kind,
    NodeKind, Production, Sequence, SrcSpan,
};

/// The IR types under this crate's own names, mirroring the aliases
/// `ts/src/converter.ts` exports and the `GbnfElement` family in
/// `go/facade.go`. Aliases, not definitions: a value has to cross the
/// package boundary.
pub type GbnfElement = Element;
/// One alternative of a production.
pub type GbnfSequence = Sequence;
/// One production of the IR.
pub type GbnfProduction = Production;
/// A whole grammar in the IR.
pub type GbnfGrammar = Grammar;

/// This crate's version. It MUST equal `ts/package.json` "version": the
/// release orchestrator rewrites both, and `tests/version_test.rs` fails
/// the build if they drift. Mirrors `VERSION` in `ts/src/gbnf.ts` and
/// `const VERSION` in `go/gbnf.go`.
pub const VERSION: &str = "0.1.17";

/// The group tag stamped on every emitted alt, and the prefix of every
/// diagnostic this crate raises.
pub const TAG: &str = "gbnf";

/// GBNF's mandatory start symbol. llama.cpp refuses a grammar without a
/// rule of this name, and so does [`parse_gbnf`].
pub const START: &str = "root";

/// Anything that can go wrong turning GBNF source into a grammar.
#[derive(Debug, Clone, PartialEq)]
pub enum GbnfError {
    /// The GBNF source itself could not be read.
    Parse(GbnfParseError),
    /// The source parsed, but does not describe a grammar this compiler
    /// can build.
    Compile(GbnfCompileError),
    /// The shared compiler refused the grammar.
    Emit(EmitError),
    /// The engine refused the emitted grammar.
    Install(String),
}

impl fmt::Display for GbnfError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Parse(error) => error.fmt(formatter),
            Self::Compile(error) => error.fmt(formatter),
            Self::Emit(error) => formatter.write_str(&restamp(&error.message)),
            Self::Install(message) => formatter.write_str(message),
        }
    }
}

impl std::error::Error for GbnfError {}

impl From<GbnfParseError> for GbnfError {
    fn from(error: GbnfParseError) -> Self {
        Self::Parse(error)
    }
}

impl From<GbnfCompileError> for GbnfError {
    fn from(error: GbnfCompileError) -> Self {
        Self::Compile(error)
    }
}

impl From<EmitError> for GbnfError {
    fn from(error: EmitError) -> Self {
        Self::Emit(error)
    }
}

impl GbnfError {
    /// The class name a report carries for this failure, matching the
    /// canonical `Error.name`: `GbnfParseError`, `GbnfCompileError`, or
    /// the shared compiler's own class.
    pub fn name(&self) -> &'static str {
        match self {
            Self::Parse(_) => "GbnfParseError",
            Self::Compile(_) => "GbnfCompileError",
            Self::Emit(_) => "EmitError",
            Self::Install(_) => "GbnfInstallError",
        }
    }

    /// The production the failure is about, when one is named.
    pub fn rule(&self) -> Option<&str> {
        match self {
            Self::Compile(error) => error.rule.as_deref(),
            Self::Emit(error) => error.rule.as_deref(),
            _ => None,
        }
    }

    /// The range that underlines the offender, when there is one.
    pub fn span(&self) -> Option<&SrcSpan> {
        match self {
            Self::Compile(error) => error.sp.as_ref(),
            Self::Emit(error) => error.sp.as_ref(),
            _ => None,
        }
    }

    /// The 1-based line, when the failure named one.
    pub fn line(&self) -> Option<usize> {
        match self {
            Self::Parse(error) => error.line,
            _ => None,
        }
    }

    /// The 1-based column, when the failure named one.
    pub fn column(&self) -> Option<usize> {
        match self {
            Self::Parse(error) => error.column,
            _ => None,
        }
    }

    /// The engine's own error code, when the failure came from the
    /// engine.
    pub fn code(&self) -> Option<&str> {
        match self {
            Self::Parse(error) => error.code.as_deref(),
            _ => None,
        }
    }
}

/// Restamp a shared-compiler diagnostic as this front-end's, so a caller
/// sees one error vocabulary regardless of which layer failed. The same
/// thing `restamp` does in `go/facade.go`.
fn restamp(message: &str) -> String {
    for prefix in ["bnf: ", "abnf: "] {
        if let Some(rest) = message.strip_prefix(prefix) {
            return format!("gbnf: {rest}");
        }
    }
    message.to_string()
}

/// Options for [`gbnf_convert`]: the shared compiler's options plus this
/// front-end's own knob.
///
/// The Rust spelling of the TypeScript `GbnfConvertOptions`, which is
/// `ConvertOptions & { eagerClasses?: boolean }`. `start` defaults to
/// `root` and `tag` to `gbnf`, so a caller that wants the notation's own
/// defaults passes nothing at all.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GbnfConvertOptions {
    /// What to pass through to the shared compiler.
    pub convert: ConvertOptions,
    /// Let character-class tokens fire regardless of what the active rule
    /// expects, when the grammar's classes are provably unambiguous. On
    /// by default; set false to keep the engine's rule-directed lexing.
    pub eager_classes: bool,
}

impl Default for GbnfConvertOptions {
    fn default() -> Self {
        Self {
            convert: ConvertOptions::default(),
            eager_classes: true,
        }
    }
}

impl GbnfConvertOptions {
    /// Compiler options alone, with eager classes left on.
    pub fn new(convert: ConvertOptions) -> Self {
        Self {
            convert,
            eager_classes: true,
        }
    }

    /// The same options with the eager-class decision set.
    pub fn eager_classes(mut self, on: bool) -> Self {
        self.eager_classes = on;
        self
    }

    /// The same options starting at `start` rather than `root`.
    pub fn start(mut self, start: impl Into<String>) -> Self {
        self.convert.start = Some(start.into());
        self
    }

    /// The same options stamping `tag` rather than `gbnf`.
    pub fn tag(mut self, tag: impl Into<String>) -> Self {
        self.convert.tag = Some(tag.into());
        self
    }
}

/// Emit a spec from an already-parsed GBNF grammar.
///
/// The shared compiler's emitter under this crate's name, exactly as
/// `ts/src/converter.ts` re-exports `emitGrammarSpec` from
/// `@tabnas/bnf`: the COMPILER's defaults, not the notation's. Passing
/// nothing therefore starts at the first production and stamps the
/// shared tag, which is what the canonical export does with the same
/// arguments.
///
/// [`gbnf_convert`] is the notation's entry point, and it is what
/// supplies GBNF's own `root` start and `gbnf` tag.
pub fn emit_grammar_spec(
    grammar: &Grammar,
    opts: Option<&ConvertOptions>,
) -> Result<GrammarSpec, EmitError> {
    let options = opts.cloned().unwrap_or_default();
    tabnas_bnf::emit_grammar_spec(grammar, &options)
}

/// The compiler options GBNF's own defaults fill in: `root` for the
/// start symbol, which the notation mandates, and `gbnf` for the group
/// tag the emitted alts carry. An explicit value still wins, including
/// an explicitly empty one, because the canonical uses `??` here and not
/// `||`.
fn notation_defaults(opts: Option<&GbnfConvertOptions>) -> ConvertOptions {
    let mut options = opts.map(|opts| opts.convert.clone()).unwrap_or_default();
    if options.start.is_none() {
        options.start = Some(START.to_string());
    }
    if options.tag.is_none() {
        options.tag = Some(TAG.to_string());
    }
    options
}

/// Convert GBNF source into a tabnas grammar spec, without installing it.
/// The Rust spelling of `tn.gbnf.toSpec(src)`.
///
/// ```
/// let spec = tabnas_gbnf::gbnf_convert("root ::= \"a\"", None).unwrap();
/// assert!(spec.rule.contains_key("root"));
/// ```
pub fn gbnf_convert(
    src: &str,
    opts: Option<&GbnfConvertOptions>,
) -> Result<GrammarSpec, GbnfError> {
    let grammar = parse_gbnf(src)?;
    let convert = notation_defaults(opts);
    let eager_classes = opts.is_none_or(|opts| opts.eager_classes);
    let mut spec = emit_grammar_spec(&grammar, Some(&convert))?;
    converter::apply_exact_lexing(&mut spec.options);
    let eager = eager_classes && converter::mark_classes_eager(&grammar, &mut spec.options);
    if !eager {
        converter::clear_classes_eager(&mut spec.options);
    }
    Ok(spec)
}

/// [`gbnf_convert`] under the name the TypeScript package uses.
pub fn to_spec(src: &str, opts: Option<&GbnfConvertOptions>) -> Result<GrammarSpec, GbnfError> {
    gbnf_convert(src, opts)
}

/// Convert GBNF source and install the resulting grammar on `parser`.
///
/// The Rust spelling of the callable `tn.gbnf(src, opts)` the canonical
/// plugin decorates an instance with. Installing is what switches the
/// instance to GBNF's exact lexing: the spec carries an empty ignore set
/// and no default matchers, and those settings are instance-wide. Use a
/// FRESH instance per grammar, because a second grammar installed over
/// the first inherits them.
///
/// ```
/// let mut parser = tabnas::Tabnas::new();
/// tabnas_gbnf::gbnf(&mut parser, "root ::= [a-z]+", None).unwrap();
/// assert!(parser.parse("abc").is_ok());
/// assert!(parser.parse("ABC").is_err());
/// ```
pub fn gbnf(
    parser: &mut Tabnas,
    src: &str,
    opts: Option<&GbnfConvertOptions>,
) -> Result<GrammarSpec, GbnfError> {
    let spec = gbnf_convert(src, opts)?;
    spec.install(parser)
        .map_err(|error| GbnfError::Install(error.to_string()))?;
    Ok(spec)
}

/// The plugin descriptor, for `Tabnas::use_plugin`.
///
/// A grammar this crate installs is whatever GBNF the caller hands over,
/// so the plugin has nothing of its own to install. Pass
/// `{"src": "<gbnf text>"}` in the option bag to have it convert and
/// install that source; otherwise call [`gbnf`] directly, which is the
/// typed way in.
pub fn plugin() -> Plugin {
    Plugin::new("Gbnf", |parser, options| {
        let source = match options {
            Value::Object(entries) => match entries.get("src") {
                Some(Value::String(src)) => Some(src.clone()),
                _ => None,
            },
            _ => None,
        };
        let Some(source) = source else {
            return Ok(());
        };
        gbnf(parser, &source, None)
            .map(|_| ())
            .map_err(|error| PluginError(error.to_string()))
    })
}

/// One optional alchemy translation source and its explicit entry point.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TranslationPart {
    /// The definition a host calls after linking the source.
    pub entry: &'static str,
    /// The source text, or `None` for an entry supplied by alchemy.
    pub source: Option<&'static str>,
}

/// The package-local structural translation interface.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TranslationParts {
    /// The complete `tabnas.plugin.json` text.
    pub manifest: &'static str,
    /// An optional lift from the grammar's events to its first read shape.
    pub lift: Option<TranslationPart>,
    /// An optional embedding of a plain tree in the format's schema, with its reverse.
    pub embed: Option<TranslationPart>,
    /// An optional render from the write shape to text.
    pub render: Option<TranslationPart>,
}

const TRANSLATION: TranslationParts = TranslationParts {
    manifest: include_str!("../translate/manifest.json"),
    lift: None,
    embed: None,
    render: Some(TranslationPart {
        entry: "gbnf-render",
        source: Some(include_str!("../translate/render.alc")),
    }),
};

/// Return the translation parts of GBNF documents: the manifest, and the
/// render that writes a grammar spec, the GrammarSpec the compiler emits
/// for a grammar, back as GBNF. There is no lift and no embed: a host
/// reads a document by compiling it (`tabnas_bnf::compile_spec` over
/// [`gbnf_convert`] with `builtins` on, `recognition` false and `strict`
/// true, the text the TypeScript compiler writes byte for byte), and the
/// tree is the spec's own shape, the schema `grammar-spec`, which ABNF and
/// EBNF share. [`render_gbnf`] writes GBNF from the IR a document parses
/// to; the render writes it from the spec, spelling each terminal as
/// [`render_gbnf`] does.
///
/// ```
/// let parts = tabnas_gbnf::translate().expect("gbnf carries translation parts");
/// assert_eq!(parts.render.map(|part| part.entry), Some("gbnf-render"));
/// assert_eq!(parts.embed, None);
/// ```
#[must_use]
pub const fn translate() -> Option<TranslationParts> {
    Some(TRANSLATION)
}

/// The plugin's manifest, `tabnas.plugin.json`, as the repository carries
/// it. Its `translate` object is what a host that translates reads: the
/// shape a document is read as and written from (`tree`), the schema of
/// that tree (`grammar-spec`), the root the render needs (`object`), the
/// file that holds the render, and the sentences that say what a written
/// grammar does not keep. The crate embeds its own copy,
/// `translate/manifest.json`, since a packaged crate holds nothing outside
/// `rs/`; `tests/translate_test.rs` holds the copy to the file.
///
/// ```
/// assert!(tabnas_gbnf::manifest_text().contains("\"grammar-spec\""));
/// ```
pub fn manifest_text() -> &'static str {
    TRANSLATION.manifest
}

/// The render, `alchemy/render.alc`, the file the manifest's
/// `translate.render` names: a library of alchemy definitions, with no
/// `export`, whose entry point `gbnf-render` writes a grammar spec's
/// events as one GBNF document that compiles back to the same spec. A
/// host links it with its own program. The crate embeds its own copy,
/// `translate/render.alc`, held to the file as the manifest's is.
///
/// ```
/// assert!(tabnas_gbnf::render_text().contains("def gbnf-render [input]"));
/// ```
pub fn render_text() -> &'static str {
    match TRANSLATION.render {
        Some(part) => part.source.unwrap_or_default(),
        None => "",
    }
}
