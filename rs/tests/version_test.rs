// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// The Rust crate's version is one of the release sites that must agree.
// A bump that updates ts/package.json and forgets these fails here
// rather than shipping a crate whose version disagrees with the package
// it is a port of. Mirrors `ts/test/version.test.js` and
// `go/version_test.go`.

use std::fs;
use std::path::Path;

fn repo_root() -> &'static Path {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("rs/ has a parent")
}

#[test]
fn version_looks_like_a_semver() {
    let parts: Vec<&str> = tabnas_gbnf::VERSION.split('.').collect();
    assert_eq!(
        parts.len(),
        3,
        "VERSION is not x.y.z: {}",
        tabnas_gbnf::VERSION
    );
    for part in parts {
        assert!(
            !part.is_empty() && part.chars().all(|character| character.is_ascii_digit()),
            "VERSION segment is not numeric: {}",
            tabnas_gbnf::VERSION
        );
    }
}

#[test]
fn version_matches_cargo_toml() {
    let manifest = fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml"))
        .expect("the manifest is readable");
    let declared = manifest
        .lines()
        .find_map(|line| line.strip_prefix("version = \""))
        .and_then(|rest| rest.split('"').next())
        .expect("the manifest declares a version");
    assert_eq!(
        declared,
        tabnas_gbnf::VERSION,
        "Cargo.toml disagrees with VERSION"
    );
}

#[test]
fn version_matches_package_json() {
    let package = fs::read_to_string(repo_root().join("ts").join("package.json"))
        .expect("ts/package.json is readable");
    let declared: serde_json::Value =
        serde_json::from_str(&package).expect("ts/package.json is JSON");
    assert_eq!(
        declared["version"]
            .as_str()
            .expect("package.json declares a version"),
        tabnas_gbnf::VERSION,
        "ts/package.json disagrees with VERSION"
    );
}

#[test]
fn version_matches_the_typescript_source() {
    let source = fs::read_to_string(repo_root().join("ts").join("src").join("gbnf.ts"))
        .expect("ts/src/gbnf.ts is readable");
    let declared = source
        .lines()
        .find_map(|line| line.strip_prefix("const VERSION = '"))
        .and_then(|rest| rest.split('\'').next())
        .expect("ts/src/gbnf.ts declares a VERSION");
    assert_eq!(
        declared,
        tabnas_gbnf::VERSION,
        "ts/src/gbnf.ts disagrees with VERSION"
    );
}

#[test]
fn version_matches_the_go_port() {
    let source =
        fs::read_to_string(repo_root().join("go").join("gbnf.go")).expect("go/gbnf.go is readable");
    let declared = source
        .lines()
        .find_map(|line| line.trim_start().strip_prefix("const VERSION = \""))
        .and_then(|rest| rest.split('"').next())
        .expect("go/gbnf.go declares a VERSION");
    assert_eq!(
        declared,
        tabnas_gbnf::VERSION,
        "go/gbnf.go disagrees with VERSION"
    );
}

/// The command reports the same version the library exports, because a
/// report carries it and a consumer matches on it.
#[test]
fn the_command_reports_the_same_version() {
    let argv = vec!["--version".to_string()];
    let captured = tabnas_gbnf::cli::capture(&argv, "");
    assert_eq!(captured.code, 0);
    assert_eq!(captured.stdout.trim(), tabnas_gbnf::VERSION);
}
