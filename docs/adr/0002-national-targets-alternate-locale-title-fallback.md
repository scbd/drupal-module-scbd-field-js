# 0002. Request alternate-locale titles as a fallback for National Targets

| status | date | deciders | context | code-path | origin |
|---|---|---|---|---|---|
| proposed | 2026-06-17 | project-lead | module (national-targets) | `src/utils/national-targets.js` | standalone |

> _Applies to the **v3.0.0** widget. `src/utils/national-targets.js` arrives with the v3.0.0 cutover
> (see decomp-seams.md in the seam-doc sibling PR); on this branch (v1.0.0) National Targets is still
> handled inside the legacy `@scbd/cached-apis` bundle._

The `api.cbd.int` Solr index does not populate `title_<LANG>_t` for every served locale on every
target, so a title missing in the current locale would render blank. We request the *other* served
locales' `title_<LANG>_t` fields in the same `index/select` query (`extraTitleFields`) and, when
the primary-locale `name` is empty, fall back to the first available alternate-locale title
(`normalizeNationalTarget`). A slightly wider `fl` list buys a guaranteed non-empty label. Skipped
when only one locale is served, keeping that query lean.

## Considered Options

- **Single-locale `fl` only** (rejected) — untranslated targets render blank, worse than another
  language's title.
- **Second fetch for missing titles** (rejected) — an extra round-trip per page load; alternate
  titles are cheap to include in the original query.
