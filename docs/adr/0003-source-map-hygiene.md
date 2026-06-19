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
browser will not auto-fetch the map. Because `'hidden'` still *writes* the file, every publish path
must exclude it: the `actions/upload-artifact` step drops it with a `!dist/*.map` negation pattern
(`.github/workflows/ci.yml`); the `release-assets` job never lists the map (it uploads only
`index.min.js`, `style.css`, and `SHA256SUMS`); and the npm tarball excludes it via an explicit
`files` allowlist in `package.json` (`dist/index.min.js` + `dist/style.css`, not `dist/*`). The map
therefore never leaves a developer's machine.

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
