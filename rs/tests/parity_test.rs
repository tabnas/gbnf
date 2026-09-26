// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// Cross-runtime parity, and the guard that keeps this file honest.
//
// Across the tabnas fleet a `parity_test.rs` drives the shared
// `test/spec/*.tsv` fixtures through `tabnas_support::Runner`, so the
// TypeScript, Go and Rust implementations read the SAME files and cannot
// drift without one of them going red.
//
// THIS REPOSITORY HAS NO SUCH FIXTURES. There is no `test/spec`
// directory, and `AGENTS.md` says why under "Error codes": this package
// declares no error codes, so no row can pin an `ERROR:<code>`. The
// shared data under `test/` is the two committed corpora, and those are
// graded directly, in both directions, by `corpus_test.rs` and
// `live_test.rs`.
//
// Parity is therefore measured against the canonical implementation
// itself, in `oracle_test.rs`, which holds this port to what `ts/dist`
// answered for every source in `tests/oracle/gbnf-oracle.json`.
//
// What is left here is the guard. The day shared fixtures DO land, this
// test fails and names them, so they cannot sit in the tree unread while
// a `parity_test.rs` that runs nothing keeps reporting green.

use std::path::{Path, PathBuf};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("rs/ has a parent")
        .to_path_buf()
}

#[test]
fn shared_fixtures_would_have_to_be_wired_in() {
    let root = repo_root();
    let mut found: Vec<String> = Vec::new();
    for dir in [root.join("test").join("spec"), root.join("test")] {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if Some("tsv") == path.extension().and_then(|extension| extension.to_str()) {
                found.push(path.display().to_string());
            }
        }
    }
    assert!(
        found.is_empty(),
        "shared fixtures have landed and nothing here reads them:\n  {}\n\nWire them through \
         `tabnas_support::Runner` in this file, the way the abnf, csv and toml ports do, and \
         rewrite this file's header. Every row of every shared fixture must pass, or the row \
         must be in the divergence register with a `rust` column.",
        found.join("\n  ")
    );
}

/// The two corpora ARE shared data, and both are read here. A census, so
/// a corpus file that arrives without being graded cannot hide.
#[test]
fn both_committed_corpora_are_on_disk_and_read() {
    let root = repo_root();

    let corpus = root.join("test").join("corpus");
    let grammars: Vec<String> = std::fs::read_dir(&corpus)
        .expect("test/corpus is readable")
        .flatten()
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name.ends_with(".gbnf"))
        .collect();
    assert_eq!(
        8,
        grammars.len(),
        "test/corpus holds {} grammars, not the eight on record: {grammars:?}",
        grammars.len()
    );

    let live = root
        .join("test")
        .join("live")
        .join("json-schema-corpus.json");
    let doc: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&live).expect("the live corpus is readable"))
            .expect("the live corpus is JSON");
    assert_eq!(
        77,
        doc["cases"].as_array().map_or(0, Vec::len),
        "the live corpus is not the seventy-seven cases on record"
    );
}

/// The oracle the port IS held to, named here so a reader who opens this
/// file looking for parity finds it.
#[test]
fn the_typescript_oracle_is_present_and_populated() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("oracle")
        .join("gbnf-oracle.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("{}: {error}", path.display()));
    let entries: Vec<serde_json::Value> =
        serde_json::from_str(&text).expect("the oracle fixture is JSON");
    assert!(
        200 < entries.len(),
        "the oracle carries only {} entries",
        entries.len()
    );
    // Both halves are measured: what TypeScript accepts, and what it
    // refuses. A corpus of one kind would let the other rot.
    let accepted = entries
        .iter()
        .filter(|entry| entry.get("ir").is_some())
        .count();
    let refused = entries
        .iter()
        .filter(|entry| entry.get("parseError").is_some())
        .count();
    assert!(100 < accepted, "only {accepted} accepted sources");
    assert!(20 < refused, "only {refused} refused sources");
}
