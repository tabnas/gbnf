# Build, test and publish the TypeScript (ts/) implementation.
#
# The Go port (go/) is not written yet: `@tabnas/gbnf` compiles GBNF to a
# pure-data GrammarSpec, so Go can already LOAD a spec this compiler
# produced, but it cannot read `.gbnf` text until the front-end is ported.
# The go-* targets are kept, and are no-ops until then.
#
# Local build/test resolve the unpublished @tabnas siblings via the
# repo-set node_modules symlinks (admin/scripts/link.sh).

.PHONY: all build test clean build-ts build-go test-ts test-go \
        clean-ts clean-go publish-ts publish-go tags-go reset

all: build test

build: build-ts

test: test-ts

clean: clean-ts

# --- TypeScript (package in ts/) ---
build-ts:
	cd ts && npm run build

test-ts:
	cd ts && npm test

clean-ts:
	rm -rf ts/dist ts/dist-test

# Publish the TypeScript package at its current package.json version.
publish-ts: test-ts
	cd ts && npm publish --access public

# --- Go (module in go/) — not implemented yet ---
build-go:
	@echo "go/: GBNF front-end not ported yet; nothing to build"

test-go:
	@echo "go/: GBNF front-end not ported yet; nothing to test"

clean-go:
	@echo "go/: GBNF front-end not ported yet; nothing to clean"

publish-go:
	@echo "go/: GBNF front-end not ported yet; nothing to publish"

# List published Go module tags, newest first.
tags-go:
	git tag -l 'go/v*' --sort=-version:refname

reset:
	cd ts && npm run reset
