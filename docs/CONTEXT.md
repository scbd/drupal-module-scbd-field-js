# SCBD Thesaurus Field Widget

The browser front-end for the SCBD Thesaurus Tags Drupal field: a Vue 3 widget that renders
searchable multiselects for the controlled vocabularies the Secretariat of the Convention on
Biological Diversity (SCBD) publishes on `api.cbd.int`, reading and writing the editor's selection
through a hidden Drupal input. This glossary fixes the words the code, comments, commit messages,
README, and architecture doc all use for those concepts, so one word means one thing.

## Language

### Host and contract

**Widget**:
The Vue 3 application this repo builds, rendered inside a Drupal field as one or more searchable
multiselects. It holds no database and no durable state of its own; it reads and writes the editor's
selection through the Hidden input.
_Avoid_: plugin, control, the field (the Widget renders inside a field, it is not the field)

**Bundle**:
The single IIFE artifact the build produces (`index.min.js` plus `style.css`) and publishes to a
GitHub release. The Bundle is how the Widget ships; Drupal loads it as a library.
_Avoid_: build, dist, package, script

**Companion module**:
The separate Drupal repo `drupal-module-scbd-thesaurus-tags` that defines the field type, the widget
element, and the admin settings, and loads the Bundle from its release. It owns the Drupal half of
the contract; this repo owns the browser half.
_Avoid_: the module (ambiguous), host module, Drupal plugin

**Drupal behavior**:
The Companion module's JavaScript that reads `drupalSettings`, seeds Auto-add keys into an empty
Hidden input, and mounts the Widget once per element.
_Avoid_: loader, bootstrap, init script

**Field machine name** (`name`):
The Drupal field's machine name without the `field_` prefix (for example `tags`). The only required
prop; it locates both the mount div and the Hidden input.
_Avoid_: field id, field name, element title (the `drupalSettings` key is `element_title`, but the prop and code call it `name`)

**Hidden input**:
The Drupal `<input>` that holds the field's Saved value. It is the Widget's single source of truth:
the Widget reads the saved keys from it at mount and writes the selection back to it on every change.
_Avoid_: store, model, state, textbox, field

**value / value2**:
The two `text/big` columns the field type stores. `value` is the primary selection; `value2` is the
optional second selection, read when the Widget is mounted as an Additional field.
_Avoid_: primary/secondary, column A/B

**Additional field** (`isAdditionalField`):
A Widget instance bound to the `value2` column instead of `value`, so one Drupal field can carry two
related selections.
_Avoid_: secondary widget, second field, value2 widget

**Auto-add**:
Keys seeded into an *empty* Hidden input before mount on a new entity (for example `GBF-TARGET-17`
and the site country on biosafety sites). Auto-add is the host page's job, not a Widget prop, and
applies only when nothing is saved yet.
_Avoid_: initial value, default value (the dead props the Widget no longer reads), preselect, seed prop

**Saved value**:
The comma-separated string of Term identifiers persisted in the Hidden input and rewritten on every
change. De-duplicated; national-target identifiers are the Solr `uniqueIdentifier_s` value (for example
`ort-nt7-be-276962-2`), the rest are slug keys.
_Avoid_: payload, selection string, CSV

### Vocabularies and terms

**Domain**:
One controlled vocabulary, rendered as one labeled multiselect and named by a domain key (for example
`gbfTargets`, `sdgs`). A Domain is the unit a site turns on, orders, and configures as single- or
multi-select.
_Avoid_: vocabulary, taxonomy, category, dropdown, field, list

**Thesaurus**:
The controlled vocabulary as it lives on `api.cbd.int`, fetched from the thesaurus terms endpoint. A
Domain is usually backed by one Thesaurus; National Targets 7 is the exception, sourced from the Solr
index instead.
_Avoid_: dictionary, Drupal taxonomy, glossary

**Term**:
One selectable option within a Domain, trimmed to `{ identifier, name }` (a Grouped domain's terms
also carry `children`). The Widget reads only those keys; everything else the API returns is dropped.
_Avoid_: option, tag, item, record, value

**Identifier** (key):
The stable string that names a Term and is what gets stored: a slug (`GBF-TARGET-03`,
`SUSTAINABLE-DEVELOPMENT-GOAL-14`) for most domains, and for National Targets 7 the Solr
`uniqueIdentifier_s` value (for example `ort-nt7-be-276962-2`), an opaque non-UUID string. The plural
"keys" in code means the Identifiers parsed out of a Saved value.
_Avoid_: id, code, GUID

**Display name**:
A Term's localized label, resolved `shortTitle` then `title` then `name`, each for the active locale
with an English fallback, and never a non-string. This is what the editor sees and searches; the
Identifier is never shown.
_Avoid_: title, label (label is the Domain label, not a Term's name)

**lString**:
A per-locale string map (`{ en: '...', fr: '...' }`) that thesaurus titles arrive as. Resolving an
lString to one locale (falling back to `en`) is how a Display name is produced.
_Avoid_: i18n object, translation map, localized string (name it lString once it is in scope)

**Domain label**:
The translated heading shown above a Domain's multiselect, loaded from the bundled locale files, not
from the Thesaurus. Distinct from a Display name, which labels a Term.
_Avoid_: domain name, UI label, caption

### Domain kinds

**Single-value domain**:
A Domain that holds exactly one Term or null and renders as a single-select. Membership is decided
solely by the shared `singleValueDomains` list.
_Avoid_: singleField, single field (the removed grouped-field path), single-select (the rendering, not the domain)

**Multi-value domain**:
A Domain that holds an array of Terms and renders as a multi-select with already-picked Terms hidden
from the list. Every Domain not in `singleValueDomains` is multi-value.
_Avoid_: multi-select (the rendering, not the domain), array domain

**Grouped domain**:
A Domain whose Terms nest under parent groups with selectable children (today only `bchSubjectGroups`).
Detected by the domain key containing "group"; built by resolving each parent's `narrowerTerms` into a
`children` array.
_Avoid_: nested domain, hierarchical domain, tree, parent domain

**Domain order**:
The ordered list of domain keys a site renders, set in the admin form (one key per line). Order is
load-bearing: it is the order the multiselects render.
_Avoid_: domain list, field order, layout

### The specific domains

**GBF Target**:
A Global Biodiversity Framework target, `GBF-TARGET-01` through `GBF-TARGET-23`, in the `gbfTargets`
Domain. The only Domain whose selection triggers Auto-link.
_Avoid_: Aichi target (a distinct, older framework that appears only inside the Relation table — it is **ignored**, never a selectable Linkable domain), biodiversity target, target (ambiguous with National Targets 7)

**National Targets 7**:
National biodiversity targets (`nationalTargets7`) sourced from the `api.cbd.int` Solr index rather
than a Thesaurus, scoped by the `countries` prop and identified by the Solr `uniqueIdentifier_s` value
(for example `ort-nt7-be-276962-2`), an opaque non-UUID string distinct from the slug keys the other
domains use. The "7" is the index schema name (`nationalTarget7`), not a count.
_Avoid_: national targets, NBT, GBF target, country targets

**SDG**:
A Sustainable Development Goal, `SUSTAINABLE-DEVELOPMENT-GOAL-01` through `-17`, in the `sdgs` Domain.
Older Saved values used `SDG-GOAL-*` keys (see Legacy SDG migration). One of the two Linkable domains.
_Avoid_: development goal, goal, SDG-GOAL (the legacy key form, not the current Identifier)

**CBD Subject**:
A thematic area from the `CBD-SUBJECTS` Thesaurus (`CBD-SUBJECT-*`), in the `subjects` Domain. The
other Linkable domain.
_Avoid_: subject area, topic, theme, category, tag

**BCH Subject**:
A Biosafety Clearing-House thematic area (`bchSubjects`), and as a Grouped domain `bchSubjectGroups`
(the BCH Subjects that have children). A biosafety-site concern, not a shipped default Domain.
_Avoid_: CBD Subject (a different Thesaurus), biosafety topic

**Organization type / Government type**:
Two Single-value domains (`orgTypes`, `govTypes`) split from the *same* API response: government
types are the few excluded Identifiers, organization types are the rest plus the synthetic "Other".
_Avoid_: org/gov (spell out), entity type

**"Other" organization type**:
A synthetic Term (`ORG-TYPE-OTHER`) appended to the `orgTypes` Domain because the Thesaurus has none;
its title is generated from the `other` key of each locale file.
_Avoid_: misc, unknown type, custom type

### Relations

**Auto-link**:
Adding a GBF Target's related SDGs and CBD Subjects into those Domains when the editor selects the
target. It fires only on select, and only into rendered Linkable domains that are configured
multi-select.
_Avoid_: sync, mirror, cascade, relate, link (bare)

**One-way / add-only**:
The two properties that define Auto-link's behavior. One-way: only a GBF Target selection fills
anything (picking an SDG or CBD Subject back-fills nothing). Add-only: existing picks are never
removed, and deselecting a GBF Target leaves its added Terms in place.
_Avoid_: two-way, bidirectional, reciprocal, transitive

**Linkable domain**:
A Domain that Auto-link is allowed to fill: exactly `sdgs` and `subjects`. A GBF Target's related list
may also carry Aichi ids and stray GUIDs, but those are ignored for free because they match no Term in
a Linkable domain.
_Avoid_: related domain, target domain, linked domain

**Relation table** (`GBF_SAMEAS`):
The static map from each GBF Target Identifier to its related Identifiers. It is the one and only
source of Auto-link relations; Terms are no longer decorated with a `sameAs` array.
_Avoid_: sameAs (the removed per-term decoration), relations map, lookup table

### Lifecycle and data

**Hydrate**:
Resolve the saved keys against the already-loaded Domain options into selected Term objects, then
write the normalized value back. In this project "hydrate" means this read-and-resolve step, not Vue's
SSR hydration.
_Avoid_: load, populate, initialize, rehydrate

**Legacy SDG migration**:
Reading a legacy `SDG-GOAL-NN` key as the current `SUSTAINABLE-DEVELOPMENT-GOAL-NN` Identifier so the
option still resolves, and rewriting it to the new key on the next save. Non-SDG keys pass through
untouched.
_Avoid_: SDG upgrade, key remap, conversion

### Site profiles

**BL2**:
The general biodiversity site profile (Belgium; locales en/fr/nl/de) the Widget serves from its
shipped default Domains. One of the two profiles the dev harness encodes.
_Avoid_: bioland, default site, main site

**BSL**:
The biosafety site profile (six UN languages; uses the Grouped `bchSubjectGroups` Domain and its own
Domain order). It differs from BL2 by configuration only; the same Bundle serves both.
_Avoid_: BCH (the Biosafety Clearing-House is the data source, BSL is the site profile), biosafety site
