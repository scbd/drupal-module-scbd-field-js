---
status: accepted
date: 2026-06-17
deciders: [project-lead]
context: system-wide
code-path: src/utils/national-targets.js
origin: standalone
---

# 0002. Request alternate-locale titles as a fallback for National Targets

The National Targets 7 widget displays one locale at a time, but the `api.cbd.int` Solr index does
not have a populated `title_<LANG>_t` for every served locale on every target — so an option whose
title is missing in the current locale would render blank. We therefore request the *other* served
locales' `title_<LANG>_t` fields in the same `index/select` query (`extraTitleFields`) and, when the
primary-locale `name` is empty, fall back to the first available alternate-locale title
(`normalizeNationalTarget`). This trades a slightly wider `fl` field list for guaranteeing every
target shows a non-empty label. The fallback is skipped when only one locale is served (nothing to
fall back to), keeping the single-locale query lean.

## Considered Options

- **Single-locale `fl` only** (rejected) — simplest query, but untranslated targets render with an
  empty label, which is worse than showing the target's name in another language.
- **Second fetch for missing titles** (rejected) — an extra round-trip per page load to backfill
  blanks; the alternate titles are cheap to include in the original query instead.
