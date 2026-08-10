# SCBD Thesaurus Field Widget: Product Requirements

> **⚠ Target-state PRD (v3.0.0) — this branch is v1.0.0** (one grouped `@scbd/cached-apis`
> multiselect). The in-module data layer, `singleValueDomains`, `GBF_SAMEAS`,
> legacy-SDG migration, Solr guards, and locale files below arrive with the v3.0.0 cutover. See PR #22 (docs/decomp-seams.md) for the migration.

Umbrella PRD for `drupal-module-scbd-field-js`: the browser front end for the SCBD Thesaurus Tags
Drupal field. A living document — append here, never fork a parallel copy.

## Problem Statement

Content managers on SCBD Drupal sites tag content against controlled vocabularies published on
`api.cbd.int`: GBF targets, SDGs, national biodiversity targets, countries, CBD subjects, IUCN
ecosystem types, and others. Plain Drupal taxonomy could model this, but only inefficiently: each
site would maintain its own copy of every vocabulary, kept in sync with the `api.cbd.int`
endpoints by polling, with term names machine-translated per site. Term names are
translated into dozens of languages, a GBF target maps to
related SDGs and subjects, and stored keys have changed over time (`SDG-GOAL-*` vs today's
`SUSTAINABLE-DEVELOPMENT-GOAL-*`). Without a purpose-built widget, managers would rely on those
per-site copies drifting from the source, with no auto-linked relations, and would silently lose
data on an upstream key rename. Site managers also need to control which vocabularies appear, in
what order, and which are preselected — without a developer editing code.

## Solution

A small Vue 3 app, bundled as one IIFE script published to a GitHub release, loaded as a library by
the companion module (`drupal-module-scbd-thesaurus-tags`). The module renders a hidden input
holding the saved value plus a mount point; the widget finds the pair by field name, reads the
saved keys, and renders one searchable multiselect per configured vocabulary ("domain"). The
content manager picks terms by localized name; the widget writes the selected keys back to the
hidden input as a comma-separated string on every change, so Drupal persists them with the form.

The widget owns the awkward parts: it fetches and normalizes each vocabulary from `api.cbd.int`,
localizes term names with fallbacks, auto-links related SDGs and subjects on GBF-target selection,
upgrades legacy SDG keys on read, and degrades quietly on a failed lookup (empty list, logged
error, form still usable). Admin config drives domains, order, and new-entity defaults, so one
bundle serves a general biodiversity site (BL2) and a biosafety site (BSL).

## User Stories

### Content manager — core selection
1. Each vocabulary renders as its own labeled dropdown.
2. Type-to-search within a dropdown.
3. Multi-select domains accept several terms.
4. Single-value domains (organization type, document type, project status, etc.) accept exactly one — a contradictory pair cannot be recorded.
5. Terms show localized names, never raw identifiers.
6. A selected term drops out of a multi-select's options — no duplicate picks.
7. The selection saves on every change; no separate "apply" step.
8. Field help text, when defined, renders above the widget.

### Content manager — loading existing values
9. Previously saved terms appear already selected.
10. A national target saved by its UUID resolves back to its readable title.
11. A saved term whose vocabulary loads slowly still appears once data arrives — hydration never races the fetch and drops the value.
12. A saved biosafety subject hydrates under its parent group.
13. New entities preselect the configured defaults (e.g. GBF Target 17 and the site country on biosafety sites).

### Content manager — GBF auto-linking
14. Choosing a GBF target also adds its related SDGs and CBD subjects.
15. Auto-link adds terms only for domains rendered on the form.
16. Auto-link never removes existing picks — a second target never wipes the first's additions.
17. Choosing an SDG or subject adds nothing back (one-way).
18. Removing a GBF target leaves its added terms selected — nothing is silently stripped.

### Content manager — localization
19. Domain labels and term names render in the interface language (fr, nl, de, es, ru, zh, ar).
20. A term name missing in the active language falls back to another served language, never blank.
21. A language with no shipped label file falls back to English instead of breaking.
22. Arabic renders correctly right-to-left.

### Content manager — resilience
23. One failed vocabulary load leaves the rest of the form usable.
24. A timed-out vocabulary resolves to an empty list; the field never hangs loading.
25. An empty saved value renders empty, not an error.
26. A domain with no options renders nothing at all — no empty dropdown.

### Site manager
27. Configure which domains render and in what order, so each content type shows only the vocabularies it needs.
28. Sensible defaults ship for general and biosafety sites.
29. GBF Target 17 and the site country preselect on new entities, each toggleable off.
30. A debug mode shows the underlying input id beside each dropdown, for diagnosing a misconfigured field.
31. One field can optionally manage a second stored value (the `value2` column), so a single field carries two related selections.

### Drupal integrator / module developer
32. Mounting requires only the field machine name.
33. The hidden input is found by the standard Drupal name, falling back to the auto-generated id, so the widget works regardless of which selector form the form renders.
34. Locale, enabled locales, site countries, and domain order pass through `drupalSettings` — one bundle adapts per site, no rebuild.
35. The saved value is read from the hidden input, not a prop — preloading and defaults stay the host page's job; one source of truth.
36. The mount is guarded to initialize once per element; re-attached behaviors cannot double-mount.
37. A malformed field name is rejected and logged, never used to build a selector.

### Bundle maintainer
38. Vue is an external the host provides; the bundle stays small and matches the site's Vue version.
39. A release publishes exactly the minified script, the stylesheet, and a checksum, so `libraries.yml` can pin known artifacts.
40. The JS source map stays on disk for local debugging, never published.
41. A dev harness simulates the Drupal hidden inputs for the BL2 and BSL profiles — every domain and locale exercisable without Drupal.
42. Adding an interface language means dropping a JSON file into the locales folder; no central list.
43. Default domain lists are defined once and shared by wrapper and inner component, so docs and code cannot drift.

### Data integrity over time
44. Legacy `SDG-GOAL-*` keys read transparently and rewrite to `SUSTAINABLE-DEVELOPMENT-GOAL-*` on the next save.
45. The saved value is a stable, de-duplicated, comma-separated identifier list downstream search and indexing can rely on.

## Implementation Decisions

**Hidden-input contract.** Deliberately no initial-value or auto-add props: the host page owns
preloading (`#default_value`) and new-entity seeding; the hidden input is the single source of
truth and `name` the only required prop.

**In-module data access.** A composable wraps `ofetch` with a request timeout and no caching (no
`@scbd/cached-apis`), returning terms trimmed to `{ identifier, name }`. Every fetch resolves to an
array (empty on unknown domain or error) so one failure cannot reject the shared parallel batch.

**Domain model.** A domain is one vocabulary rendered as one multiselect; single- vs multi-select
is decided by the shared `singleValueDomains` list; grouped domains (biosafety subject groups)
render parents with selectable children. Derived domains: organization and government types split
one API response, document types are a filtered subset, biosafety subject groups are the subjects
with children, and a synthetic localized "Other" organization type is appended.

**Default domain sets.** Shipped defaults are frozen constants defined once, imported by both the
public wrapper and the inner component. Membership and order are load-bearing — order is render
order.

**GBF auto-linking.** Selecting a GBF target fills related SDGs and subjects from a local mapping
table, scoped to the linkable domains (`sdgs`, `subjects`) actually rendered; one-way and add-only.
The lookup reads own properties only, so prototype keys cannot return a non-array.

**Legacy SDG migration.** A saved `SDG-GOAL-NN` key is read as `SUSTAINABLE-DEVELOPMENT-GOAL-NN`
and rewritten on the next save; non-SDG keys pass through untouched.

**National targets via Solr.** National Targets 7 query the `api.cbd.int` Solr index, sorting on
the `_s` string field (sorting a tokenized `_t` field errors). Country and locale tokens are
whitelisted at the boundary and re-asserted inside the query builder (defense in depth) so Solr
metacharacters cannot reach a field name. With multiple locales served, alternate-locale titles are
requested in the same query as a blank-title fallback (see ADR 0002).

**Term name resolution.** Display name prefers `shortTitle`, then `title`, then `name`, each in the
active locale with English fallback, never a non-string. UI labels load on demand per locale;
English is bundled statically as the always-present fallback; a missing locale file warns once and
falls back.

**Build and release.** IIFE bundle exposing one global, Vue external, stylesheet minified with
PurgeCSS. The source map is built `hidden` — on disk for debugging, excluded from the artifact, release assets, and npm
tarball (see ADR 0003). The release tag must match the package version.

## Testing Decisions

Test external behavior through the seams, not internals. The contract: given a saved value and
configured domains, the right terms render selected; given user selections, the right
comma-separated keys are written back (auto-linked additions and migrated keys included).

- **Mounted component (primary seam).** The inner component with `@vue/test-utils`, network mocked,
  exercises the whole read → render → select → write-back path. Regression coverage concentrates
  here: hydration, auto-link, single vs multi write-back, grouped-domain hydration, legacy-SDG
  round-trip.
- **Pure utilities.** Name resolution, the children builder, SDG migration, the relations lookup,
  and the Solr query builder are deterministic and tested directly; query-builder tests assert
  malformed country/locale tokens never reach the query.
- **Composables.** Data access with `ofetch` mocked: normalized shape, per-domain transforms,
  always-an-array-on-error, org/gov-types split.
- **Smoke.** The dev harness mounts the BL2 and BSL profiles without throwing.

## Success Metrics

- **Round-trip fidelity:** first hydration with no user change writes back exactly the saved keys
  after migration, on every domain — national-target identifiers and grouped subjects included.
- **No unhandled failures:** zero uncaught errors or rejections when any fetch fails or times out;
  every fetch resolves to an array; a missing hidden input logs and degrades rather than throwing.
- **Auto-link correctness:** exactly the mapped SDGs/subjects present in rendered domains are
  added, nothing on SDG/subject selection, no prior pick removed — 100% across all 23 targets.
- **Legacy migration:** 100% of `SDG-GOAL-01..17` keys resolve and rewrite to
  `SUSTAINABLE-DEVELOPMENT-GOAL-01..17` on the next save.
- **Localization:** every rendered option has a non-empty label in the active locale or a defined
  fallback, across all served locales including right-to-left.
- **Injection safety:** no country or locale token with Solr metacharacters reaches the index
  query; a malformed primary locale falls back to English.
- **Publish hygiene:** the release contains the minified script, stylesheet, and checksum — no
  source map, no bundled Vue.
- **Tests green:** the full Vitest suite passes, with mounted-component regressions covering the
  cases above.

## Out of Scope

- **The Drupal field type, widget, and admin form** — live in the companion module
  (`scbd_field_thesaurus`, the hidden inputs and mount point, `/admin/config/scbd-field`); this
  repo ships only the browser bundle.
- **A caching layer** — per-page fetches with a timeout replace `@scbd/cached-apis`'s caching,
  source-map, and reverse-lookup features; accepted trade-off.
- **Reverse or transitive auto-linking** — SDG/subject selection never back-fills a target, no
  chaining beyond the single mapping row, deselection never strips.
- **Editing the vocabularies** — the widget reads published data; curation is the Secretariat's
  API and tooling.
- **Bundling Vue** — the host page or Drupal library provides it.
- **Non-Drupal hosting** — standalone HTML is a dev/testing convenience, not a product surface.
- **Offline operation** — `api.cbd.int` is required; no bundled-data mode.

## Further Notes

- One bundle, two site shapes: BL2 (Belgium, four locales) and BSL (six UN languages, grouped
  biosafety subjects). The dev harness encodes both plus an "unused domains" view.
- ADRs live under `docs/adr/`. ADR 0002 (alternate-locale fallback) and ADR 0003 (source-map
  hygiene) are the two most likely to surprise — respect them when touching
  `src/utils/national-targets.js` or the build configuration.
