// Bundle entry for the demo on tabnas.github.io/gbnf.
//
//   npm run build-demo     ->  docs/gbnf-demo.js
//
// The site is served by GitHub Pages straight out of docs/ with no build
// step (see .github/workflows/pages.yml), so the bundle is COMMITTED.
// That is the same arrangement tabnas.github.io/chess uses for
// chess-view.js: a sibling file loaded relatively, no third-party host,
// which is what "no external requests" means for these pages.
//
// Rebuild it whenever the parser or this front-end changes in a way the
// demo should show. It pins nothing itself — it bundles whatever
// ts/node_modules currently resolves, so `npm i` first if you want the
// published versions rather than your working tree.
//
// Only the two names the page actually calls are exported. Everything
// else esbuild tree-shakes away.
import { Tabnas } from '@tabnas/parser'
import { gbnf } from '../dist/gbnf.js'

globalThis.tabnasGbnfDemo = { Tabnas, gbnf }
