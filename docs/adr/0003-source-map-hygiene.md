---
status: proposed
date: 2026-06-19
deciders: [project-lead]
context: module (build/release)
code-path: vite.config.js
origin: planning (v3.0.0 final-touches plan, decision D3)
---

# 0003. Stop publishing the JS source map for the IIFE bundle

> _Applies to the **v3.0.0** widget. `vite.config.js` exists on this branch, but the
> `.github/workflows/ci.yml` strip step and the `package.json` `files` allowlist
> (`dist/index.min.js` + `dist/style.css`) described below land with the v3.0.0 cutover (see
> [decomp-seams.md](../decomp-seams.md))._

Publishing `dist/index.min.js.map` (as a release asset and inside the CI artifact) exposes the
original unminified source — templates, comments, structure — to anyone fetching it from the CDN or
release (the SEC-1 / CR-9 finding).

We set Vite `build.sourcemap: 'hidden'`: the `.map` stays on disk for local debugging, but the
`//# sourceMappingURL=` comment is omitted from `dist/index.min.js`, so browsers never auto-fetch
it. Because `'hidden'` still *writes* the file, every publish path excludes it: the
`actions/upload-artifact` step drops it via a `!dist/*.map` negation (`.github/workflows/ci.yml`);
the `release-assets` job uploads only `index.min.js`, `style.css`, and `SHA256SUMS`; the npm
tarball uses an explicit `files` allowlist in `package.json` (`dist/index.min.js` +
`dist/style.css`, not `dist/*`). The map never leaves a developer's machine.

## Considered Options

- **`sourcemap: false`** (rejected) — nothing to strip, but loses local debuggability of
  `yarn build` output entirely.
- **`sourcemap: 'hidden'` + CI strip** (chosen) — source no longer downloadable, local debugging
  kept; the cost is the strip/negation steps because `'hidden'` still writes the file.
- **`sourcemap: true` + downstream blocking** (rejected) — relies on CDN/web-server config to block
  `.map` requests; brittle, and the map would still be a published release asset.
