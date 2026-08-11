# Build, test and publish the TypeScript (ts/) implementation, and
# build/test the Go port (go/).
#
# The aggregate targets (build/test/clean) stay ts-only so they never
# demand a Go toolchain; run the -go targets explicitly. Go releases are
# `go/v*` tags served by the module proxy (see .github/workflows), so
# publish-go stays an echo.
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

# --- Go (module in go/) ---
build-go:
	cd go && go build ./...

test-go:
	cd go && go test ./...

clean-go:
	cd go && go clean

publish-go:
	@echo "go/: published by pushing a go/v* tag; see tags-go"

# List published Go module tags, newest first.
tags-go:
	git tag -l 'go/v*' --sort=-version:refname

reset:
	cd ts && npm run reset
