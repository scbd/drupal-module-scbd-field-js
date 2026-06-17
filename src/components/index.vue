<template>
  <section>
    <div v-if="description" class="help-text">{{ description }}</div>

    <div v-if="debug" class="debug-info">
      <strong>Debug - Current Values:</strong> {{ getAllKeys().join(', ') }}
    </div>

    <div v-if="!singleField" class="multi-field-container">
      <div v-for="domain in domains" :key="domain">
        <div v-if="optionsList[domain]?.length" class="multi-field-child">
          <label :for="`${name}-${domain}`" class="control-label" :class="{ 'fw-bold': isAdditionalField }">{{ t(domain) }}</label>

          <multiselect
            :id="`${name}-${domain}`"
            v-model="inputValue[domain]"
            :class="['chm-multiselect', { 'has-grouped-options': isGroupedDomain(domain) }]"
            track-by="identifier"
            label="name"
            :options="optionsList[domain]"
            :multiple="isMultiple(domain)"
            :taggable="true"
            :group-select="isGroupedDomain(domain)"
            :group-values="isGroupedDomain(domain) ? 'children' : null"
            :group-label="isGroupedDomain(domain) ? 'name' : null"
            :searchable="true"
            :hide-selected="isMultiple(domain)"
            :placeholder="''"
            @select="handleSelect"
            @remove="handleChange"
            @close="handleChange"
          />
          <br>
        </div>
      </div>
    </div>

    <multiselect v-if="singleField"
      :id="name"
      v-model="inputValue"
      :class="['chm-multiselect', 'has-grouped-options']"
      track-by="identifier"
      label="name"
      :options="optionsList"
      :multiple="true"
      :taggable="true"
      :group-select="false"
      group-values="terms"
      group-label="domain"
      :placeholder="description"
      :searchable="true"
      :hide-selected="true"
      @remove="handleChange"
      @close="handleChange"
    />
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Multiselect from 'vue-multiselect';
import { useTaxonomies } from '../composables/use-taxonomies';
import { getNationalTargets7 } from '../utils/national-targets.js';
import { relatedKeys, LINKABLE_DOMAINS } from '../utils/relations.js';
import { useTranslations } from '../composables/use-translations';

const props = defineProps({
  name              : { type: String,  required: true },
  description       : { type: String,  default: ' ' },
  countries         : { type: Array,   default: () => ['be'] },
  locale            : { type: String,  default: 'en' },
  locales           : { type: Array,   default: () => ['en'] },
  domains           : { type: Array,   default: () => ['nationalTargets7', 'gbfTargets', 'countries', 'subjects', 'sdgs', 'bchSubjectGroups'] },
  singleValueDomains: { type: Array,   default: () => ['orgTypes', 'govTypes', 'projectStatuses', 'geoScopes', 'documentTypes', 'jurisdictions', 'eventStatuses'] },
  singleField       : { type: Boolean, default: false },
  isAdditionalField : { type: Boolean, default: false },
  debug             : { type: Boolean, default: false },
});

// Locale-bound taxonomy access (in-module replacement for @scbd/cached-apis); reused by lookups below.
const { getData, lookUp } = useTaxonomies(props.locale, props.locales);

// UI-label translations (domain names, group labels) for the active locale, with English fallback.
// `t(domain)` defaults to props.locale because it leads the list passed to useTranslations.
const { t } = useTranslations([props.locale, ...props.locales]);

const isGroupedDomain = (domain) => domain.toLowerCase().includes('group');
const isMultiple = (domain) => !props.singleValueDomains.includes(domain);

// Available options per domain, and the current selection (single-value domains hold one object or null).
const optionsList = ref(props.singleField ? [] : Object.fromEntries(props.domains.map((d) => [d, []])));
const inputValue  = ref(props.singleField ? [] : Object.fromEntries(props.domains.map((d) => [d, isMultiple(d) ? [] : null])));

if (props.singleField) loadOptionsSingle();
else loadOptions();

onMounted(loadInitialValues);

/** Populate optionsList for every configured domain (national targets come from the Solr index). */
async function loadOptions() {
  await Promise.all(props.domains.map(async (domain) => {
    optionsList.value[domain] = domain === 'nationalTargets7'
      ? await getNationalTargets7({ countries: props.countries, rows: 300, locale: props.locale, locales: props.locales })
      : await getData(domain);
  }));
}

/** Single-field mode: one grouped multiselect listing several domains together. */
async function loadOptionsSingle() {
  const domains = ['bchSubjects', 'gbfTargets', 'sdgs', 'countries', 'regions', 'subjects'];
  const data = await Promise.all(domains.map(getData));
  optionsList.value = domains.map((domain, i) => ({ domain: t(domain), terms: data[i] }));
}

/** Hydrate the selection from the comma-separated keys saved in the hidden Drupal input. */
async function loadInitialValues() {
  const keys = getInputElement()?.value?.split(',').filter(Boolean) ?? [];
  if (!keys.length) return;

  if (props.singleField) inputValue.value = await lookUp('all', keys, false);
  else await Promise.all(props.domains.map(async (domain) => {
    inputValue.value[domain] = await resolveSavedValue(domain, keys);
  }));

  handleChange();
}

/** Resolve one domain's saved keys to the full term object(s) it should display. */
async function resolveSavedValue(domain, keys) {
  if (domain === 'nationalTargets7') {
    const data = await getNationalTargets7({ countries: props.countries, rows: 300, locale: props.locale, locales: props.locales });
    return data.filter(({ identifier }) => keys.includes(identifier));
  }
  if (domain === 'bchSubjectGroups') {
    const matched = await lookUp('bchSubjects', keys, false);
    const ids = new Set((matched || []).map(({ identifier }) => identifier));
    return (optionsList.value.bchSubjectGroups || []).flatMap((g) => g.children || []).filter((c) => ids.has(c.identifier));
  }
  const single = props.singleValueDomains.includes(domain);
  return (await lookUp(domain, keys, single)) || (single ? null : []);
}

/** The hidden Drupal input this widget reads/writes (main or "additional" value). */
function getInputElement() {
  const name = props.name.toLowerCase();
  const key = props.isAdditionalField ? 'value2' : 'value';
  return document.querySelector(`input[name='field_${name}[0][${key}]']`)
    || document.querySelector(`edit-field-${name}-0-${key}`);
}

/** Every selected identifier across all domains, de-duplicated. */
function getAllKeys() {
  if (props.singleField) return inputValue.value.map(({ identifier }) => identifier);

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
    if (!LINKABLE_DOMAINS.includes(domain) || !Array.isArray(optionsList.value[domain])) continue;

    const current = inputValue.value[domain] ?? [];
    const have = new Set(current.map(({ identifier }) => identifier));
    const additions = optionsList.value[domain].filter(({ identifier }) => related.has(identifier) && !have.has(identifier));
    if (additions.length) inputValue.value[domain] = [...current, ...additions];
  }
}

/** Write the current selection back to the hidden Drupal input. */
function handleChange() {
  const inputElement = getInputElement();
  if (!inputElement) throw new Error(`Could not find element with name: field_${props.name.toLowerCase()}[0][value]`);
  inputElement.value = getAllKeys().join();
}
</script>


<style scoped>
.multiselect{
    padding-top: .25em;
    width: 100%;
}

.debug-info {
    padding: 0.5rem;
    margin-bottom: 1rem;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
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
