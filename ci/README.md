# ci/

Staging area for GitHub Actions workflow changes.

This directory exists because session credentials cannot write
`.github/workflows/*` — see admin `DECISIONS.md` ADR-8. To change CI:

1. Put the intended workflow file in `workflows/`.
2. A maintainer promotes it with the admin `rollout/apply-ci-folders.sh`
   script.

## Pending

- **`workflows/rust.yml`** — the Rust gate for `rs/`: format, build,
  tests, doctests and clippy with `-D warnings`, plus the lockfile
  check, all of it inside `ci/rust/run.sh` so this file and a
  contributor's local run cannot say different things.

  It clones the sibling crates it needs (`tabnas/parser`,
  `tabnas/bnf`, `tabnas/abnf`) because `rs/Cargo.toml` takes all three
  as path dependencies and none is published, and it pins the toolchain
  to the MSRV in `rs/Cargo.toml` rather than to `stable`. It needs no
  secrets and fetches no fixtures: both conformance corpora and the
  TypeScript parity oracle are committed.

  `make test-rs` runs the inner loop locally and `ci/rust/run.sh` runs
  the whole gate, so promoting this adds the hosted arm rather than the
  check itself.
