<template>
  <section>
    <div v-if="description" class="help-text">{{ description }}</div>

    <div class="multi-field-container">
      <div v-for="domain in domains" :key="domain">
        <div v-if="optionsList[domain]?.length" class="multi-field-child">
          <label :for="`${name}-${domain}`" class="control-label" :class="{ 'fw-bold': isAdditionalField }">{{ t(domain) }}</label>

          <multiselect
            :id="`${name}-${domain}`"
            v-model="inputValue[domain]"
            :class="['chm-multiselect', { 'has-grouped-options': domainFlags[domain].grouped }]"
            track-by="identifier"
            label="name"
            :options="optionsList[domain]"
            :multiple="domainFlags[domain].multiple"
            :taggable="true"
            :group-select="domainFlags[domain].grouped"
            :group-values="domainFlags[domain].grouped ? 'children' : null"
            :group-label="domainFlags[domain].grouped ? 'name' : null"
            :searchable="true"
            :hide-selected="domainFlags[domain].multiple"
            :placeholder="''"
            @select="handleSelect"
            @remove="handleChange"
            @close="handleChange"
          />
          <div v-if="debug" class="debug-ids">input id: <code>{{ `${name}-${domain}` }}</code></div>
          <br>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import Multiselect from 'vue-multiselect';
import { useTaxonomies } from '@/composables/use-taxonomies';
import { getNationalTargets7 } from '@/utils/national-targets.js';
import { relatedKeys, LINKABLE_DOMAINS } from '@/utils/relations.js';
import { useTranslations } from '@/composables/use-translations';

const props = defineProps({
  name              : { type: String,  required: true },
  description       : { type: String,  default: ' ' },
  countries         : { type: Array,   default: () => ['be'] },
  locale            : { type: String,  default: 'en' },
  locales           : { type: Array,   default: () => ['en'] },
  domains           : { type: Array,   default: () => ['nationalTargets7', 'gbfTargets', 'countries', 'subjects', 'sdgs', 'bchSubjectGroups'] },
  singleValueDomains: { type: Array,   default: () => ['orgTypes', 'govTypes', 'projectStatuses', 'geoScopes', 'documentTypes', 'ecosystemTypes', 'jurisdictions', 'eventStatuses'] },
  isAdditionalField : { type: Boolean, default: false },
  debug             : { type: Boolean, default: false },
});

// Locale-bound taxonomy access (in-module replacement for @scbd/cached-apis); reused by lookups below.
const { getData, lookUp } = useTaxonomies(props.locale, props.locales);

// UI-label translations (domain names, group labels) for the active locale, with English fallback.
// `t(domain)` defaults to props.locale because it leads the list passed to useTranslations. Only
// the requested locales are loaded (lazily); `messages` is reactive so template labels re-localize
// when they arrive.
const { t } = useTranslations([props.locale, ...props.locales]);

// Drupal field machine-names are [a-z0-9_]; validate once so a malformed prop can't break or
// steer the querySelector built in findHiddenInput (S2). Invalid → findHiddenInput returns null.
const NAME_RE = /^[a-z0-9_]+$/;
const fieldName = props.name.toLowerCase();
const isValidFieldName = NAME_RE.test(fieldName);
if (!isValidFieldName) console.error(`scbd-field: invalid field name (expected [a-z0-9_]+): ${props.name}`);

const isGroupedDomain = (domain) => domain.toLowerCase().includes('group');
const isMultiple = (domain) => !props.singleValueDomains.includes(domain);

// Precompute the per-domain `grouped`/`multiple` flags once instead of recomputing them on every
// render (isGroupedDomain alone is read 4x per option in the template). Keyed by domain name (R4).
const domainFlags = computed(() =>
  Object.fromEntries(props.domains.map((d) => [d, { grouped: isGroupedDomain(d), multiple: isMultiple(d) }])),
);

// Available options per domain, and the current selection (single-value domains hold one object or null).
const optionsList = ref(Object.fromEntries(props.domains.map((d) => [d, []])));
const inputValue  = ref(Object.fromEntries(props.domains.map((d) => [d, isMultiple(d) ? [] : null])));

// The hidden Drupal input this widget reads/writes — resolved once at mount (it never moves), so
// loadInitialValues and handleChange reuse it instead of re-running querySelector each time (R3).
const hiddenInput = ref(null);

// Load options before hydrating: loadInitialValues resolves saved children from optionsList
// (bchSubjectGroups, nationalTargets7), so it must run after the fetch completes (C1).
onMounted(async () => {
  hiddenInput.value = findHiddenInput();
  await loadOptions();
  await loadInitialValues();
});

/** Populate optionsList for every configured domain (national targets come from the Solr index). */
async function loadOptions() {
  await Promise.all(props.domains.map(async (domain) => {
    optionsList.value[domain] = domain === 'nationalTargets7'
      ? await getNationalTargets7({ countries: props.countries, rows: 300, locale: props.locale, locales: props.locales })
      : await getData(domain);
  }));
}

/** Hydrate the selection from the comma-separated keys saved in the hidden Drupal input. */
async function loadInitialValues() {
  const keys = hiddenInput.value?.value?.split(',').filter(Boolean) ?? [];
  if (!keys.length) return;

  await Promise.all(props.domains.map(async (domain) => {
    inputValue.value[domain] = await resolveSavedValue(domain, keys);
  }));

  handleChange();
}

/** Resolve one domain's saved keys to the full term object(s) it should display. */
async function resolveSavedValue(domain, keys) {
  if (domain === 'nationalTargets7') {
    // Options are already loaded (onMounted awaits loadOptions first), so reuse them — no refetch (C5).
    return (optionsList.value.nationalTargets7 || []).filter(({ identifier }) => keys.includes(identifier));
  }
  if (domain === 'bchSubjectGroups') {
    const matched = await lookUp('bchSubjects', keys, false);
    const ids = new Set((matched || []).map(({ identifier }) => identifier));
    return (optionsList.value.bchSubjectGroups || []).flatMap((g) => g.children || []).filter((c) => ids.has(c.identifier));
  }
  const single = props.singleValueDomains.includes(domain);
  return (await lookUp(domain, keys, single)) || (single ? null : []);
}

/** Locate the hidden Drupal input this widget reads/writes (main or "additional" value). */
function findHiddenInput() {
  if (!isValidFieldName) return null; // refuse to build a selector from an unvalidated name (S2)
  const key = props.isAdditionalField ? 'value2' : 'value';
  return document.querySelector(`input[name='field_${fieldName}[0][${key}]']`)
    || document.querySelector(`#edit-field-${fieldName}-0-${key}`); // Drupal auto-id needs the leading # (C2)
}

/** Every selected identifier across all domains, de-duplicated. */
function getAllKeys() {
  const keys = props.domains.flatMap((domain) => {
    const value = inputValue.value[domain];
    if (Array.isArray(value)) return value.map(({ identifier }) => identifier);
    return value && props.singleValueDomains.includes(domain) ? [value.identifier] : [];
  });
  return [...new Set(keys.filter(Boolean))];
}

/** On selecting a GBF Target, auto-fill its related SDGs + Subjects, then persist. */
function handleSelect(option) {
  autoLinkRelated(option);
  handleChange();
}

/**
 * One-way auto-link: when a GBF Target is selected, add its related SDG/Subject options into those
 * domains. Only GBF Target picks resolve to relations (relatedKeys returns [] for SDGs/Subjects, so
 * there is no inverse). Add-only: existing picks stay, and deselecting never strips linked terms.
 */
function autoLinkRelated(option) {
  const related = new Set(relatedKeys(option?.identifier));
  if (!related.size) return;

  for (const domain of props.domains) {
    // Array guard covers both options and the current selection: a linkable domain configured as a
    // single-value domain holds one object (not an array), so skip it — array auto-linking is
    // meaningless there and current.map() would throw (CR-6).
    if (!LINKABLE_DOMAINS.includes(domain) || !Array.isArray(optionsList.value[domain]) || !Array.isArray(inputValue.value[domain])) continue;

    const current = inputValue.value[domain];
    const have = new Set(current.map(({ identifier }) => identifier));
    const additions = optionsList.value[domain].filter(({ identifier }) => related.has(identifier) && !have.has(identifier));
    if (additions.length) inputValue.value[domain] = [...current, ...additions];
  }
}

/** Write the current selection back to the hidden Drupal input. */
function handleChange() {
  if (!hiddenInput.value) {
    // Wired to @select/@remove/@close; degrade instead of throwing on every interaction (C4).
    const key = props.isAdditionalField ? 'value2' : 'value';
    console.error(`scbd-field: hidden input not found for field_${fieldName}[0][${key}]`);
    return;
  }
  hiddenInput.value.value = getAllKeys().join();
}
</script>


<style scoped>
.multiselect{
    padding-top: .25em;
    width: 100%;
}

.debug-ids {
    margin-top: 0.25rem;
    color: #6c757d;
    font-family: monospace;
    font-size: 11px;
    word-break: break-all;
}

.help-text {
    margin-top: calc(6rem / 16);
    margin-bottom: calc(6rem / 16);
    color: var(--input-fg-color--description);
    font-size: var(--font-size-xs);
    line-height: calc(17rem / 16);
}

.multi-field-container {
    display: block;
}
.multi-field-child {
    display: block;
    margin: 0 0 1rem 0;
    width: 100%;
}

</style>
<style>
.hide{display:none!important}
</style>
