// The `gbnf-check` command: argument handling, all four exit codes, the
// human and JSON reports, standard input in both roles, and the
// trailing-newline hint. The Rust port of `ts/test/cli.test.js`.
//
// The canonical suite spawns the real binary, because the exit code IS
// the API for shell scripts and continuous integration. This crate is a
// library plus a thin launcher, so the tests drive `cli::run` in process
// instead: `run` takes its streams and returns the exit code, and the
// launcher does nothing but hand it the real ones and call
// `std::process::exit`. That is the seam `railroad` and `jsonic-cli` use
// for the same reason.

mod common;

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value as Json;
use tabnas_gbnf::{cli, VERSION};

/// A fresh scratch directory under the target directory, removed by the
/// guard. The command's whole job is reading files, so the fixtures live
/// on disk.
struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str) -> Self {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("cli-test")
            .join(format!("{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("the scratch directory is creatable");
        let scratch = Scratch(dir);
        scratch.write("hi.gbnf", "root ::= \"hi\" | \"hello\"");
        scratch.write("noroot.gbnf", "greeting ::= \"hi\"");
        scratch.write("undef.gbnf", "root ::= nope");
        scratch.write("badesc.gbnf", "root ::= \"a\" |\nfoo \"\\q\"");
        scratch.write("synerr.gbnf", "root ::= \"a\"\n& nope");
        scratch.write("star.gbnf", "root ::= \"x\"*");
        scratch.write("ok.txt", "hi");
        scratch.write("bad.txt", "HI");
        // What `echo hi > sample.txt` really writes: the newline footgun.
        scratch.write("nl.txt", "hi\n");
        scratch
    }

    fn write(&self, name: &str, body: &str) {
        fs::write(self.0.join(name), body).expect("the fixture is writable");
    }

    fn at(&self, name: &str) -> String {
        self.0
            .join(name)
            .to_str()
            .expect("a utf-8 path")
            .to_string()
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn run(args: &[&str], stdin: &str) -> cli::Captured {
    let argv: Vec<String> = args.iter().map(|arg| arg.to_string()).collect();
    cli::capture(&argv, stdin)
}

fn json(captured: &cli::Captured) -> Json {
    serde_json::from_str(&captured.stdout)
        .unwrap_or_else(|error| panic!("not JSON: {error}\n{}", captured.stdout))
}

/// The corpus grammar the last case validates.
fn corpus_json() -> String {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("rs/ has a parent")
        .join("test")
        .join("corpus")
        .join("json.gbnf")
        .to_str()
        .expect("a utf-8 path")
        .to_string()
}

// ---- exit codes -------------------------------------------------------

#[test]
fn exit_0_grammar_compiles_no_samples() {
    let dir = Scratch::new("exit0a");
    let result = run(&[&dir.at("hi.gbnf")], "");
    assert_eq!(result.code, 0, "{result:?}");
    assert!(result.stdout.contains("hi.gbnf: ok"), "{}", result.stdout);
}

#[test]
fn exit_0_every_sample_accepted() {
    let dir = Scratch::new("exit0b");
    let result = run(
        &[&dir.at("hi.gbnf"), &dir.at("ok.txt"), "--text", "hello"],
        "",
    );
    assert_eq!(result.code, 0, "{result:?}");
    assert!(
        result.stdout.contains("ok.txt: accept"),
        "{}",
        result.stdout
    );
    assert!(
        result.stdout.contains("sample text#0: accept"),
        "{}",
        result.stdout
    );
}

#[test]
fn exit_1_a_sample_is_rejected() {
    let dir = Scratch::new("exit1");
    let result = run(
        &[&dir.at("hi.gbnf"), &dir.at("ok.txt"), &dir.at("bad.txt")],
        "",
    );
    assert_eq!(result.code, 1, "{result:?}");
    assert!(
        result.stdout.contains("ok.txt: accept"),
        "{}",
        result.stdout
    );
    assert!(
        result.stdout.contains("bad.txt: REJECT"),
        "{}",
        result.stdout
    );
    assert!(
        result
            .stdout
            .contains("note: a rejection can be an engine limit"),
        "{}",
        result.stdout
    );
}

#[test]
fn exit_2_the_grammar_does_not_compile() {
    let dir = Scratch::new("exit2");
    let result = run(&[&dir.at("noroot.gbnf")], "");
    assert_eq!(result.code, 2, "{result:?}");
    assert!(
        result.stdout.contains("noroot.gbnf: FAIL"),
        "{}",
        result.stdout
    );
    assert!(
        result.stdout.contains("no 'root' rule"),
        "{}",
        result.stdout
    );
}

/// An input failure is reported in the canonical command's words, not
/// the operating system's.
///
/// Node renders a file-system failure through libuv:
/// `ENOENT: no such file or directory, open 'x'`. Rust's own
/// `io::Error` renders the same condition as
/// `No such file or directory (os error 2)`, so a port that printed it
/// would answer a different sentence for the same missing file. The
/// exit code is 3 either way; the TEXT is the contract this pins.
#[test]
fn an_unreadable_input_is_reported_the_way_node_reports_it() {
    let dir = Scratch::new("iomsg");
    let hi = dir.at("hi.gbnf");
    let missing = dir.at("missing.gbnf");
    let missing_sample = dir.at("missing.txt");

    let result = run(&[&missing], "");
    assert_eq!(result.code, 3, "{result:?}");
    assert_eq!(
        result.stderr,
        format!(
            "gbnf-check: cannot read grammar {missing}: ENOENT: no such file or \
             directory, open '{missing}'\nrun 'gbnf-check --help' for usage\n"
        ),
        "{}",
        result.stderr
    );

    let result = run(&[&hi, &missing_sample], "");
    assert_eq!(result.code, 3, "{result:?}");
    assert!(
        result.stderr.contains(&format!(
            "cannot read sample: ENOENT: no such file or directory, open '{missing_sample}'"
        )),
        "{}",
        result.stderr
    );

    // A directory OPENS and then fails to read, so node names the `read`
    // call and carries no path. Both halves are the contract.
    let subdir = dir.at("adir");
    fs::create_dir_all(&subdir).expect("the scratch subdirectory is creatable");
    let result = run(&[&subdir], "");
    assert_eq!(result.code, 3, "{result:?}");
    assert!(
        result.stderr.contains(&format!(
            "cannot read grammar {subdir}: EISDIR: illegal operation on a directory, read"
        )),
        "{}",
        result.stderr
    );
}

/// A sample holding a carriage return. The engine quotes the offending
/// characters into its message, and the report carries the first LINE of
/// it: the text up to the first line feed, carriage return included, as
/// `split('\n')[0]` gives it. `str::lines` would drop the return and
/// report different text from the canonical command.
#[test]
fn a_carriage_return_survives_the_first_line_of_a_message() {
    let dir = Scratch::new("crmsg");
    let result = run(&["--json", &dir.at("hi.gbnf"), "-t", "hi\rthere"], "");
    assert_eq!(result.code, 1, "{result:?}");
    let message = json(&result)["samples"][0]["error"]["message"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    assert!(
        message.ends_with('\r'),
        "the carriage return must survive: {message:?}"
    );
}

#[test]
fn exit_3_usage_failures_each_with_its_own_diagnosis() {
    let dir = Scratch::new("exit3");
    let hi = dir.at("hi.gbnf");
    let missing_grammar = dir.at("missing.gbnf");
    let missing_sample = dir.at("missing.txt");
    let cases: Vec<(Vec<&str>, &str)> = vec![
        (vec![], "no grammar given"),
        (vec![&hi, "--bogus"], "--bogus"),
        (vec![&missing_grammar], "cannot read grammar"),
        (vec![&hi, &missing_sample], "cannot read sample"),
        (vec!["-", "--stdin"], "already read from stdin"),
    ];
    for (args, why) in cases {
        let result = run(&args, "");
        assert_eq!(result.code, 3, "{args:?}: {result:?}");
        assert!(
            result.stderr.contains("gbnf-check: "),
            "{args:?}: {}",
            result.stderr
        );
        assert!(result.stderr.contains(why), "{args:?}: {}", result.stderr);
        assert!(
            result.stderr.contains("run 'gbnf-check --help' for usage"),
            "{args:?}: {}",
            result.stderr
        );
    }

    // Contradictory report modes, and because --json was asked for the
    // complaint itself arrives as JSON.
    let result = run(&[&hi, "--quiet", "--json"], "");
    assert_eq!(result.code, 3, "{result:?}");
    assert!(
        json(&result)["error"]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("mutually exclusive"),
        "{}",
        result.stdout
    );
}

// ---- error classes ----------------------------------------------------

#[test]
fn a_compile_failure_carries_the_rule() {
    let dir = Scratch::new("errclass-a");
    let result = run(&[&dir.at("undef.gbnf"), "--json"], "");
    assert_eq!(result.code, 2, "{result:?}");
    let doc = json(&result);
    assert_eq!(doc["grammar"]["error"]["name"], "GbnfCompileError");
    assert_eq!(doc["grammar"]["error"]["rule"], "root");
    assert!(
        doc["grammar"]["error"]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("'nope'"),
        "{doc}"
    );
}

#[test]
fn a_parse_failure_carries_line_and_column() {
    let dir = Scratch::new("errclass-b");
    let result = run(&[&dir.at("synerr.gbnf"), "--json"], "");
    assert_eq!(result.code, 2, "{result:?}");
    let doc = json(&result);
    assert_eq!(doc["grammar"]["error"]["name"], "GbnfParseError");
    assert_eq!(doc["grammar"]["error"]["line"], 2);
    assert_eq!(doc["grammar"]["error"]["column"], 1);
    // And NO `code`. The canonical command reads it off the thrown
    // error, and the wrapper a grammar failure arrives in does not have
    // one; only a SAMPLE failure does. A port that added the field here
    // would put something in the report contract that the other runtime
    // never emits.
    assert!(doc["grammar"]["error"].get("code").is_none(), "{doc}");
    assert_eq!(
        doc["grammar"]["error"]["message"],
        "gbnf: parse error at line 2, column 1: [tabnas/unexpected]: \
         unexpected character(s): &"
    );
}

#[test]
fn a_terminal_decoder_failure_has_no_location_by_contract() {
    let dir = Scratch::new("errclass-c");
    let result = run(&[&dir.at("badesc.gbnf"), "--json"], "");
    assert_eq!(result.code, 2, "{result:?}");
    let doc = json(&result);
    assert_eq!(doc["grammar"]["error"]["name"], "GbnfParseError");
    assert!(
        doc["grammar"]["error"]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("unknown escape"),
        "{doc}"
    );
    assert!(doc["grammar"]["error"].get("line").is_none(), "{doc}");
}

#[test]
fn a_rejected_sample_reports_the_engine_failure_ansi_free_one_line() {
    let dir = Scratch::new("errclass-d");
    let result = run(&[&dir.at("hi.gbnf"), "--text", "HI", "--json"], "");
    assert_eq!(result.code, 1, "{result:?}");
    let doc = json(&result);
    let error = &doc["samples"][0]["error"];
    // `SyntaxError` is the class name the canonical runtime reports for
    // an engine parse failure, and the report carries that rather than
    // this port's own type name.
    assert_eq!(error["name"], "SyntaxError");
    assert_eq!(error["code"], "unexpected");
    assert_eq!(error["line"], 1);
    assert_eq!(error["column"], 1);
    let message = error["message"].as_str().unwrap_or_default();
    assert!(!message.contains('\u{1b}'), "{message}");
    // The raw engine message is multi-line and coloured; the report
    // carries its first line only.
    assert!(!message.contains('\n'), "{message}");
}

// ---- the json report --------------------------------------------------

#[test]
fn the_json_report_has_the_documented_shape() {
    let dir = Scratch::new("json-shape");
    let hi = dir.at("hi.gbnf");
    let result = run(&[&hi, "--text", "hi", "--text", "HI", "--json"], "");
    assert_eq!(result.code, 1, "{result:?}");
    let doc = json(&result);
    assert_eq!(doc["tool"], "gbnf-check");
    assert_eq!(doc["version"], VERSION);
    assert_eq!(doc["ok"], false);
    assert_eq!(doc["exit"], 1);
    assert_eq!(doc["grammar"]["source"], hi.as_str());
    assert_eq!(doc["grammar"]["ok"], true);
    assert_eq!(doc["grammar"]["error"], Json::Null);
    let samples: Vec<(&str, bool)> = doc["samples"]
        .as_array()
        .expect("samples")
        .iter()
        .map(|sample| {
            (
                sample["source"].as_str().unwrap_or_default(),
                sample["ok"].as_bool().unwrap_or_default(),
            )
        })
        .collect();
    assert_eq!(samples, [("text#0", true), ("text#1", false)]);
    assert_eq!(doc["caveats"][0]["code"], "rejection-may-be-engine-limit");
}

#[test]
fn all_accepted_has_no_caveats() {
    let dir = Scratch::new("json-nocaveat");
    let result = run(&[&dir.at("hi.gbnf"), "--text", "hi", "--json"], "");
    assert_eq!(result.code, 0, "{result:?}");
    let doc = json(&result);
    assert_eq!(doc["ok"], true);
    assert!(doc.get("caveats").is_none(), "{doc}");
}

#[test]
fn a_failed_grammar_reports_empty_samples_untested() {
    let dir = Scratch::new("json-failed");
    let result = run(&[&dir.at("noroot.gbnf"), &dir.at("ok.txt"), "--json"], "");
    assert_eq!(result.code, 2, "{result:?}");
    let doc = json(&result);
    assert_eq!(doc["grammar"]["ok"], false);
    assert_eq!(doc["samples"], serde_json::json!([]));
}

#[test]
fn samples_report_in_source_order_files_text_stdin() {
    let dir = Scratch::new("json-order");
    let ok = dir.at("ok.txt");
    let result = run(
        &[&dir.at("hi.gbnf"), &ok, "-t", "hello", "--stdin", "--json"],
        "hi",
    );
    assert_eq!(result.code, 0, "{result:?}");
    let doc = json(&result);
    let sources: Vec<&str> = doc["samples"]
        .as_array()
        .expect("samples")
        .iter()
        .map(|sample| sample["source"].as_str().unwrap_or_default())
        .collect();
    assert_eq!(sources, [ok.as_str(), "text#0", "stdin"]);
}

#[test]
fn a_usage_failure_still_answers_in_json_when_json_was_asked_for() {
    let dir = Scratch::new("json-usage");
    let hi = dir.at("hi.gbnf");
    for args in [vec!["--json"], vec![hi.as_str(), "--bogus", "--json"]] {
        let result = run(&args, "");
        assert_eq!(result.code, 3, "{args:?}: {result:?}");
        let doc = json(&result);
        assert_eq!(doc["exit"], 3);
        assert_eq!(doc["error"]["name"], "UsageError");
    }
}

#[test]
fn ast_includes_the_tree_and_null_for_an_accepted_empty_input() {
    let dir = Scratch::new("json-ast");
    let result = run(&[&dir.at("hi.gbnf"), "--text", "hi", "--ast", "--json"], "");
    let tree = &json(&result)["samples"][0]["ast"];
    assert_eq!(tree["rule"], "root");
    assert_eq!(tree["src"], "hi");
    assert_eq!(tree["kids"], serde_json::json!([]));

    // The engine settles the empty string before any rule runs, so an
    // accepted empty input has no node: the report says null.
    let empty = run(&[&dir.at("star.gbnf"), "--text", "", "--ast", "--json"], "");
    assert_eq!(empty.code, 0, "{empty:?}");
    assert_eq!(json(&empty)["samples"][0]["ast"], Json::Null);
}

// ---- standard input ---------------------------------------------------

#[test]
fn reads_the_grammar_when_the_argument_is_a_dash() {
    let result = run(&["-", "--text", "hi"], "root ::= \"hi\"");
    assert_eq!(result.code, 0, "{result:?}");
}

#[test]
fn reads_a_sample_with_stdin() {
    let dir = Scratch::new("stdin-sample");
    let result = run(&[&dir.at("hi.gbnf"), "--stdin"], "hi");
    assert_eq!(result.code, 0, "{result:?}");
    assert!(
        result.stdout.contains("sample stdin: accept"),
        "{}",
        result.stdout
    );
}

// ---- the trailing newline ---------------------------------------------

#[test]
fn rejects_exactly_but_hints_when_the_newline_is_the_cause() {
    let dir = Scratch::new("nl-hint");
    let result = run(&[&dir.at("hi.gbnf"), &dir.at("nl.txt"), "--json"], "");
    assert_eq!(result.code, 1, "{result:?}");
    let doc = json(&result);
    assert_eq!(doc["samples"][0]["ok"], false);
    assert!(
        doc["samples"][0]["hint"]
            .as_str()
            .unwrap_or_default()
            .contains("--strip-final-newline"),
        "{doc}"
    );
}

#[test]
fn does_not_hint_when_the_newline_is_not_the_cause() {
    let dir = Scratch::new("nl-nohint");
    let result = run(&[&dir.at("hi.gbnf"), "--text", "HI\n", "--json"], "");
    let doc = json(&result);
    assert!(doc["samples"][0].get("hint").is_none(), "{doc}");
}

#[test]
fn strip_final_newline_removes_one_and_reports_the_tested_length() {
    let dir = Scratch::new("nl-strip");
    let result = run(
        &[
            &dir.at("hi.gbnf"),
            &dir.at("nl.txt"),
            "--strip-final-newline",
            "--json",
        ],
        "",
    );
    assert_eq!(result.code, 0, "{result:?}");
    let doc = json(&result);
    assert_eq!(doc["samples"][0]["ok"], true);
    assert_eq!(doc["samples"][0]["length"], 2);
}

#[test]
fn strip_final_newline_handles_crlf_and_removes_exactly_one() {
    let dir = Scratch::new("nl-crlf");
    let crlf = run(
        &[
            &dir.at("hi.gbnf"),
            "--text",
            "hi\r\n",
            "--strip-final-newline",
            "--json",
        ],
        "",
    );
    assert_eq!(crlf.code, 0, "{crlf:?}");
    assert_eq!(json(&crlf)["samples"][0]["length"], 2);

    // Two newlines: one comes off, the survivor still rejects, and with
    // stripping explicit there is no hint to second-guess it.
    let two = run(
        &[
            &dir.at("hi.gbnf"),
            "--text",
            "hi\n\n",
            "--strip-final-newline",
            "--json",
        ],
        "",
    );
    assert_eq!(two.code, 1, "{two:?}");
    let doc = json(&two);
    assert_eq!(doc["samples"][0]["length"], 3);
    assert!(doc["samples"][0].get("hint").is_none(), "{doc}");
}

#[test]
fn the_human_report_carries_the_hint_too() {
    let dir = Scratch::new("nl-human");
    let result = run(&[&dir.at("hi.gbnf"), &dir.at("nl.txt")], "");
    assert_eq!(result.code, 1, "{result:?}");
    assert!(
        result.stdout.contains("hint: ") && result.stdout.contains("--strip-final-newline"),
        "{}",
        result.stdout
    );
}

// ---- the surface -------------------------------------------------------

#[test]
fn version_prints_the_package_version() {
    for flag in ["--version", "-v"] {
        let result = run(&[flag], "");
        assert_eq!(result.code, 0, "{flag}: {result:?}");
        assert_eq!(result.stdout.trim(), VERSION);
    }
}

#[test]
fn help_documents_the_exit_codes() {
    for flag in ["--help", "-h"] {
        let result = run(&[flag], "");
        assert_eq!(result.code, 0, "{flag}: {result:?}");
        assert!(result.stdout.contains("exit codes:"), "{}", result.stdout);
        assert!(
            result.stdout.contains("llama-gbnf-validator"),
            "{}",
            result.stdout
        );
    }
}

#[test]
fn quiet_answers_with_the_exit_code_alone() {
    let dir = Scratch::new("quiet");
    for flag in ["--quiet", "-q"] {
        let result = run(&[&dir.at("hi.gbnf"), "--text", "HI", flag], "");
        assert_eq!(result.code, 1, "{flag}: {result:?}");
        assert_eq!(result.stdout, "");
        assert_eq!(result.stderr, "");
    }
}

#[test]
fn ast_prints_the_tree_in_the_human_report_too() {
    let dir = Scratch::new("human-ast");
    let result = run(&[&dir.at("hi.gbnf"), "--text", "hi", "--ast"], "");
    assert_eq!(result.code, 0, "{result:?}");
    assert!(
        result.stdout.contains("\"rule\": \"root\""),
        "{}",
        result.stdout
    );
    assert!(
        result.stdout.contains("\"src\": \"hi\""),
        "{}",
        result.stdout
    );
}

#[test]
fn a_double_dash_ends_the_options() {
    // After `--`, `--json` is a file name rather than a flag, which is
    // why the JSON contract is decided from the tokens before it.
    let dir = Scratch::new("ddash");
    let result = run(&[&dir.at("hi.gbnf"), "--", "--json"], "");
    assert_eq!(result.code, 3, "{result:?}");
    assert!(
        result.stderr.contains("cannot read sample"),
        "{}",
        result.stderr
    );
}

#[test]
fn text_takes_an_inline_value_too() {
    let dir = Scratch::new("inline");
    let result = run(&[&dir.at("hi.gbnf"), "--text=hello", "--json"], "");
    assert_eq!(result.code, 0, "{result:?}");
    assert_eq!(json(&result)["samples"][0]["source"], "text#0");
}

/// The shapes `node:util` `parseArgs` has beyond the obvious ones, each
/// answer MEASURED against it rather than guessed. The command's
/// standard-error text is part of its contract, so the argument reader
/// has to be the same reader.
#[test]
fn the_argument_reader_matches_node_parse_args() {
    let dir = Scratch::new("parseargs");
    let hi = dir.at("hi.gbnf");

    // A group of boolean shorts. `-h` wins, as it does for `--help`.
    let group = run(&["-qh"], "");
    assert_eq!(group.code, 0, "{group:?}");
    assert!(group.stdout.contains("exit codes:"), "{}", group.stdout);

    // A short option with its value attached.
    let attached = run(&[&hi, "-thello", "--json"], "");
    assert_eq!(attached.code, 0, "{attached:?}");
    assert_eq!(json(&attached)["samples"][0]["source"], "text#0");

    // A group that runs into an option taking a value: everything from
    // there on is the value, so this is `--quiet --text hello`.
    let mixed = run(&[&hi, "-qthello"], "");
    assert_eq!(mixed.code, 0, "{mixed:?}");
    assert_eq!(mixed.stdout, "", "--quiet was not honoured");

    // `-t=hello` gives the value `=hello`, NOT `hello`: only the long
    // spelling reads an `=`.
    let equals = run(&[&hi, "-t=hello", "--json"], "");
    assert_eq!(equals.code, 1, "{equals:?}");
    assert_eq!(json(&equals)["samples"][0]["length"], 6);

    // A boolean given a value is an error, named the way the table names
    // it: with the short alias when there is one, without when not.
    for (argument, named) in [
        ("--json=true", "Option '--json' does not take an argument"),
        (
            "--quiet=1",
            "Option '-q, --quiet' does not take an argument",
        ),
        ("--stdin=x", "Option '--stdin' does not take an argument"),
    ] {
        let result = run(&[&hi, argument], "");
        assert_eq!(result.code, 3, "{argument}: {result:?}");
        assert!(
            result.stderr.contains(named),
            "{argument}: {}",
            result.stderr
        );
    }

    // A value that looks like another option is refused as ambiguous
    // rather than swallowed, and the hint names the short spelling only
    // when the short spelling is what was written.
    let long_ambiguous = run(&[&hi, "--text", "-q"], "");
    assert_eq!(long_ambiguous.code, 3, "{long_ambiguous:?}");
    assert!(
        long_ambiguous
            .stderr
            .contains("Option '--text' argument is ambiguous."),
        "{}",
        long_ambiguous.stderr
    );
    assert!(
        long_ambiguous.stderr.contains("use '--text=-XYZ'.")
            && !long_ambiguous.stderr.contains("-t-XYZ"),
        "{}",
        long_ambiguous.stderr
    );
    let short_ambiguous = run(&[&hi, "-t", "-q"], "");
    assert_eq!(short_ambiguous.code, 3, "{short_ambiguous:?}");
    assert!(
        short_ambiguous
            .stderr
            .contains("use '--text=-XYZ' or '-t-XYZ'."),
        "{}",
        short_ambiguous.stderr
    );
    // `--text=-q` and `-t-q` both DO carry a dashed value.
    for argument in ["--text=-q", "-t-q"] {
        let result = run(&[&hi, argument, "--json"], "");
        assert_eq!(result.code, 1, "{argument}: {result:?}");
        assert_eq!(json(&result)["samples"][0]["length"], 2, "{argument}");
    }

    // An unknown short is named on its own, group or not.
    for argument in ["-z", "-qz"] {
        let result = run(&[&hi, argument], "");
        assert_eq!(result.code, 3, "{argument}: {result:?}");
        assert!(
            result.stderr.contains("Unknown option '-z'"),
            "{argument}: {}",
            result.stderr
        );
    }

    // A bare `-` is the stdin grammar, a positional rather than an
    // option.
    let dash = run(&["-", "--text", "hi"], "root ::= \"hi\"");
    assert_eq!(dash.code, 0, "{dash:?}");
}

#[test]
fn text_with_no_value_is_a_usage_failure() {
    let dir = Scratch::new("noval");
    let result = run(&[&dir.at("hi.gbnf"), "--text"], "");
    assert_eq!(result.code, 3, "{result:?}");
    assert!(
        result.stderr.contains("argument missing"),
        "{}",
        result.stderr
    );
}

#[test]
fn the_reported_length_counts_utf16_code_units() {
    // The canonical command reports `String.prototype.length`, so a
    // sample holding an astral character counts two there. Reporting a
    // scalar-value count here would make the two runtimes disagree about
    // what they tested.
    let dir = Scratch::new("utf16-len");
    let result = run(&[&dir.at("hi.gbnf"), "--text", "\u{1F600}", "--json"], "");
    assert_eq!(result.code, 1, "{result:?}");
    assert_eq!(json(&result)["samples"][0]["length"], 2);
}

#[test]
fn validates_a_real_llama_cpp_corpus_grammar() {
    let result = run(
        &[
            &corpus_json(),
            "--text",
            "{\"answer\": [1, 2, 3]}",
            "--text",
            "{\"answer\": [1, 2, 3],}",
            "--json",
        ],
        "",
    );
    assert_eq!(result.code, 1, "{result:?}");
    let ok: Vec<bool> = json(&result)["samples"]
        .as_array()
        .expect("samples")
        .iter()
        .map(|sample| sample["ok"].as_bool().unwrap_or_default())
        .collect();
    assert_eq!(ok, [true, false]);
}
