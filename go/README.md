# github.com/tabnas/gbnf/go

Go port of [`@tabnas/gbnf`](../ts) — a llama.cpp GBNF front-end for the
[tabnas](https://github.com/tabnas/parser) parsing engine.

**Port status: not yet implemented.** The TypeScript implementation is
canonical and lands first by design. This module currently exposes only
`VERSION`, so it builds and the release tooling has something to check.

The front-end is ported in a later change, mirroring
[`ts/src/converter.ts`](../ts/src/converter.ts). The dialect, and the
scannerless limitations recorded in
[`ts/doc/known-gaps.md`](../ts/doc/known-gaps.md), are the contract this
port will be held to.
