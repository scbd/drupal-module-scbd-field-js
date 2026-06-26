---
type: project
references: [README.md, docs/adr/0001-record-architecture-decisions.md, docs/adr/0002-national-targets-alternate-locale-title-fallback.md, docs/adr/0003-source-map-hygiene.md]
date: 2026-06-23
---

# SCBD Thesaurus Field Widget: Product Requirements

> **⚠ Target-state PRD (v3.0.0) — this branch is v1.0.0.** This document describes the **target
> v3.0.0** widget, reverse-engineered from the v3.0.0 source on `latest`. The code on this branch is
> the **v1.0.0** bundle (one grouped `@scbd/cached-apis` multiselect); the in-module data layer,
> `singleValueDomains`, `GBF_SAMEAS`, legacy-SDG migration, Solr guards, and locale files described
> below arrive with the v3.0.0 cutover. See [decomp-seams.md](decomp-seams.md) for the migration.

This is the umbrella PRD for `drupal-module-scbd-field-js`, reverse-engineered from the v3.0.0 codebase. It describes the product the bundle delivers: the browser front end for the SCBD Thesaurus Tags Drupal field. Treat it as a living document and append to it as the widget grows; do not fork a parallel copy.

## Problem Statement

Editors on the Secretariat of the Convention on Biological Diversity (SCBD) Drupal sites tag content against controlled vocabularies the Secretariat publishes on `api.cbd.int`: Global Biodiversity Framework targets, Sustainable Development Goals, national biodiversity targets, countries, CBD subjects, IUCN ecosystem types, and others. A plain Drupal text or taxonomy field cannot do this well. The vocabularies live in an external API, not in the local Drupal taxonomy; their term names are translated into dozens of languages; some of them relate to each other (a GBF target maps to a set of SDGs and subjects); and the term keys saved in the database have changed over time (the old `SDG-GOAL-*` keys versus today's `SUSTAINABLE-DEVELOPMENT-GOAL-*`).

Without a purpose-built widget, an editor would have to know and type opaque term identifiers by hand, would not see term names in their working language, would not get the GBF-to-SDG relationships filled in for them, and would silently lose data the moment a vocabulary key was renamed upstream. Site administrators also need to control which vocabularies appear, in what order, and which ones are preselected for new content, without a developer editing code each time.

## Solution

A small Vue 3 application, bundled as a single IIFE script and published to a GitHub release, that the companion Drupal module (`drupal-module-scbd-thesaurus-tags`) loads as a library. On a content form the module renders a hidden text input holding the saved value plus an empty mount point; this bundle finds that pair by field name, reads the saved keys out of the hidden input, and renders one searchable multiselect per configured vocabulary ("domain"). The editor picks terms by their localized names; the widget writes the selected keys back into the same hidden input as a comma-separated string on every change, so Drupal persists them with the rest of the form. Nothing else in the form has to know the widget exists.

The widget owns the awkward parts: it fetches and normalizes each vocabulary from `api.cbd.int`, localizes term names to the editor's language with sensible fallbacks, fills in related SDGs and subjects when a GBF target is chosen, transparently upgrades legacy SDG keys on read, and degrades quietly (an empty option list, a logged error, the rest of the form still usable) when a lookup fails. Administrators drive which domains render, their order, and the new-entity defaults through the companion module's admin form, so the same bundle serves a general biodiversity site (BL2) and a biosafety site (BSL) with only configuration changing.

## User Stories

### Content editor: core selection
1. As a content editor, I want each vocabulary to render as its own labeled dropdown, so that I can tell the GBF targets apart from the SDGs apart from the countries.
2. As a content editor, I want to search within a dropdown by typing, so that I can find a term without scrolling a long list.
3. As a content editor, I want to pick several terms in a multi-select domain, so that I can tag content with more than one GBF target or subject.
4. As a content editor, I want single-value domains (organization type, document type, project status, and the like) to accept exactly one choice, so that I cannot record a contradictory pair.
5. As a content editor, I want each term shown by its name rather than its raw identifier, so that I never have to know the codes the system stores.
6. As a content editor, I want an already-selected term to drop out of the available options in a multi-select, so that I do not pick the same term twice.
7. As a content editor, I want my selection saved automatically as I change it, so that I do not have to press a separate "apply" button before saving the form.
8. As a content editor, I want help text rendered above the widget when the field defines it, so that I understand what I am tagging.

### Content editor: loading existing values
9. As a content editor opening an existing item, I want my previously saved terms to appear already selected, so that I am editing the real value and not starting over.
10. As a content editor, I want a national target that was saved by its UUID to resolve back to its readable title, so that I recognize what was chosen.
11. As a content editor, I want a saved term whose vocabulary is slow to load to still appear once the data arrives, so that hydration does not race the fetch and drop my value.
12. As a content editor, I want a saved biosafety subject to show up under its parent group, so that grouped domains hydrate correctly.
13. As a content editor on a brand-new item, I want the field's configured defaults (for example GBF Target 17 and my site's country on biosafety sites) to be preselected, so that I start from the expected baseline.

### Content editor: GBF auto-linking
14. As a content editor, I want choosing a GBF target to also add its related SDGs and CBD subjects, so that I do not have to remember and re-enter the mapping by hand.
15. As a content editor, I want auto-linking to only add terms for the domains actually shown on my form, so that I am not given options that do not exist here.
16. As a content editor, I want auto-linking to leave my existing picks in place, so that selecting a second GBF target never wipes out the first one's additions.
17. As a content editor, I want choosing an SDG or a subject to add nothing automatically, so that the relationship works in one direction only and does not surprise me.
18. As a content editor, I want removing a GBF target to leave the SDGs and subjects it added still selected, so that the widget never silently strips terms I may have meant to keep.

### Content editor: localization
19. As a French, Dutch, German, Spanish, Russian, Chinese, or Arabic speaking editor, I want domain labels and term names in my interface language, so that I can work without reading English.
20. As an editor, I want a term whose name is missing in my language to fall back to another served language rather than render blank, so that no option is unlabeled.
21. As an editor whose language has no shipped label file, I want the widget to fall back to English instead of breaking, so that the field still works.
22. As an Arabic-speaking editor, I want the widget to behave correctly in a right-to-left layout, so that the form reads naturally.

### Content editor: resilience and edge cases
23. As a content editor, I want the rest of the form to stay usable when one vocabulary fails to load, so that an API hiccup does not block my work.
24. As a content editor, I want a vocabulary that times out to resolve to an empty list rather than spin forever, so that the field never hangs in a perpetual loading state.
25. As a content editor, I want an empty saved value to render empty cleanly, so that a new field shows nothing selected rather than an error.
26. As a content editor, I want a domain with no available options to render nothing at all, so that I am not shown an empty, unusable dropdown.

### Site administrator
27. As a site administrator, I want to set which domains render and in what order, so that each content type shows only the vocabularies it needs.
28. As a site administrator, I want sensible defaults for general and biosafety sites, so that I do not have to configure every field from scratch.
29. As a site administrator, I want to preselect GBF Target 17 and the site country on new entities, and to be able to turn each default off, so that biosafety content starts correctly without forcing the choice.
30. As a site administrator, I want a debug mode that shows the underlying input id beside each dropdown, so that I can diagnose a misconfigured field.
31. As a site administrator, I want a single field to optionally manage a second stored value (the `value2` column), so that one field can carry two related selections.

### Drupal integrator / module developer
32. As a Drupal integrator, I want to mount the widget with only the field machine name required, so that wiring a field takes minimal configuration.
33. As a Drupal integrator, I want the widget to find its hidden input by the standard Drupal name and to fall back to the Drupal auto-generated id, so that it works regardless of which selector form the form renders.
34. As a Drupal integrator, I want to pass the current locale, the enabled locales, the site countries, and the domain order through `drupalSettings`, so that one bundle adapts to each site without a rebuild.
35. As a Drupal integrator, I want the widget to read the saved value straight from the hidden input rather than as a prop, so that preloading and new-entity defaults stay the host page's job and the contract has one source of truth.
36. As a Drupal integrator, I want the mount guarded so the app initializes once per element, so that Drupal behaviors re-attaching does not double-mount the widget.
37. As a Drupal integrator, I want a malformed field name to be rejected and logged rather than used to build a selector, so that a bad configuration cannot break or misdirect the input lookup.

### Bundle maintainer
38. As the bundle maintainer, I want Vue treated as an external dependency the host provides, so that the published bundle stays small and matches the site's Vue version.
39. As the bundle maintainer, I want a release to publish exactly the minified script, the stylesheet, and a checksum, so that the Drupal `libraries.yml` can pin known artifacts.
40. As the bundle maintainer, I want the JavaScript source map kept on disk for local debugging but never published, so that the original source is not downloadable from the CDN or release.
41. As the bundle maintainer, I want a local dev harness that simulates the Drupal hidden inputs across the BL2 and BSL site profiles, so that I can exercise every domain and locale without a running Drupal.
42. As the bundle maintainer, I want adding a new interface language to be as simple as dropping a JSON file into the locales folder, so that there is no central list to keep in sync.
43. As the bundle maintainer, I want the default domain lists defined once and shared by the wrapper and the inner component, so that the documented defaults and the code cannot drift apart.

### Data integrity over time
44. As a data owner, I want legacy `SDG-GOAL-*` keys read transparently and rewritten to the current `SUSTAINABLE-DEVELOPMENT-GOAL-*` keys on the next save, so that older content keeps working and converges to the current scheme.
45. As a data owner, I want the saved value to be a stable, de-duplicated, comma-separated list of identifiers, so that downstream search and indexing can rely on the format.

## Implementation Decisions

**Hidden-input contract.** The widget reads its saved selection directly from the hidden Drupal input located by field name, and writes the selection back to that same input on every change. It deliberately takes no initial-value or auto-add prop. The host page owns preloading (Drupal's `#default_value`) and new-entity seeding (the behavior merges configured defaults into an empty input before mount). This keeps a single source of truth for the value and a thin prop surface (only `name` is required).

**In-module data access.** Vocabulary access is implemented in-module rather than depending on `@scbd/cached-apis`. A composable wraps `ofetch` with a request timeout and no caching layer, returning terms trimmed to the `{ identifier, name }` shape the widget consumes. Every fetch resolves to an array (empty on unknown domain or error) so a single failure cannot reject the shared batch that loads all domains in parallel.

**Domain model.** A "domain" is one controlled vocabulary rendered as one multiselect. Domains are either multi-select (array selection) or single-select (one term or null), decided by membership in a single shared `singleValueDomains` list. Grouped domains (biosafety subject groups) render parent groups with selectable children. Several domains derive from a shared source: organization types and government types split the same API response, document types are a filtered subset, biosafety subject groups are the subjects that have children, and a synthetic localized "Other" organization type is appended to the org types list.

**Default domain sets.** The shipped default multi-value and single-value domain lists are frozen constants defined once and imported by both the public wrapper and the inner component, so documentation and code stay in lockstep. Membership and order are load-bearing because order is render order.

**GBF auto-linking.** Selecting a GBF target fills its related SDGs and CBD subjects from a local mapping table, scoped to the linkable domains (`sdgs`, `subjects`) and only for domains actually rendered. The relationship is one-way (only GBF target identifiers resolve to a related list) and add-only (existing picks are never stripped). The lookup reads own properties only, so prototype keys cannot return a non-array and break the caller.

**Legacy SDG migration.** Saved keys are normalized on read: a legacy `SDG-GOAL-NN` key is upgraded to `SUSTAINABLE-DEVELOPMENT-GOAL-NN` so the option still resolves, and is rewritten to the new key on the next save. Non-SDG keys pass through untouched.

**National targets via Solr.** National Targets 7 come from the `api.cbd.int` Solr index rather than a thesaurus domain, so their fetch and query building live separately. The query sorts on the `_s` string field (sorting a tokenized `_t` field returns an error from the index). Country and locale tokens are whitelisted at the boundary and re-asserted inside the query builder (defense in depth) so Solr metacharacters cannot be injected into field names. When more than one locale is served, alternate-locale titles are requested in the same query and used as a fallback when the primary-locale title is empty, so no option renders blank (see ADR 0002).

**Term name resolution.** A term's display name prefers its short title, then its title, then its plain name, each resolved to the active locale with an English fallback, and never returns a non-string. UI labels (domain names, group labels, the "Other" type) are loaded on demand per requested locale through reactive translations; English is bundled statically as the always-present fallback, and a missing locale file warns once and falls back to English.

**Build and release.** The app is built as an IIFE bundle exposing a single global, with Vue marked external and provided by the host. The stylesheet is minified with PurgeCSS. A release publishes only the minified script, the stylesheet, and a checksum file; the JavaScript source map is built as `hidden` so it stays on disk for local debugging but is never published, and is excluded from the artifact, the release assets, and the npm tarball (see ADR 0003). The release tag must match the package version.

## Testing Decisions

Test external behavior, not internals. The product's externally observable contract is: given a saved value in the hidden input and a set of configured domains, the widget renders the right selected terms, and given user selections, it writes the right comma-separated keys back to the hidden input (including auto-linked additions and migrated keys). Tests should drive that contract through the seams below rather than asserting private function shapes.

**Highest seam, the mounted component.** Mounting the inner component with `@vue/test-utils`, with the network mocked, exercises the whole read, render, select, write-back path in one place. This is the primary seam and where regression coverage should concentrate: hydrating a saved value, the GBF auto-link additions, single versus multi-select write-back, grouped-domain hydration, and the legacy SDG migration round-trip. Prior art already in the repo: the component test, the regression test, and the auto-link test under `src/components/`.

**Pure utility seam.** The framework-free helpers (name resolution, the children builder, SDG migration, the relations lookup, and the Solr query builder) are deterministic functions and are tested directly. Prior art: the tests under `src/utils/`. The Solr query builder tests should assert that malformed country and locale tokens are dropped and never reach the query.

**Composable seam.** Data access (the taxonomies composable and national-targets fetch) is tested with `ofetch` mocked, asserting the normalized shape, the per-domain transforms, the always-an-array-on-error guarantee, and the org-types/gov-types split. Prior art: the taxonomies and national-targets tests.

**Smoke seam.** A smoke test over the dev harness confirms the BL2 and BSL profiles mount and render without throwing. Prior art: the harness smoke test under `src/dev/`.

## Success Metrics

- **Round-trip fidelity:** for any saved value, the keys written back to the hidden input on first hydration (with no user change) equal the saved keys after legacy-key migration. Target: exact match on every configured domain, including national-target UUIDs and grouped subjects.
- **No unhandled failures on the load or interaction path:** zero uncaught errors or unhandled rejections when any single vocabulary fetch fails or times out. Baseline and target: every fetch resolves to an array, the parallel load never rejects, and a missing hidden input logs and degrades rather than throwing.
- **Auto-link correctness:** selecting a GBF target adds exactly the related SDGs and subjects from the mapping that exist in the rendered domains, adds nothing for SDG or subject selections, and never removes a prior pick. Target: 100% match against the mapping table across all 23 targets.
- **Legacy migration:** 100% of `SDG-GOAL-01..17` keys read from saved values resolve to options and are rewritten to `SUSTAINABLE-DEVELOPMENT-GOAL-01..17` on the next save.
- **Localization coverage:** every rendered option has a non-empty label in the active locale or a defined fallback (no blank options), across all served locales including right-to-left.
- **Injection safety:** no country or locale token containing Solr metacharacters ever reaches the index query; malformed tokens are dropped and a malformed primary locale falls back to English.
- **Publish hygiene:** the published release contains the minified script, the stylesheet, and the checksum, and contains no source map; the bundle does not include Vue.
- **Tests green:** the full Vitest suite passes, with the mounted-component regression tests covering hydration, auto-link, single/multi write-back, grouped hydration, and migration.

## Out of Scope

- **The Drupal field type, widget, and admin form.** Defining `scbd_field_thesaurus`, rendering the hidden inputs and mount point, and the `/admin/config/scbd-field` settings UI all live in the companion module `drupal-module-scbd-thesaurus-tags`, not here. This repo only builds and publishes the browser bundle.
- **A caching layer.** The in-module data access intentionally drops the caching, source-map, and reverse-lookup features of the former `@scbd/cached-apis` dependency. Per-page fetches with a timeout are the accepted trade-off.
- **Reverse or transitive auto-linking.** Selecting an SDG or a subject never back-fills a GBF target, and auto-linking does not chase relationships beyond the single mapping row. Deselecting never strips linked terms.
- **Editing the vocabularies.** The widget reads published thesaurus and index data; creating, editing, or curating terms is the Secretariat's API and tooling, not this widget.
- **Bundling Vue.** Vue is provided by the host page or the Drupal library; the bundle will not ship its own copy.
- **Non-Drupal hosting as a product surface.** The standalone HTML usage exists only as a development and testing convenience. Drupal, via the companion module, is the supported host.
- **Offline operation.** The widget requires `api.cbd.int`; there is no offline or bundled-data mode.

## Further Notes

- The widget serves two site shapes from one bundle: a general biodiversity site (BL2, Belgium, four locales) and a biosafety site (BSL, six UN languages, with the grouped biosafety subjects domain). The dev harness encodes both profiles plus an "unused domains" view so every domain is reachable while testing.
- Architecture decisions are recorded under `docs/adr/`. The national-targets alternate-locale fallback (ADR 0002) and the source-map hygiene policy (ADR 0003) are the two decisions most likely to surprise a new contributor; respect them when touching `src/utils/national-targets.js` or the build configuration.

