# SCBD Thesaurus Field Widget

Glossary for the browser front-end of the SCBD Thesaurus Tags Drupal field: a Vue 3 widget
rendering searchable multiselects for the controlled vocabularies the Secretariat of the Convention
on Biological Diversity (SCBD) publishes on `api.cbd.int`, reading and writing the content
manager's selection through a hidden Drupal input. One word means one thing — use these words in
code, comments, commits, the README, and the architecture doc.

## Language

### Host and contract

**Widget**:
The Vue 3 app this repo builds, rendered inside a Drupal field as searchable multiselects. No
database, no durable state; reads and writes the selection through the Hidden input.
_Avoid_: plugin, control, the field (it renders inside a field, it is not the field)

**Bundle**:
The single IIFE artifact the build produces (`index.min.js` plus `style.css`), published to a
GitHub release and loaded by Drupal as a library.
_Avoid_: build, dist, package, script

**Companion module**:
The separate Drupal repo `drupal-module-scbd-thesaurus-tags`: field type, widget element, admin
settings; loads the Bundle from its release. It owns the Drupal half of the contract, this repo the
browser half.
_Avoid_: the module (ambiguous), host module, Drupal plugin

**Drupal behavior**:
The Companion module's JS that reads `drupalSettings`, seeds Auto-add keys into an empty Hidden
input, and mounts the Widget once per element.
_Avoid_: loader, bootstrap, init script

**Field machine name** (`name`):
The Drupal field machine name without the `field_` prefix (e.g. `tags`). The only required prop;
locates both the mount div and the Hidden input.
_Avoid_: field id, field name, element title (the `drupalSettings` key is `element_title`; the prop is `name`)

**Hidden input**:
The Drupal `<input>` holding the field's Saved value — the Widget's single source of truth. Read at
mount, rewritten on every change.
_Avoid_: store, model, state, textbox, field

**value / value2**:
The two `text/big` columns the field type stores. `value` is the primary selection; `value2` the
optional second, read by an Additional field.
_Avoid_: primary/secondary, column A/B

**Additional field** (`isAdditionalField`):
A Widget instance bound to `value2` instead of `value`, so one Drupal field can carry two related
selections.
_Avoid_: secondary widget, second field, value2 widget

**Auto-add**:
Keys seeded into an *empty* Hidden input before mount on a new entity (e.g. `GBF-TARGET-17` and the
site country on biosafety sites). The host page's job, not a Widget prop; applies only when nothing
is saved yet.
_Avoid_: initial value, default value (dead props the Widget no longer reads), preselect, seed prop

**Saved value**:
The de-duplicated comma-separated string of Term identifiers in the Hidden input, rewritten on
every change. National-target identifiers are the Solr `uniqueIdentifier_s` value (e.g.
`ort-nt7-be-276962-2`); the rest are slug keys.
_Avoid_: payload, selection string, CSV

### Vocabularies and terms

**Domain**:
One controlled vocabulary, rendered as one labeled multiselect and named by a domain key (e.g.
`gbfTargets`, `sdgs`). The unit a site turns on, orders, and configures single- or multi-select.
_Avoid_: vocabulary, taxonomy, category, dropdown, field, list

**Thesaurus**:
The vocabulary as it lives on `api.cbd.int`, fetched from the thesaurus terms endpoint. A Domain is
usually backed by one Thesaurus; National Targets 7 comes from the Solr index instead.
_Avoid_: dictionary, Drupal taxonomy, glossary

**Term**:
One selectable option within a Domain, trimmed to `{ identifier, name }` (plus `children` in a
Grouped domain). Everything else the API returns is dropped.
_Avoid_: option, tag, item, record, value

**Identifier** (key):
The stable string that names a Term and is what gets stored: a slug (`GBF-TARGET-03`,
`SUSTAINABLE-DEVELOPMENT-GOAL-14`) for most domains; for National Targets 7 the Solr
`uniqueIdentifier_s` value (e.g. `ort-nt7-be-276962-2`), an opaque non-UUID string. "Keys" in code
means the Identifiers parsed out of a Saved value.
_Avoid_: id, code, GUID

**Display name**:
A Term's localized label, resolved `shortTitle` then `title` then `name`, each for the active
locale with an English fallback, never a non-string. What the content manager sees and searches;
the Identifier is never shown.
_Avoid_: title, label (label is the Domain label, not a Term's name)

**lString**:
A per-locale string map (`{ en: '...', fr: '...' }`) that thesaurus titles arrive as; resolving one
to a locale (falling back to `en`) produces a Display name.
_Avoid_: i18n object, translation map, localized string (name it lString once in scope)

**Domain label**:
The translated heading above a Domain's multiselect, from the bundled locale files, not the
Thesaurus. Distinct from a Display name, which labels a Term.
_Avoid_: domain name, UI label, caption

### Domain kinds

**Single-value domain**:
Holds exactly one Term or null and renders single-select. Membership is decided solely by the
shared `singleValueDomains` list.
_Avoid_: singleField, single field (the removed grouped-field path), single-select (the rendering, not the domain)

**Multi-value domain**:
Holds an array of Terms and renders multi-select with picked Terms hidden from the list. Every
Domain not in `singleValueDomains`.
_Avoid_: multi-select (the rendering, not the domain), array domain

**Grouped domain**:
Terms nest under parent groups with selectable children (today only `bchSubjectGroups`). Detected
by "group" in the domain key; built by resolving each parent's `narrowerTerms` into a `children`
array.
_Avoid_: nested domain, hierarchical domain, tree, parent domain

**Domain order**:
The ordered domain keys a site renders, set in the admin form (one per line). Load-bearing: it is
render order.
_Avoid_: domain list, field order, layout

### The specific domains

**GBF Target**:
A Global Biodiversity Framework target, `GBF-TARGET-01` through `GBF-TARGET-23` (`gbfTargets`). The
only Domain whose selection triggers Auto-link.
_Avoid_: Aichi target (an older framework appearing only inside the Relation table — it is **ignored**), biodiversity target, target (ambiguous with National Targets 7)

**National Targets 7**:
National biodiversity targets (`nationalTargets7`) from the `api.cbd.int` Solr index, scoped by the
`countries` prop and identified by the opaque `uniqueIdentifier_s` value (e.g.
`ort-nt7-be-276962-2`) rather than a slug. The "7" is the index schema name (`nationalTarget7`),
not a count.
_Avoid_: national targets, NBT, GBF target, country targets

**SDG**:
A Sustainable Development Goal, `SUSTAINABLE-DEVELOPMENT-GOAL-01` through `-17` (`sdgs`). Older
Saved values used `SDG-GOAL-*` keys (see Legacy SDG migration). One of the two Linkable domains.
_Avoid_: development goal, goal, SDG-GOAL (the legacy key form)

**CBD Subject**:
A thematic area from the `CBD-SUBJECTS` Thesaurus (`CBD-SUBJECT-*`), in `subjects`. The other
Linkable domain.
_Avoid_: subject area, topic, theme, category, tag

**BCH Subject**:
A Biosafety Clearing-House thematic area (`bchSubjects`); as a Grouped domain, `bchSubjectGroups`
(the BCH Subjects with children). A biosafety-site concern, not a shipped default.
_Avoid_: CBD Subject (a different Thesaurus), biosafety topic

**Organization type / Government type**:
Two Single-value domains (`orgTypes`, `govTypes`) split from the *same* API response: government
types are the few excluded Identifiers, organization types the rest plus the synthetic "Other".
_Avoid_: org/gov (spell out), entity type

**"Other" organization type**:
A synthetic Term (`ORG-TYPE-OTHER`) appended to `orgTypes` because the Thesaurus has none; its
title comes from each locale file's `other` key.
_Avoid_: misc, unknown type, custom type

### Relations

**Auto-link**:
Adding a selected GBF Target's related SDGs and CBD Subjects into those Domains. Fires only on
select, only into rendered Linkable domains configured multi-select.
_Avoid_: sync, mirror, cascade, relate, link (bare)

**One-way / add-only**:
Auto-link's two defining properties. One-way: only a GBF Target selection fills anything. Add-only:
existing picks are never removed; deselecting a GBF Target leaves its added Terms in place.
_Avoid_: two-way, bidirectional, reciprocal, transitive

**Linkable domain**:
A Domain Auto-link may fill: exactly `sdgs` and `subjects`. Aichi ids and stray GUIDs in a related
list are ignored for free — they match no Term in a Linkable domain.
_Avoid_: related domain, target domain, linked domain

**Relation table** (`GBF_SAMEAS`):
The static map from each GBF Target Identifier to its related Identifiers — the one and only source
of Auto-link relations. Terms carry no `sameAs` array.
_Avoid_: sameAs (the removed per-term decoration), relations map, lookup table

### Lifecycle and data

**Hydrate**:
Resolve the saved keys against the already-loaded Domain options into selected Term objects, then
write the normalized value back. Not Vue's SSR hydration.
_Avoid_: load, populate, initialize, rehydrate

**Legacy SDG migration**:
Reading a legacy `SDG-GOAL-NN` key as the current `SUSTAINABLE-DEVELOPMENT-GOAL-NN` Identifier so
the option still resolves, rewriting it on the next save. Non-SDG keys pass through untouched.
_Avoid_: SDG upgrade, key remap, conversion

### Site profiles

**BL2**:
The general biodiversity profile (Belgium; locales en/fr/nl/de) served by the shipped default
Domains. One of the two dev-harness profiles.
_Avoid_: bioland, default site, main site

**BSL**:
The biosafety profile (six UN languages; Grouped `bchSubjectGroups` and its own Domain order).
Differs from BL2 by configuration only; the same Bundle serves both.
_Avoid_: BCH (the data source, not the profile), biosafety site
