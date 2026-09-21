# ci/

Staging area for GitHub Actions workflow changes.

This directory exists because session credentials cannot write
`.github/workflows/*` — see admin `DECISIONS.md` ADR-8. To change CI:

1. Put the intended workflow file in `workflows/`.
2. A maintainer promotes it with the admin `rollout/apply-ci-folders.sh`
   script.

## Pending

- **`workflows/docs.yml`** — the prose gate: Vale over the reader-facing
  pages at the levels set in `.vale.ini`, on the file list
  `ts/scripts/gated-docs.cjs` produces. See `docs/STYLE-GUIDE.md`.

  It needs no sibling checkouts and no secrets, and pins its own Vale
  version. Errors fail the job; warnings go to the run summary as a
  report. `make prose` runs the identical check locally, and the test
  suite already runs the other half of the gate
  (`ts/test/docs.test.js`), so promoting this adds the spelling and
  Google-convention arm rather than the whole gate.

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
