// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

//! `gbnf-check`: offline GBNF validation from the command line. The Rust
//! port of `ts/src/cli.ts`, which has no Go counterpart.
//!
//! Compiles a grammar with [`crate::gbnf`] and checks sample inputs with
//! the engine, so "would the sampler have been allowed to emit this?"
//! needs no model in the loop. The exit code alone answers it for shell
//! scripts and continuous integration; `--json` emits a stable
//! machine-readable report for tooling and agents.
//!
//! Exit codes:
//!
//! | Code | Means |
//! |---|---|
//! | 0 | the grammar compiles and every sample was accepted |
//! | 1 | the grammar compiles but at least one sample was rejected |
//! | 2 | the grammar does not compile |
//! | 3 | usage or input failure |
//!
//! Newlines are the classic footgun: `echo hi > s.txt` writes `"hi\n"`,
//! and a grammar with no trailing-newline rule rejects that. The default
//! stays exact, because silently stripping input would change the
//! accepted language, the one thing this crate must never do. A rejection
//! is re-checked without one final newline instead, and a hint is
//! reported when that parse would have succeeded;
//! `--strip-final-newline` makes the stripping explicit.
//!
//! [`run`] takes its streams as arguments so the tests drive it in
//! process, the seam `main(argv)` gives the TypeScript command.

use std::io::{Read, Write};

use serde_json::{json, Map, Value as Json};
use tabnas::Tabnas;

use crate::{gbnf, GbnfError, VERSION};

const KNOWN_GAPS_URL: &str = "https://github.com/tabnas/gbnf/blob/main/ts/doc/known-gaps.md";

/// The help text, byte for byte the canonical command's.
pub const USAGE: &str = concat!(
    "usage: gbnf-check [options] <grammar.gbnf | -> [sample-file ...]\n",
    "\n",
    "Compile a GBNF grammar and check sample inputs against it \u{2014} offline,\n",
    "without a model. With no samples the grammar is only compiled.\n",
    "\n",
    "The grammar is read from the named file, or from stdin when the\n",
    "argument is '-'. Each sample must match the grammar in FULL: GBNF is\n",
    "scannerless, so every character counts, trailing newlines included.\n",
    "\n",
    "options:\n",
    "  -t, --text <s>          check <s> itself instead of reading a file\n",
    "                          (repeatable; checked after the file samples)\n",
    "      --stdin             read one sample from stdin (not with a '-'\n",
    "                          grammar)\n",
    "      --json              write a machine-readable JSON report to stdout\n",
    "      --ast               include each accepted sample's AST in the\n",
    "                          report\n",
    "      --strip-final-newline\n",
    "                          remove one trailing newline from every sample\n",
    "                          before parsing\n",
    "  -q, --quiet             no report; the exit code is the answer\n",
    "  -h, --help              this text\n",
    "  -v, --version           print the package version\n",
    "\n",
    "exit codes:\n",
    "  0  the grammar compiles and every sample was accepted\n",
    "  1  the grammar compiles but at least one sample was rejected\n",
    "  2  the grammar does not compile\n",
    "  3  usage or I/O error\n",
    "\n",
    "examples:\n",
    "  gbnf-check chess.gbnf                    # does the grammar compile?\n",
    "  gbnf-check chess.gbnf moves.txt          # does the file match it?\n",
    "  gbnf-check json.gbnf --text '{\"a\":1}'    # does this string match?\n",
    "  gbnf-check json.gbnf --stdin < out.json  # pipe a sample in\n",
    "  gbnf-check json.gbnf --text '{}' --json  # JSON report, for tooling\n",
    "\n",
    "A rejection is this engine's answer, not always the grammar's: a\n",
    "grammar that needs backtracking can reject here and still constrain a\n",
    "sampler correctly. See https://github.com/tabnas/gbnf/blob/main/ts/doc/known-gaps.md.\n",
    "The compiler also accepts a superset of llama.cpp's line-break rules,\n",
    "so check a new grammar with llama-gbnf-validator before shipping it to\n",
    "a sampler.\n",
);

// ---- argument parsing -------------------------------------------------

#[derive(Debug, Default, Clone)]
struct Flags {
    text: Vec<String>,
    stdin: bool,
    json: bool,
    ast: bool,
    strip_final_newline: bool,
    quiet: bool,
    help: bool,
    version: bool,
}

/// One entry of the option table `ts/src/cli.ts` hands `parseArgs`.
struct OptionSpec {
    long: &'static str,
    short: Option<char>,
    /// `text` is the only option that takes a value; the rest are
    /// booleans, and `parseArgs` treats the two kinds differently at
    /// almost every turn.
    takes_value: bool,
}

/// The table itself, in the canonical command's order.
const OPTIONS: &[OptionSpec] = &[
    OptionSpec {
        long: "text",
        short: Some('t'),
        takes_value: true,
    },
    OptionSpec {
        long: "stdin",
        short: None,
        takes_value: false,
    },
    OptionSpec {
        long: "json",
        short: None,
        takes_value: false,
    },
    OptionSpec {
        long: "ast",
        short: None,
        takes_value: false,
    },
    OptionSpec {
        long: "strip-final-newline",
        short: None,
        takes_value: false,
    },
    OptionSpec {
        long: "quiet",
        short: Some('q'),
        takes_value: false,
    },
    OptionSpec {
        long: "help",
        short: Some('h'),
        takes_value: false,
    },
    OptionSpec {
        long: "version",
        short: Some('v'),
        takes_value: false,
    },
];

fn by_long(name: &str) -> Option<&'static OptionSpec> {
    OPTIONS.iter().find(|option| option.long == name)
}

fn by_short(name: char) -> Option<&'static OptionSpec> {
    OPTIONS.iter().find(|option| option.short == Some(name))
}

/// How `parseArgs` names an option in a diagnostic: `-t, --text` when
/// there is a short alias, `--stdin` when there is not.
fn label(option: &OptionSpec) -> String {
    match option.short {
        Some(short) => format!("-{short}, --{}", option.long),
        None => format!("--{}", option.long),
    }
}

/// `parseArgs`'s unknown-option message, reproduced exactly, unbalanced
/// closing quote and all: a caller matching on it should see the same
/// string from either runtime.
fn unknown_option(raw: &str) -> String {
    format!(
        "Unknown option '{raw}'. To specify a positional argument starting with a '-', \
         place it at the end of the command after '--', as in '-- \"{raw}\""
    )
}

/// `parseArgs`'s complaint about a value that looks like another option.
/// The hint names the short spelling only when the short spelling was
/// what the caller wrote.
fn ambiguous_value(raw: &str, option: &OptionSpec) -> String {
    let mut hint = format!("'--{}=-XYZ'", option.long);
    if !raw.starts_with("--") {
        if let Some(short) = option.short {
            hint.push_str(&format!(" or '-{short}-XYZ'"));
        }
    }
    format!(
        "Option '{raw}' argument is ambiguous.\n\
         Did you forget to specify the option argument for '{raw}'?\n\
         To specify an option argument starting with a dash use {hint}."
    )
}

/// Parse the argument vector the way `node:util` `parseArgs` does for the
/// option table in `ts/src/cli.ts`.
///
/// Faithful rather than approximate, because the command's standard-error
/// text is part of its contract and `parseArgs` has more shapes than the
/// obvious ones: `--text=value` and `-tvalue` both carry a value, `-qh`
/// is a GROUP of two boolean shorts, a group ends the moment it reaches
/// an option that takes a value (`-qthello` is `--quiet --text hello`), a
/// boolean given `=value` is an error rather than a flag, and a value
/// that starts with a dash is refused as ambiguous rather than swallowed.
/// Everything after a `--` separator is a positional.
fn parse_args(argv: &[String]) -> Result<(Flags, Vec<String>), String> {
    let mut flags = Flags::default();
    let mut positionals: Vec<String> = Vec::new();
    // A queue rather than an index, because expanding a short group
    // pushes tokens back to the front the way `parseArgs` does.
    let mut pending: std::collections::VecDeque<String> = argv.iter().cloned().collect();
    let mut options_done = false;

    while let Some(argument) = pending.pop_front() {
        if options_done {
            positionals.push(argument);
            continue;
        }
        if "--" == argument {
            options_done = true;
            continue;
        }

        // A long option, `--name` or `--name=value`.
        if let Some(rest) = argument.strip_prefix("--") {
            if rest.is_empty() {
                positionals.push(argument);
                continue;
            }
            let (name, inline) = match rest.split_once('=') {
                Some((name, value)) => (name, Some(value.to_string())),
                None => (rest, None),
            };
            let Some(option) = by_long(name) else {
                return Err(unknown_option(&format!("--{name}")));
            };
            take(
                &mut flags,
                option,
                &format!("--{name}"),
                inline,
                &mut pending,
            )?;
            continue;
        }

        // A short option, a short group, or a short option with its value
        // attached. A bare `-` is the stdin grammar, a positional.
        let is_short = argument.starts_with('-') && 1 < argument.len();
        if !is_short {
            positionals.push(argument);
            continue;
        }

        let body: Vec<char> = argument.chars().skip(1).collect();
        let first = body[0];
        let leading = by_short(first);

        if 1 < body.len() {
            // A group, unless the FIRST short takes a value, in which
            // case the rest of the token is that value.
            if leading.is_some_and(|option| option.takes_value) {
                let value: String = body[1..].iter().collect();
                let option = leading.expect("checked above");
                take(
                    &mut flags,
                    option,
                    &format!("-{first}"),
                    Some(value),
                    &mut pending,
                )?;
                continue;
            }
            // Expand the group, stopping at the first short that takes a
            // value: everything from there on is its value.
            let mut expanded: Vec<String> = Vec::new();
            for (index, short) in body.iter().enumerate() {
                let takes_value = by_short(*short).is_some_and(|option| option.takes_value);
                if takes_value && index < body.len() - 1 {
                    expanded.push(format!("-{}", body[index..].iter().collect::<String>()));
                    break;
                }
                expanded.push(format!("-{short}"));
            }
            for token in expanded.into_iter().rev() {
                pending.push_front(token);
            }
            continue;
        }

        let Some(option) = leading else {
            return Err(unknown_option(&format!("-{first}")));
        };
        take(&mut flags, option, &format!("-{first}"), None, &mut pending)?;
    }

    Ok((flags, positionals))
}

/// Record one matched option, reading its value from `inline` or from the
/// next token, and raising the diagnostics `parseArgs` raises.
fn take(
    flags: &mut Flags,
    option: &OptionSpec,
    raw: &str,
    inline: Option<String>,
    pending: &mut std::collections::VecDeque<String>,
) -> Result<(), String> {
    if !option.takes_value {
        if inline.is_some() {
            return Err(format!(
                "Option '{}' does not take an argument",
                label(option)
            ));
        }
        match option.long {
            "stdin" => flags.stdin = true,
            "json" => flags.json = true,
            "ast" => flags.ast = true,
            "strip-final-newline" => flags.strip_final_newline = true,
            "quiet" => flags.quiet = true,
            "help" => flags.help = true,
            "version" => flags.version = true,
            other => unreachable!("the option table has no boolean {other}"),
        }
        return Ok(());
    }

    let value = match inline {
        Some(value) => value,
        None => match pending.front() {
            None => {
                return Err(format!(
                    "Option '{} <value>' argument missing",
                    label(option)
                ))
            }
            // A value that starts with a dash is refused rather than
            // swallowed: it is far more often a forgotten argument than a
            // value that really begins with one.
            Some(next) if next.starts_with('-') => return Err(ambiguous_value(raw, option)),
            Some(_) => pending.pop_front().expect("checked above"),
        },
    };

    match option.long {
        "text" => flags.text.push(value),
        other => unreachable!("the option table has no valued {other}"),
    }
    Ok(())
}

// ---- the report shapes ------------------------------------------------

/// One error, normalised for the report.
///
/// Compile failures carry `rule` (a compile error) or `line` / `column`
/// (a parse error); the engine's own parse failures carry `code`
/// (`unexpected`, …) and a position. Only the fields the error actually
/// has appear.
fn error_info(
    name: &str,
    message: &str,
    code: Option<&str>,
    rule: Option<&str>,
    line: Option<usize>,
    column: Option<usize>,
) -> Map<String, Json> {
    let mut info = Map::new();
    info.insert("name".into(), json!(name));
    info.insert("message".into(), json!(first_line(&strip_ansi(message))));
    if let Some(code) = code {
        info.insert("code".into(), json!(code));
    }
    if let Some(rule) = rule {
        info.insert("rule".into(), json!(rule));
    }
    if let Some(line) = line {
        info.insert("line".into(), json!(line));
    }
    if let Some(column) = column {
        info.insert("column".into(), json!(column));
    }
    info
}

/// A grammar failure, as the report carries it.
///
/// NO `code`, deliberately. The canonical command reads `e.code` off the
/// thrown error, and a `GbnfParseError` wrapping an engine refusal does
/// not carry one there: the engine's own error is on `.cause`, and the
/// wrapper is what the report sees. This port's `GbnfParseError` DOES
/// keep the engine's code, because a Rust caller has no `.cause` to
/// reach for, but putting it in the report would add a field to a
/// contract the other runtime does not have. A sample failure is the
/// other way round and does carry one; see `parse_error_info`.
fn compile_error_info(error: &GbnfError) -> Map<String, Json> {
    error_info(
        error.name(),
        &error.to_string(),
        None,
        error.rule(),
        error.line(),
        error.column(),
    )
}

/// The engine's own parse failure. `SyntaxError` is the class name the
/// canonical runtime reports for it, and the report carries that name
/// rather than this port's type name: a consumer switching on it must
/// read the same value from either runtime.
fn parse_error_info(error: &tabnas::TabnasError) -> Map<String, Json> {
    error_info(
        "SyntaxError",
        &error.to_string(),
        Some(&error.code),
        None,
        (0 != error.row).then_some(error.row),
        (0 != error.col).then_some(error.col),
    )
}

/// The engine colors its messages for terminals; a report has to carry
/// the text alone. Spelled out rather than borrowed from a crate: the
/// canonical pattern is `\x1b\[[0-9;]*m`, and nothing wider.
fn strip_ansi(text: &str) -> String {
    let bytes: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut i = 0usize;
    while i < bytes.len() {
        if '\u{1b}' == bytes[i] && Some(&'[') == bytes.get(i + 1) {
            let mut j = i + 2;
            while j < bytes.len() && (bytes[j].is_ascii_digit() || ';' == bytes[j]) {
                j += 1;
            }
            if j < bytes.len() && 'm' == bytes[j] {
                i = j + 1;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    out
}

/// The text up to the first line feed, which is the canonical command's
/// `String(...).split('\n')[0]`.
///
/// NOT `str::lines`, which also strips a carriage return before that
/// feed. The engine quotes the offending characters into its message, so
/// a sample holding a `\r` produces a message whose first line ends in
/// one, and the two runtimes would report different text for it.
fn first_line(text: &str) -> &str {
    match text.find('\n') {
        Some(at) => &text[..at],
        None => text,
    }
}

fn describe_error(info: &Map<String, Json>) -> String {
    let message = info
        .get("message")
        .and_then(Json::as_str)
        .unwrap_or_default();
    let line = info.get("line").and_then(Json::as_u64);
    let column = info.get("column").and_then(Json::as_u64);
    // A parse error already embeds its location in the message
    // ('gbnf: parse error at line L, column C: ...'); only append one
    // when the message does not carry it, as the engine's errors do not.
    match (line, column) {
        (Some(line), Some(column)) if !message.contains(&format!("line {line}")) => {
            format!("{message} (line {line}, column {column})")
        }
        _ => message.to_string(),
    }
}

/// The length the report states: UTF-16 code units, as the canonical
/// command's `String.prototype.length` counts them, so the two runtimes
/// agree on a sample holding an astral character.
fn utf16_len(text: &str) -> usize {
    text.chars().map(char::len_utf16).sum()
}

/// Remove one trailing newline, `\r\n` or `\n`, and nothing more. The
/// canonical `text.replace(/\r?\n$/, '')`.
fn strip_one_final_newline(text: &str) -> String {
    match text.strip_suffix('\n') {
        Some(rest) => rest.strip_suffix('\r').unwrap_or(rest).to_string(),
        None => text.to_string(),
    }
}

fn ends_with_newline(text: &str) -> bool {
    text.ends_with('\n')
}

// ---- the command ------------------------------------------------------

struct Sample {
    source: String,
    text: String,
}

/// A usage or input failure. When the caller asked for `--json` the
/// report contract holds even here, because tooling should never have to
/// parse prose; otherwise prose goes to standard error.
fn usage_fail(
    message: &str,
    want_json: bool,
    stdout: &mut dyn Write,
    stderr: &mut dyn Write,
) -> i32 {
    if want_json {
        let doc = json!({
            "tool": "gbnf-check",
            "version": VERSION,
            "ok": false,
            "exit": 3,
            "error": { "name": "UsageError", "message": message },
        });
        let _ = writeln!(stdout, "{}", pretty(&doc));
    } else {
        let _ = write!(
            stderr,
            "gbnf-check: {message}\nrun 'gbnf-check --help' for usage\n"
        );
    }
    3
}

fn pretty(value: &Json) -> String {
    serde_json::to_string_pretty(value).unwrap_or_else(|_| "null".to_string())
}

/// libuv's error table, which is where the canonical command's input
/// failures get their words.
///
/// Node renders a file-system failure as
/// `CODE: message, syscall` plus ` 'path'` where the call named one, and
/// `message` is `uv_strerror`'s, not the operating system's. Rust's
/// `io::Error` renders the SAME condition as
/// `No such file or directory (os error 2)`, so a port that printed it
/// would report a different sentence for the same file. The command's
/// standard error is part of its contract, so the table is carried here
/// instead.
///
/// Taken verbatim from `util.getSystemErrorMap()` on Node 22, restricted
/// to the operating-system range: the `EAI_*` resolver codes and libuv's
/// own `UNKNOWN` / `EOF` sentinels are not errno values and cannot reach
/// `io::Error::raw_os_error`.
const UV_ERRORS: &[(i32, &str, &str)] = &[
    (1, "EPERM", "operation not permitted"),
    (2, "ENOENT", "no such file or directory"),
    (3, "ESRCH", "no such process"),
    (4, "EINTR", "interrupted system call"),
    (5, "EIO", "i/o error"),
    (6, "ENXIO", "no such device or address"),
    (7, "E2BIG", "argument list too long"),
    (8, "ENOEXEC", "exec format error"),
    (9, "EBADF", "bad file descriptor"),
    (11, "EAGAIN", "resource temporarily unavailable"),
    (12, "ENOMEM", "not enough memory"),
    (13, "EACCES", "permission denied"),
    (14, "EFAULT", "bad address in system call argument"),
    (16, "EBUSY", "resource busy or locked"),
    (17, "EEXIST", "file already exists"),
    (18, "EXDEV", "cross-device link not permitted"),
    (19, "ENODEV", "no such device"),
    (20, "ENOTDIR", "not a directory"),
    (21, "EISDIR", "illegal operation on a directory"),
    (22, "EINVAL", "invalid argument"),
    (23, "ENFILE", "file table overflow"),
    (24, "EMFILE", "too many open files"),
    (25, "ENOTTY", "inappropriate ioctl for device"),
    (26, "ETXTBSY", "text file is busy"),
    (27, "EFBIG", "file too large"),
    (28, "ENOSPC", "no space left on device"),
    (29, "ESPIPE", "invalid seek"),
    (30, "EROFS", "read-only file system"),
    (31, "EMLINK", "too many links"),
    (32, "EPIPE", "broken pipe"),
    (34, "ERANGE", "result too large"),
    (36, "ENAMETOOLONG", "name too long"),
    (38, "ENOSYS", "function not implemented"),
    (39, "ENOTEMPTY", "directory not empty"),
    (40, "ELOOP", "too many symbolic links encountered"),
    (49, "EUNATCH", "protocol driver not attached"),
    (61, "ENODATA", "no data available"),
    (64, "ENONET", "machine is not on the network"),
    (71, "EPROTO", "protocol error"),
    (75, "EOVERFLOW", "value too large for defined data type"),
    (84, "EILSEQ", "illegal byte sequence"),
    (88, "ENOTSOCK", "socket operation on non-socket"),
    (89, "EDESTADDRREQ", "destination address required"),
    (90, "EMSGSIZE", "message too long"),
    (91, "EPROTOTYPE", "protocol wrong type for socket"),
    (92, "ENOPROTOOPT", "protocol not available"),
    (93, "EPROTONOSUPPORT", "protocol not supported"),
    (94, "ESOCKTNOSUPPORT", "socket type not supported"),
    (95, "ENOTSUP", "operation not supported on socket"),
    (97, "EAFNOSUPPORT", "address family not supported"),
    (98, "EADDRINUSE", "address already in use"),
    (99, "EADDRNOTAVAIL", "address not available"),
    (100, "ENETDOWN", "network is down"),
    (101, "ENETUNREACH", "network is unreachable"),
    (103, "ECONNABORTED", "software caused connection abort"),
    (104, "ECONNRESET", "connection reset by peer"),
    (105, "ENOBUFS", "no buffer space available"),
    (106, "EISCONN", "socket is already connected"),
    (107, "ENOTCONN", "socket is not connected"),
    (
        108,
        "ESHUTDOWN",
        "cannot send after transport endpoint shutdown",
    ),
    (110, "ETIMEDOUT", "connection timed out"),
    (111, "ECONNREFUSED", "connection refused"),
    (112, "EHOSTDOWN", "host is down"),
    (113, "EHOSTUNREACH", "host is unreachable"),
    (114, "EALREADY", "connection already in progress"),
    (121, "EREMOTEIO", "remote I/O error"),
    (125, "ECANCELED", "operation canceled"),
];

/// One input failure, in the words the canonical command uses.
///
/// `syscall` is the call that failed, and `path` is present exactly when
/// node's own call carries one: `open` names the file, `read` does not,
/// which is why a directory reads as `EISDIR: illegal operation on a
/// directory, read` with no path in either runtime.
///
/// An errno the table does not carry falls back to `UNKNOWN: unknown
/// error`, which is node's own fallback (`uvUnmappedError`), and an
/// error with no errno at all keeps Rust's rendering rather than
/// inventing a code for it.
fn io_message(error: &std::io::Error, syscall: &str, path: Option<&str>) -> String {
    let Some(errno) = error.raw_os_error() else {
        return error.to_string();
    };
    let (code, message) = UV_ERRORS
        .iter()
        .find(|(number, _, _)| *number == errno)
        .map_or(("UNKNOWN", "unknown error"), |(_, code, message)| {
            (*code, *message)
        });
    match path {
        Some(path) => format!("{code}: {message}, {syscall} '{path}'"),
        None => format!("{code}: {message}, {syscall}"),
    }
}

/// Read a whole stream as text, the way the canonical command's
/// `readFileSync(fd, 'utf8')` does.
///
/// LOSSY, deliberately. Node replaces a byte that is not valid UTF-8 with
/// U+FFFD and carries on, so a grammar file with one bad byte is a
/// grammar that fails to compile (exit 2), not a file that fails to read
/// (exit 3). Refusing here would change the exit code, and the exit code
/// is the command's whole contract.
fn read_all(stream: &mut dyn Read) -> Result<String, String> {
    let mut buffer = Vec::new();
    stream
        .read_to_end(&mut buffer)
        .map_err(|error| io_message(&error, "read", None))?;
    Ok(String::from_utf8_lossy(&buffer).into_owned())
}

/// A file as text, lossily, for the reason `read_all` gives.
///
/// The two failures are kept apart because node keeps them apart: the
/// open names the path, and a read that fails after a successful open
/// (a directory, most often) does not.
fn read_file(path: &str) -> Result<String, String> {
    let mut file =
        std::fs::File::open(path).map_err(|error| io_message(&error, "open", Some(path)))?;
    read_all(&mut file)
}

/// Run the command over `argv`, whose entries are the arguments AFTER the
/// program name, as `process.argv.slice(2)` gives the canonical command.
/// Standard input is read only when a `-` grammar or `--stdin` asks for
/// it. The return value is the process exit code.
///
/// ```
/// let argv: Vec<String> = ["-", "--text", "hi"].iter().map(|s| s.to_string()).collect();
/// let mut out: Vec<u8> = Vec::new();
/// let code = tabnas_gbnf::cli::run(
///     &argv,
///     &mut "root ::= \"hi\"".as_bytes(),
///     &mut out,
///     &mut std::io::sink(),
/// );
/// assert_eq!(code, 0);
/// ```
pub fn run(
    argv: &[String],
    stdin: &mut dyn Read,
    stdout: &mut dyn Write,
    stderr: &mut dyn Write,
) -> i32 {
    // Checked before the option table so an unknown-option failure can
    // still honor the JSON contract the caller asked for. Only the tokens
    // before a `--` separator count: after it, `--json` is a file name.
    let opt_end = argv
        .iter()
        .position(|argument| "--" == argument)
        .unwrap_or(argv.len());
    let want_json = argv[..opt_end].iter().any(|argument| "--json" == argument);

    let (flags, positionals) = match parse_args(argv) {
        Ok(parsed) => parsed,
        Err(message) => return usage_fail(&message, want_json, stdout, stderr),
    };

    if flags.help {
        let _ = write!(stdout, "{USAGE}");
        return 0;
    }
    if flags.version {
        let _ = writeln!(stdout, "{VERSION}");
        return 0;
    }
    if flags.quiet && flags.json {
        return usage_fail(
            "--quiet and --json are mutually exclusive",
            want_json,
            stdout,
            stderr,
        );
    }

    let Some(grammar_source) = positionals.first().cloned() else {
        return usage_fail("no grammar given", want_json, stdout, stderr);
    };
    if "-" == grammar_source && flags.stdin {
        return usage_fail(
            "the grammar is already read from stdin ('-'); --stdin cannot also read a \
             sample from it",
            want_json,
            stdout,
            stderr,
        );
    }

    let grammar_text = if "-" == grammar_source {
        match read_all(stdin) {
            Ok(text) => text,
            Err(error) => {
                return usage_fail(
                    &format!("cannot read grammar {grammar_source}: {error}"),
                    want_json,
                    stdout,
                    stderr,
                )
            }
        }
    } else {
        match read_file(&grammar_source) {
            Ok(text) => text,
            Err(error) => {
                return usage_fail(
                    &format!("cannot read grammar {grammar_source}: {error}"),
                    want_json,
                    stdout,
                    stderr,
                )
            }
        }
    };

    // All samples are collected before any parsing, so an unreadable file
    // is a usage failure for the whole run rather than a half-finished
    // report.
    let mut samples: Vec<Sample> = Vec::new();
    for file in positionals.iter().skip(1) {
        match read_file(file) {
            Ok(text) => samples.push(Sample {
                source: file.clone(),
                text,
            }),
            Err(error) => {
                return usage_fail(
                    &format!("cannot read sample: {error}"),
                    want_json,
                    stdout,
                    stderr,
                )
            }
        }
    }
    for (index, text) in flags.text.iter().enumerate() {
        samples.push(Sample {
            source: format!("text#{index}"),
            text: text.clone(),
        });
    }
    if flags.stdin {
        match read_all(stdin) {
            Ok(text) => samples.push(Sample {
                source: "stdin".to_string(),
                text,
            }),
            Err(error) => {
                return usage_fail(
                    &format!("cannot read sample from stdin: {error}"),
                    want_json,
                    stdout,
                    stderr,
                )
            }
        }
    }

    if flags.strip_final_newline {
        for sample in &mut samples {
            sample.text = strip_one_final_newline(&sample.text);
        }
    }

    let mut parser = Tabnas::new();
    let grammar_error = gbnf(&mut parser, &grammar_text, None)
        .err()
        .map(|error| compile_error_info(&error));

    let mut reports: Vec<Map<String, Json>> = Vec::new();
    if grammar_error.is_none() {
        for sample in &samples {
            let mut report = Map::new();
            report.insert("source".into(), json!(sample.source));
            report.insert("ok".into(), json!(false));
            report.insert("length".into(), json!(utf16_len(&sample.text)));
            match parser.parse(&sample.text) {
                // An accepted EMPTY input parses to nothing rather than a
                // node (the engine settles the empty string before any
                // rule runs), so `ast` is null there: reaching this arm at
                // all means accepted.
                Ok(value) => {
                    report.insert("ok".into(), json!(true));
                    if flags.ast {
                        report.insert("ast".into(), value.to_json());
                    }
                }
                Err(error) => {
                    report.insert("error".into(), Json::Object(parse_error_info(&error)));
                    if !flags.strip_final_newline && ends_with_newline(&sample.text) {
                        let shorter = strip_one_final_newline(&sample.text);
                        if parser.parse(&shorter).is_ok() {
                            report.insert(
                                "hint".into(),
                                json!(
                                    "the sample ends with a newline the grammar does not \
                                     accept, and parses without it; re-run with \
                                     --strip-final-newline or drop the trailing newline"
                                ),
                            );
                        }
                    }
                }
            }
            reports.push(report);
        }
    }

    let rejected = reports
        .iter()
        .filter(|report| Some(true) != report.get("ok").and_then(Json::as_bool))
        .count();
    let exit = if grammar_error.is_some() {
        2
    } else if 0 < rejected {
        1
    } else {
        0
    };

    if flags.json {
        let mut doc = Map::new();
        doc.insert("tool".into(), json!("gbnf-check"));
        doc.insert("version".into(), json!(VERSION));
        doc.insert("ok".into(), json!(0 == exit));
        doc.insert("exit".into(), json!(exit));
        doc.insert(
            "grammar".into(),
            json!({
                "source": grammar_source,
                "ok": grammar_error.is_none(),
                "error": grammar_error
                    .clone()
                    .map_or(Json::Null, Json::Object),
            }),
        );
        doc.insert(
            "samples".into(),
            Json::Array(reports.iter().cloned().map(Json::Object).collect()),
        );
        if grammar_error.is_none() && 0 < rejected {
            doc.insert(
                "caveats".into(),
                json!([{
                    "code": "rejection-may-be-engine-limit",
                    "message": "a rejection is this engine's answer, not always the \
                                grammar's: a grammar that needs backtracking can reject \
                                here and still constrain a sampler correctly",
                    "url": KNOWN_GAPS_URL,
                }]),
            );
        }
        let _ = writeln!(stdout, "{}", pretty(&Json::Object(doc)));
    } else if !flags.quiet {
        let mut lines: Vec<String> = Vec::new();
        lines.push(format!(
            "grammar {grammar_source}: {}",
            match &grammar_error {
                Some(info) => format!("FAIL \u{2014} {}", describe_error(info)),
                None => "ok".to_string(),
            }
        ));
        for report in &reports {
            let source = report
                .get("source")
                .and_then(Json::as_str)
                .unwrap_or_default();
            if Some(true) == report.get("ok").and_then(Json::as_bool) {
                lines.push(format!("sample {source}: accept"));
                if flags.ast {
                    lines.push(pretty(report.get("ast").unwrap_or(&Json::Null)));
                }
            } else {
                let empty = Map::new();
                let info = report
                    .get("error")
                    .and_then(Json::as_object)
                    .unwrap_or(&empty);
                lines.push(format!(
                    "sample {source}: REJECT \u{2014} {}",
                    describe_error(info)
                ));
                if let Some(hint) = report.get("hint").and_then(Json::as_str) {
                    lines.push(format!("  hint: {hint}"));
                }
            }
        }
        if grammar_error.is_none() && 0 < rejected {
            lines.push(format!(
                "note: a rejection can be an engine limit rather than the grammar's \
                 answer; see {KNOWN_GAPS_URL}"
            ));
        }
        let _ = writeln!(stdout, "{}", lines.join("\n"));
    }

    exit
}

/// What one captured run produced, for a caller that wants to inspect the
/// streams rather than write them.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Captured {
    /// The process exit code.
    pub code: i32,
    /// What went to standard output.
    pub stdout: String,
    /// What went to standard error.
    pub stderr: String,
}

/// Run the command and collect what it wrote instead of sending it to a
/// stream.
///
/// ```
/// let argv: Vec<String> = ["--version"].iter().map(|s| s.to_string()).collect();
/// let captured = tabnas_gbnf::cli::capture(&argv, "");
/// assert_eq!(captured.code, 0);
/// assert_eq!(captured.stdout.trim(), tabnas_gbnf::VERSION);
/// ```
pub fn capture(argv: &[String], stdin: &str) -> Captured {
    let mut input = stdin.as_bytes();
    let mut stdout: Vec<u8> = Vec::new();
    let mut stderr: Vec<u8> = Vec::new();
    let code = run(argv, &mut input, &mut stdout, &mut stderr);
    Captured {
        code,
        stdout: String::from_utf8_lossy(&stdout).into_owned(),
        stderr: String::from_utf8_lossy(&stderr).into_owned(),
    }
}
