# Mirrors the repository-root Makefile from inside ts/, so a contributor
# working in the package can still reach the other runtimes.
.PHONY: all build test clean build-ts test-ts clean-ts reset \
        build-rs test-rs clean-rs

all: build test

build: build-ts

test: test-ts

clean: clean-ts

# TypeScript
build-ts:
	npm run build

test-ts:
	npm test

clean-ts:
	rm -rf dist dist-test

reset:
	npm run reset

# --- Rust (crate in ../rs) ---
build-rs:
	cd ../rs && cargo build --all-targets

# `--all-targets` does NOT include doctests, and ../rs/README.md is
# doctested, so both commands are needed.
test-rs:
	cd ../rs && cargo test --all-targets && cargo test --doc
	cd ../rs && cargo clippy --all-targets --all-features -- -D warnings

clean-rs:
	cd ../rs && cargo clean
