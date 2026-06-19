# drupal-module-scbd-field-js

The browser front-end for the [SCBD Thesaurus Tags](https://github.com/scbd/drupal-module-scbd-thesaurus-tags) Drupal field. It is a Vue 3 app, bundled as a single IIFE script, that renders one or more multiselect dropdowns for the controlled vocabularies published by the Secretariat of the Convention on Biological Diversity (SCBD).

Each dropdown ("domain") is backed by a thesaurus on `api.cbd.int` — Global Biodiversity Framework targets, Sustainable Development Goals, national biodiversity targets, countries, CBD subjects, IUCN ecosystem types, and others. The app reads the field's saved value from a hidden Drupal text input, lets an editor pick terms, and writes the selected term keys back to that input as a comma-separated string on every change. Selecting a GBF target also auto-selects its related SDGs.

This repository builds and publishes the bundle. The Drupal module that defines the field type, widget, and admin settings lives in [drupal-module-scbd-thesaurus-tags](https://github.com/scbd/drupal-module-scbd-thesaurus-tags) and loads this bundle as a library.

## Architecture

```
Drupal node form
  └─ field_<name> (scbd_field_thesaurus field type)
       ├─ hidden <input> value   ← comma-separated term keys, persisted to DB
       ├─ hidden <input> value2  ← optional second value (isAdditionalField)
       └─ <div id="scbd-field-thesaurus-<name>">
              └─ Vue app (this bundle) reads the inputs, renders multiselects,
                 fetches terms from api.cbd.int, writes keys back to the inputs
```

## Installation

The bundle is consumed by Drupal, not added to a page by hand. Install the [SCBD Thesaurus Tags](https://github.com/scbd/drupal-module-scbd-thesaurus-tags) module and enable it:

```bash
composer require scbd/drupal-module-scbd-thesaurus-tags
drush en scbd_field
```

That module's `scbd_field.libraries.yml` pulls this bundle from the GitHub release matching its version (see [Drupal library wiring](#drupal-library-wiring)). Once enabled, add a field of type **SCBD Thesaurus** to any content type — the widget renders automatically.

For local development of the bundle itself, see [Development](#development).

## Component props

The bundle exposes one global, `ScbdDrupalScbdFieldJs.default`, which is the Vue component. Mount it with `Vue.createApp(...)`. All props are passed by the Drupal behavior from `drupalSettings`; only `name` is required.

**The widget does not take initial values as a prop.** It reads the saved selection directly from the hidden Drupal `<input>` (located by `name`) at mount and writes the selection back to that same input on every change. Preloading and the new-entity "auto-add" defaults are therefore the host page's job: Drupal renders the input with the saved value as its `#default_value`, and the behavior seeds any auto-add keys into the input *before* mount (see [Drupal integration](#drupal-integration)).

| Prop                 | Type    | Default       | Description |
| -------------------- | ------- | ------------- | ----------- |
| `name`               | String  | **required**  | Field machine name **without** the `field_` prefix. Used to locate the mount `<div>` (`#scbd-field-thesaurus-<name>`) and the hidden input (`field_<name>[0][value]` / `#edit-field-<name>-0-value`). |
| `description`        | String  | `' '`         | Help text rendered above the widget. |
| `locale`             | String  | `'en'`        | Current interface language (ISO 639-1). |
| `locales`            | Array   | `['en']`      | All enabled languages, used for term-name fallback resolution. |
| `countries`          | Array   | `['be']`      | ISO 3166-1 alpha-2 codes. Scopes the `nationalTargets7` lookup. |
| `domains`            | Array   | see below     | Ordered domain keys to render. Each becomes a separate labeled multiselect. |
| `singleValueDomains` | Array   | see below     | Domains rendered as single-select instead of multi-select (when present in `domains`). |
| `isAdditionalField`  | Boolean | `false`       | Read/write the hidden input's `value2` column (`field_<name>[0][value2]`) instead of `value`. |
| `debug`              | Boolean | `false`       | Render the input id beside each multiselect (the harness also shows the raw saved value). |

Default `domains`: `gbfTargets`, `nationalTargets7`, `countries`, `subjects`, `sdgs`.

Default `singleValueDomains`: `orgTypes`, `govTypes`, `projectStatuses`, `geoScopes`, `documentTypes`, `ecosystemTypes`, `jurisdictions`, `eventStatuses`.

> Both default lists are defined once in [src/utils/constants.js](src/utils/constants.js) (`DEFAULT_DOMAINS` / `DEFAULT_SINGLE_VALUE_DOMAINS`) and shared by the wrapper and inner component, so this table and the code cannot drift.

## Domains

A domain is one controlled vocabulary fetched from `api.cbd.int`. Multi-select domains allow many terms; single-select domains allow one.

### Multi-select

| Key                | Vocabulary |
| ------------------ | ---------- |
| `gbfTargets`       | Global Biodiversity Framework targets (`GBF-TARGET-01` … `GBF-TARGET-23`) |
| `nationalTargets7` | National biodiversity targets, filtered by the `countries` prop |
| `sdgs`             | Sustainable Development Goals 1–17 (`SUSTAINABLE-DEVELOPMENT-GOALS` thesaurus) |
| `countries`        | Countries |
| `subjects`         | Thematic areas / subjects (`CBD-SUBJECTS` thesaurus) |
| `bchSubjects`      | Biosafety Clearing-House thematic areas |
| `bchSubjectGroups` | Biosafety Clearing-House thematic-area groups |
| `regions`          | Geographic regions |

### Single-select

| Key               | Vocabulary |
| ----------------- | ---------- |
| `orgTypes`        | Organization type |
| `govTypes`        | Government type |
| `projectStatuses` | Project status |
| `geoScopes`       | Geographic scope |
| `documentTypes`   | Document types |
| `ecosystemTypes`  | IUCN ecosystem types (`ECOSYSTEM-TYPES-IUCN` thesaurus) |
| `jurisdictions`   | Jurisdictions |
| `eventStatuses`   | Event status |

## Value format

The hidden input stores a comma-separated string of term keys:

```
GBF-TARGET-03,SUSTAINABLE-DEVELOPMENT-GOAL-06,SUSTAINABLE-DEVELOPMENT-GOAL-14
```

National targets are identified by UUID rather than a slug:

```
E6640AB5-975D-479F-92C0-FC6E3AC0ADFF,CCA4B662-8EF4-418D-B327-0D6F418AA703
```

**SDG key migration.** Older data saved SDGs as `SDG-GOAL-01` … `SDG-GOAL-17`. These are read transparently and rewritten to `SUSTAINABLE-DEVELOPMENT-GOAL-01` … `-17` on the next save.

## GBF → SDG / Subject auto-linking

Selecting a GBF target adds its related SDGs **and** CBD subjects, resolved from the local `GBF_SAMEAS` table in [src/utils/constants.js](src/utils/constants.js) (the linkable domains are `sdgs` and `subjects`). For example, picking `GBF-TARGET-03` also adds `SUSTAINABLE-DEVELOPMENT-GOAL-06`, `-11`, `-14`, `-15` and the `CBD-SUBJECT-*` subjects in its row — but only for whichever of those domains is actually rendered. The mapping is one-way and add-only: selecting an SDG or subject never adds a GBF target, and deselecting a GBF target never strips previously linked terms.

## Drupal integration

The companion module wires everything together. The relevant pieces, drawn from that module:

### Field type and widget

A custom field type `scbd_field_thesaurus` stores two `text/big` columns, `value` and `value2`. Its default widget `scbd_thesaurus_widget` renders the hidden inputs, the mount `<div>`, and attaches the library plus `drupalSettings`:

```php
$element['value'] = [
  '#type' => 'textfield',
  '#default_value' => $value,   // the widget reads this hidden input directly — no value is passed as a prop
  '#suffix' => '<div id="scbd-field-thesaurus-' . $field_name . '"></div>',
  '#attributes' => ['class' => ['edit-scbd_field-thesaurus']],
  '#attached' => [
    'library' => ['scbd_field/thesaurus'],
    'drupalSettings' => [
      'scbd_field' => [
        'element_title'       => $field_name,        // 'tags' (no field_ prefix) — locates the input + mount div
        'element_description' => $element['#description'] ?? '',
        'countries'           => $countries,         // from bioland.settings
        'locales'             => $locales,           // all enabled language codes
        'locale'              => $current_locale,
        'domains'             => $domain_order,       // from scbd_field.settings
        'debug'               => $debug,
        'auto_add_values'     => $auto_add_values,    // new-entity seed only, e.g. ['GBF-TARGET-17', 'be']
      ],
    ],
  ],
];
// The `value2` column (read when the widget is mounted with `isAdditionalField: true`) is rendered
// as a second textfield the same way, with its own `#default_value`.
```

### Drupal behavior

`scbd_field-2-0-9.js` reads `drupalSettings.scbd_field`, finds `#scbd-field-thesaurus-<name>`, and mounts the Vue app once (guarded by `__vue_app__`). Because the widget reads the saved selection straight from the hidden input, the behavior's only data job is to **seed that input before mount** — and Drupal already populates it with the persisted value via `#default_value`, so the behavior only has to merge the configured `auto_add_values` into an *empty* (new-entity) input. It passes no initial-value or auto-add props, because the component has none:

```js
Drupal.behaviors.scbd_thesaurus_widget = {
  attach(context, settings) {
    const s = settings?.scbd_field ?? window.drupalSettings?.scbd_field;
    if (!s) return;

    const mountEl = document.querySelector(`#scbd-field-thesaurus-${s.element_title}`);
    if (!mountEl || mountEl.__vue_app__) return;

    // Seed the hidden input BEFORE mount — the widget reads its value directly. Drupal already set
    // the saved value via #default_value; for a new (empty) entity, merge the auto-add defaults in.
    const input = document.querySelector(`#edit-field-${s.element_title}-0-value`);
    if (input && !input.value && Array.isArray(s.auto_add_values) && s.auto_add_values.length) {
      input.value = s.auto_add_values.join(',');
    }

    const { createApp } = Vue;
    const App = ScbdDrupalScbdFieldJs.default;

    createApp(App, {
      name:        s.element_title,
      description: s.element_description,
      countries:   s.countries ?? ['be'],
      locale:      s.locale    ?? 'en',
      locales:     s.locales   ?? ['en'],
      domains:     s.domains   ?? ['gbfTargets', 'nationalTargets7', 'countries', 'subjects', 'sdgs'],
      debug:       s.debug     ?? false,
    }).mount(`#scbd-field-thesaurus-${s.element_title}`);

    mountEl.__vue_app__ = true;
  }
};
```

> A second widget for the `value2` column is mounted the same way with `isAdditionalField: true` (and seeds `#edit-field-<name>-0-value2`). `singleValueDomains` can also be passed here if a site needs to override which domains render single-select.

### Hidden input selector convention

The widget locates the hidden inputs by `name` (`field_<name>[0][value]`), falling back to the Drupal auto-id (`data-drupal-selector` form, underscores replaced with hyphens):

```
edit-field-<name>-0-value
edit-field-<name>-0-value2
```

For `field_tags` these are `edit-field-tags-0-value` and `edit-field-tags-0-value2`.

### Drupal library wiring

`scbd_field.libraries.yml` loads Vue from a CDN and this bundle from its GitHub release. The CI in this repo publishes `index.min.js`, `style.css`, and `index.min.js.map` to a release tagged `v<version>`, so the library references those release URLs:

```yaml
vue:
  remote: https://github.com/vuejs/core
  version: "3.5.24"
  js:
    https://unpkg.com/vue@^3.5.24/dist/vue.global.prod.js: { type: external, minified: true }
  css:
    component:
      https://unpkg.com/vue-multiselect@3.2.0/dist/vue-multiselect.css: { type: external, minified: true }
      https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css: { type: external, minified: true }

thesaurus:
  version: 2.0.9
  css:
    theme:
      https://github.com/scbd/drupal-module-scbd-field-js/releases/download/v2.0.9/style.css: { type: external, minified: true }
  js:
    https://github.com/scbd/drupal-module-scbd-field-js/releases/download/v2.0.9/index.min.js: { type: external, minified: true }
    scbd_field-2-0-9.js: {}
  dependencies:
    - scbd_field/vue
    - core/jquery
    - core/drupalSettings
```

### Admin settings

The module exposes a config form at `/admin/config/scbd-field`:

- **Domain order** — one domain key per line; defines which domains render and in what order. Defaults to `gbfTargets`, `nationalTargets7`, `countries`, `subjects`, `sdgs`.
- **Debug mode** — show the hidden input beside the widget.
- **Disable auto-add GBF Target 17** — on biosafety sites, `GBF-TARGET-17` is preselected on new entities unless disabled.
- **Disable auto-add countries** — on biosafety sites, the site country is preselected on new entities unless disabled.

On biosafety sites with no saved order, the form offers the biosafety defaults: `bchSubjectGroups`, `gbfTargets`, `nationalTargets7`, `countries`.

## Standalone usage

Useful for testing the component outside Drupal. Vue must load before the bundle.

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/vue@3.5.25/dist/vue.global.prod.js"></script>
  <script src="dist/index.min.js"></script>
  <link rel="stylesheet" href="dist/style.css">
</head>
<body>
  <input type="hidden" name="field_tags[0][value]" value="">
  <div id="scbd-field-thesaurus-tags"></div>

  <script>
    Vue.createApp(ScbdDrupalScbdFieldJs.default, {
      name:      'tags',
      locale:    'en',
      locales:   ['en', 'fr', 'es'],
      countries: ['ca'],
      domains:   ['gbfTargets', 'nationalTargets7', 'countries', 'subjects', 'sdgs'],
    }).mount('#scbd-field-thesaurus-tags');
  </script>
</body>
</html>
```

## Development

```bash
yarn install
yarn dev          # dev server at http://localhost:5173
yarn build        # writes dist/index.min.js, dist/style.css, dist/index.min.js.map
yarn test:smoke
```

`index.html` is a dev harness that simulates the Drupal hidden inputs. Edit it to exercise different domains and initial values.

### Build output

| File                    | Purpose |
| ----------------------- | ------- |
| `dist/index.min.js`     | IIFE bundle; registers the `ScbdDrupalScbdFieldJs` global |
| `dist/style.css`        | PurgeCSS-minified stylesheet |
| `dist/index.min.js.map` | Source map |

Vue is marked external and is **not** bundled — the host page (or Drupal `vue` library) must provide it.

### Release

The CI workflow ([.github/workflows/ci.yml](.github/workflows/ci.yml)) builds on every push and, on a published GitHub release, uploads the three `dist/` artifacts plus a `SHA256SUMS` checksum file to the release tag. The Drupal `libraries.yml` then references those release URLs. The release tag must be `v<version>` and match `package.json`.

## Internationalization

Domain labels ship for 60+ languages. Resolution order: requested `locale` → `en` → the raw domain key. Add or override labels in `src/i18n/`.

## License

MIT
