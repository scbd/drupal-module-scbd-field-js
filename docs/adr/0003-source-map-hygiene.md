---
status: accepted
date: 2026-06-19
deciders: [randy]
context: system-wide
code-path: vite.config.js
origin: planning (final-touches-plan, D3)
---

# 0003. Stop publishing the JS source map for the IIFE bundle

The release pipeline previously emitted and published `dist/index.min.js.map` alongside the minified
IIFE bundle — as a GitHub release asset and inside the CI build artifact. A public source map exposes
the original, unminified source (component templates, comments, internal structure) to anyone who
fetches it from the CDN or release, which is the SEC-1 / CR-9 finding.

We set Vite `build.sourcemap: 'hidden'` instead of `false`. `'hidden'` keeps the `.map` file on disk
for local debugging but omits the `//# sourceMappingURL=` comment from `dist/index.min.js`, so a
browser will not auto-fetch the map. Because `'hidden'` still *writes* the file, CI must additionally
strip it from every publish path: the `gh release upload` / `gh release download` lists and the
`Verify dist contract` / `Generate checksums` steps drop all `index.min.js.map` references, and the
`actions/upload-artifact` step excludes it with a `!dist/*.map` negation pattern.

## Considered Options

- **`sourcemap: false`** (rejected) — never emits a map, so nothing to strip, but loses local
  debuggability of `yarn build` output entirely.
- **`sourcemap: 'hidden'` + CI strip** (chosen) — original source is no longer downloadable from the
  CDN or release, yet a local `yarn build` still produces `dist/index.min.js.map` for debugging. The
  cost is the CI strip / artifact-negation steps needed because `'hidden'` still writes the file to
  disk.
- **`sourcemap: true`, restrict map visibility downstream** (rejected) — relies on CDN/web-server
  config to block `.map` requests; brittle and easy to misconfigure, and the map would still be a
  published release asset.
