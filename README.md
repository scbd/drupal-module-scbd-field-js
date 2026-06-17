# Drupal SCBD Field JS

A Vue 3 multiselect component library for biodiversity and sustainability taxonomy fields, designed for seamless integration with Drupal forms. The component provides an intuitive interface for selecting GBF targets, SDGs, national targets, countries, and other SCBD thesaurus terms.

## Features

- 🌍 **Multi-domain Support**: GBF Targets, SDGs, National Targets, Countries, Subjects, and more
- 🔗 **Smart Linking**: Auto-links related SDG goals when selecting GBF targets
- 🌐 **Internationalization**: Supports 60+ languages with automatic fallback
- 📦 **IIFE Bundle**: Browser-ready bundle with all dependencies except Vue
- 🎨 **Flexible Modes**: Single-field grouped or multi-field separated layouts
- 🔌 **Drupal Integration**: Reads/writes directly to Drupal hidden form inputs

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Basic Example](#basic-example)
  - [Configuration Options](#configuration-options)
  - [Available Domains](#available-domains)
- [Drupal Integration](#drupal-integration)
- [Development](#development)
- [API Reference](#api-reference)
- [License](#license)

## Installation

### For Browser Use (IIFE)

**Include Vue 3** (required external dependency):

```html
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
```

**Include the component bundle**:

```html
<script src="https://cdn.cbd.int/drupal-module-scbd-field-js@1.0.1/dist/index.min.js"></script>
<link rel="stylesheet" href="https://cdn.cbd.int/drupal-module-scbd-field-js@1.0.1/dist/style.css">
```

### For Development

```bash
# Clone the repository
git clone https://github.com/scbd/drupal-module-scbd-field-js.git
cd drupal-module-scbd-field-js

# Install dependencies
yarn install

# Run development server
yarn dev

# Build for production
yarn build
```

## Quick Start

### Minimal Example

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script src="dist/index.min.js"></script>
  <link rel="stylesheet" href="dist/style.css">
</head>
<body>
  <div id="app"></div>
  
  <!-- Hidden Drupal form input -->
  <input type="hidden" name="field_tags[0][value]" value="">
  
  <script>
    const { createApp } = Vue;
    const { default: ScbdFieldComponent } = ScbdDrupalScbdFieldJs;
    
    createApp(ScbdFieldComponent, {
      name: 'tags',
      locale: 'en',
      domains: ['gbfTargets', 'sdgs', 'countries']
    }).mount('#app');
  </script>
</body>
</html>
```

## Usage

### Basic Example

```javascript
const { createApp } = Vue;
const { default: ScbdFieldComponent } = ScbdDrupalScbdFieldJs;

createApp(ScbdFieldComponent, {
  name: 'my_field',
  description: 'Select relevant tags',
  locale: 'en',
  locales: ['en', 'fr', 'es'],
  countries: ['us', 'gb'],
  domains: ['gbfTargets', 'nationalTargets7', 'sdgs', 'subjects', 'countries']
}).mount('#app');
```

### Configuration Options

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | String | **Yes** | - | Field name (matches Drupal field machine name) |
| `description` | String | No | `' '` | Help text displayed above the field |
| `locale` | String | No | `'en'` | Current interface language (ISO 639-1 code) |
| `locales` | Array | No | `['en']` | Available fallback locales for term names |
| `countries` | Array | No | `['be']` | Country codes for filtering national targets |
| `domains` | Array | No | `['nationalTargets7', 'gbfTargets', 'countries', 'subjects', 'sdgs', 'bchSubjects']` | Taxonomy domains to display |
| `singleValueDomains` | Array | No | `['orgTypes', 'govTypes', 'projectStatuses', 'geoScopes', 'documentTypes', 'jurisdictions', 'eventStatuses']` | Domains that allow only single selection instead of multi-select |
| `singleField` | Boolean | No | `false` | If true, groups all domains in one multiselect instead of separate fields |
| `isAdditionalField` | Boolean | No | `false` | If true, reads/writes to `value2` instead of `value` |
| `debug` | Boolean | No | `false` | If true, displays current selected values in a debug panel |

### Available Domains

#### Multi-select Domains (default)

- `gbfTargets` - Global Biodiversity Framework Targets
- `nationalTargets7` - National Biodiversity Targets (filtered by country)
- `sdgs` - Sustainable Development Goals
- `countries` - Countries
- `subjects` - Thematic Areas/Subjects
- `bchSubjects` - Biosafety Thematic Areas
- `bchSubjectGroups` - Biosafety Thematic Areas
- `regions` - Geographic Regions
- `ecosystemTypes` - Ecosystem Types

#### Single-select Domains

- `orgTypes` - Organization Type
- `govTypes` - Government Type
- `projectStatuses` - Project Status
- `geoScopes` - Geographic Scope
- `documentTypes` - Document Types
- `jurisdictions` - Jurisdictions
- `eventStatuses` - Event Status

### Display Modes

#### Multi-field Layout (default)

Each domain appears as a separate labeled field:

```javascript
createApp(ScbdFieldComponent, {
  name: 'tags',
  domains: ['gbfTargets', 'sdgs', 'countries']
  // Each domain will be a separate dropdown
}).mount('#app');
```

#### Single-field Layout

All options grouped in one multiselect:

```javascript
createApp(ScbdFieldComponent, {
  name: 'tags',
  singleField: true  // Groups all domains together
}).mount('#app');
```

## Drupal Integration

### How It Works

The component integrates with Drupal by reading from and writing to hidden form inputs. The expected input name pattern is:

```text
field_[FIELD_NAME][0][value]
```

For additional fields:

```text
field_[FIELD_NAME][0][value2]
```

### Setup in Drupal

**Step 1: Create a hidden text field** in your Drupal form:

```html
<input 
  type="hidden" 
  name="field_tags[0][value]" 
  value="" 
  class="edit-scbd_field-thesaurus">
```

**Step 2: Add the Vue app container**:

```html
<div id="scbd-field-tags"></div>
```

**Step 3: Initialize the component**:

```javascript
const { createApp } = Vue;
const { default: ScbdFieldComponent } = ScbdDrupalScbdFieldJs;

createApp(ScbdFieldComponent, {
  name: 'tags',  // Must match the field name (without 'field_' prefix)
  locale: drupalSettings.locale || 'en',
  domains: ['gbfTargets', 'sdgs', 'subjects']
}).mount('#scbd-field-tags');
```

### Value Format

Values are stored as comma-separated identifier keys:

```text
GBF-TARGET-03,GBF-TARGET-05,SDG-GOAL-06,SDG-GOAL-11,SDG-GOAL-12
```

For country-specific identifiers (like national targets), UUIDs are used:

```text
E6640AB5-975D-479F-92C0-FC6E3AC0ADFF,CCA4B662-8EF4-418D-B327-0D6F418AA703
```

### Smart GBF-SDG Linking

When a user selects a GBF target that has related SDG goals, the component automatically:

1. Extracts related SDG identifiers from the `sameAs` property
2. Adds those SDG goals to the selection
3. Updates the hidden input field

This feature only works with the `gbfTargets` domain.

## Development

### Project Structure

```
drupal-module-scbd-field-js/
├── src/
│   ├── index.js              # Entry point
│   ├── index.vue             # Wrapper component
│   ├── main.js               # Dev server entry
│   ├── style.scss            # Styles
│   ├── components/
│   │   └── index.vue         # Main multiselect component
│   └── i18n/
│       ├── data.json         # Translation data (60+ languages)
│       └── index.js          # i18n helper
├── dist/                     # Built files (IIFE bundle)
├── index.html                # Development test page
├── vite.config.js            # Build configuration
└── package.json
```

### Build Commands

```bash
# Development server with hot reload
yarn dev

# Build production bundle
yarn build

# Preview production build
yarn preview

# Publish to npm
yarn release

# Clean reinstall dependencies
yarn clean-reinstall
```

### Build Configuration

The build creates an IIFE bundle with:

- **Entry**: `src/index.js`
- **Output**: `dist/index.min.js`
- **External**: Vue (must be loaded separately)
- **Global name**: `ScbdDrupalScbdFieldJs`
- **CSS**: Purged and minified in `dist/style.css`

### Testing Locally

The included `index.html` simulates Drupal form inputs for testing:

```bash
yarn dev
```

Then visit `http://localhost:5173` and modify the hidden input values to test different scenarios.

## API Reference

### Component Props

```javascript
{
  // Required
  name: String,              // Drupal field machine name
  
  // Optional
  description: String,       // Help text
  locale: String,            // Current language (e.g., 'en', 'fr')
  locales: Array,            // Available languages for fallback
  countries: Array,          // ISO country codes for filtering
  domains: Array,            // Taxonomy domains to include
  isAdditionalField: Boolean // Use value2 instead of value
}
```

### Methods

The component exposes these internal methods (advanced use only):

- `loadInitialValues(locale)` - Loads values from hidden input
- `handleChange()` - Updates hidden input when selection changes
- `getAllKeys()` - Returns array of all selected identifier keys
- `t(domain)` - Translates domain name to current locale

### Data Sources

The component fetches data from:

- **SCBD Cached APIs**: Most domains (`@scbd/cached-apis`)
- **CBD API**: National targets via Solr queries (`https://api.cbd.int/api/v2013/index/select`)

## Internationalization

### Supported Languages

The component includes translations for 60+ languages including:

- Arabic (ar), Chinese (zh-hans), English (en), French (fr), Russian (ru), Spanish (es)
- And many more...

### Language Fallback

1. Requested locale (e.g., `fr`)
2. English (`en`)
3. Raw domain key (e.g., `gbfTargets`)

### Adding Custom Translations

Edit `src/i18n/data.json`:

```json
{
  "de": {
    "gbfTargets": "GBF-Ziele",
    "sdgs": "SDGs",
    "countries": "Länder"
  }
}
```

## Browser Support

- Modern browsers with ES6+ support
- Vue 3 compatible browsers
- IE 11 not supported

## Dependencies

### Runtime

- **Vue 3**: Required external dependency (must be loaded separately)
- **@scbd/cached-apis**: SCBD data fetching library
- **vue-multiselect**: Multiselect component
- **ofetch**: HTTP client
- **change-case**: String utilities

### Development

- **Vite**: Build tool
- **@vitejs/plugin-vue**: Vue 3 Vite plugin
- **rollup-plugin-terser**: Code minification
- **PostCSS + PurgeCSS**: CSS optimization

## Troubleshooting

### Component doesn't load

- Ensure Vue 3 is loaded **before** the component script
- Check browser console for errors
- Verify the global `Vue` object exists

### Values not saving

- Verify hidden input name matches pattern: `field_[name][0][value]`
- Check `name` prop matches field name (without `field_` prefix)
- Use browser DevTools to inspect input value changes

### National targets not showing

- Ensure `countries` prop includes relevant country codes
- Check `nationalTargets7` is in `domains` array
- Verify API access to `https://api.cbd.int`

### Translation issues

- Confirm `locale` prop uses valid ISO 639-1 codes
- Check `src/i18n/data.json` for available locales
- Falls back to English if locale not found

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions welcome! Please follow these guidelines:

1. Maintain Vue 3 Options API (not Composition API)
2. Pin dependencies without `^` or `~` in package.json
3. Define functions outside component object
4. Update i18n files for new domains
5. Test with actual Drupal form structure

## Support

For issues, questions, or contributions:

- **GitHub**: <https://github.com/scbd/drupal-module-scbd-field-js>
- **Issues**: <https://github.com/scbd/drupal-module-scbd-field-js/issues>

---

Built with ❤️ for the biodiversity community
