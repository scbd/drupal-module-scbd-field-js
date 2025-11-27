<template>
  <section>


  <div v-if="description" class="help-text">{{ description }}</div>

  <div v-if="debug" class="debug-info">
    <strong>Debug - Current Values:</strong> {{ getAllKeys().join(', ') }}
  </div>

  <div v-if="!singleField" class="multi-field-container">
    <div v-for="(domain,index) in domains" :key="index" >
      <div v-if="optionsList[domain]?.length" class="multi-field-child">
        <label   :for="`${name}-${domain}`" class="control-label" :class="{'fw-bold':isAdditionalField}">{{ t(domain) }}</label>

        <multiselect v-if="optionsList[domain]?.length && !isGroupedDomain(domain)"
          :id="`${name}-${domain}`"
          v-model="inputValue[domain]"
          :class="['chm-multiselect']"
          track-by="identifier"
          label="name"
          :options="optionsList[domain]"
          :multiple="isMultiple(domain)"
          :taggable="true"
          :group-select="false"
          @select="handleSelect"
          @close="handleChange"
          @remove="handleRemove"
          :searchable="true"
          :hide-selected="isMultiple(domain)"
          :ref="`multiSelect-${domain}`"
          :placeholder="''"
        />
        <multiselect v-if="optionsList[domain]?.length && isGroupedDomain(domain)"
          :id="`${name}-${domain}`"
          v-model="inputValue[domain]"
          :class="['chm-multiselect', 'has-grouped-options']"
          track-by="identifier"
          label="name"
          :options="optionsList[domain]"
          :multiple="isMultiple(domain)"
          :taggable="true"
          :group-select="true"
          group-values="children"
          group-label="name"
          @select="handleSelect"
          @close="handleChange"
          @remove="handleRemove"
          :searchable="true"
          :hide-selected="isMultiple(domain)"
          :ref="`multiSelect-${domain}`"
          :placeholder="''"
        />
        <br>
      </div>
    </div>
  </div>

    <multiselect v-if="singleField"
      :id="name"
      v-model="inputValue"
      :class="['chm-multiselect', singleField ? 'has-grouped-options' : null]"
      track-by="identifier"
      label="name"
      :options="optionsList"
      :multiple="true"
      :taggable="true"
      :group-select="false"
      group-values="terms"
      group-label="domain"
      :placeholder="description"
      @close="handleChange"
      :searchable="true"
      :hide-selected="true"
      ref="multiSelect"
      @remove="handleChange"
    />
  </section>
</template>

<script>
import { toRef, ref, unref, computed } from 'vue'
import { initializeApiStore, getData, lookUp } from '@scbd/cached-apis'
import   Multiselect        from 'vue-multiselect'
import { ofetch as $fetch } from "ofetch";
import   domainNamesMap     from '../i18n'

export default {
  name       : 'ChmSelectInputControl',
  components : { Multiselect },
  props      : {
                  name          : { type: String, required: true },
                  description   : { type: String, required: false, default: ' ' },
                  countries     : { type: Array,  required: false, default: () => ['be'] },
                  locale        : { type: String, required: false, default: 'en' },
                  locales       : { type: Array,  required: false, default: () => ['en'] },
                  domains       : { type: Array,  required: false, default: () => [ 'nationalTargets7', 'gbfTargets','countries', 'subjects', 'sdgs', 'bchSubjectGroups' ] }, //
                  singleValueDomains : { type: Array,  required: false, default: () => [ 'orgTypes', 'govTypes', 'projectStatuses', 'geoScopes', 'documentTypes','jurisdictions','eventStatuses'] },
                  singleField   : { type: Boolean, required: false, default: false },
                  isAdditionalField: { type: Boolean, required: false, default: false },
                  debug         : { type: Boolean, required: false, default: false }
                },
  methods    : { handleSelect, handleRemove, loadInitialValues, handleChange, t, getAllKeys, isMultiple, isGroupedDomain, getInputElement },
  setup,  mounted
}

function isGroupedDomain(domain){
  return domain.toLowerCase().includes('group');
}

function isMultiple(domain){
  return this.singleValueDomains.includes(domain)? false : true;
}

function setup(props) {
    const singleField         = toRef(props, 'singleField');
    const name                = toRef(props, 'name');
    const domains             = toRef(props, 'domains');
    const singleValueDomains  = toRef(props, 'singleValueDomains');
    const countries           = toRef(props, 'countries');
    const locale              = toRef(props, 'locale');
    const locales             = toRef(props, 'locales');
    const optionsList         = unref(singleField)? ref([]) : ref({ 'gbfTargets': [], 'subjects': [], 'countries': [], 'sdgs': [], nationalTargets7: [], 'orgTypes': [], 'govTypes': [], 'projectStatuses': [], 'geoScopes': [], 'documentTypes': [],'jurisdictions': [] , eventStatuses: [], bchSubjectGroups: []});
    const inputValue          = unref(singleField)? ref([]) : ref({ 'gbfTargets': [], 'subjects': [], 'countries': [], 'sdgs': [], nationalTargets7: [], 'orgTypes': null, 'govTypes': null, 'projectStatuses': null, 'geoScopes': null, 'documentTypes': null,'jurisdictions': null , eventStatuses: null, bchSubjectGroups: []});

    const windowWidth = computed(() => window?.innerWidth);

    initializeApiStore();

    if(unref(singleField)) getOptionListSingle(optionsList, unref(locale));
    else getOptionList(domains, optionsList, countries, locale, locales);

    return { singleValueDomains, singleField, name, domains, optionsList, inputValue, windowWidth }
}


async function getOptionList(domains, optionsList, countries, locale, locales){

  const promisesForData = []

  for(const domain of unref(domains))
    if(domain === 'nationalTargets7')
      promisesForData.push(getNationalTargets7({countries:unref(countries), start:0, rows:300,locale:unref(locale), locales:unref(locales)}).then((data) => optionsList?.value? optionsList.value[domain] = data : optionsList[domain] = data))
    else  
      promisesForData.push(getData(domain).then((data) => optionsList.value? optionsList.value[domain] = data: optionsList[domain] = data))

  await Promise.all(promisesForData)

  return optionsList
}


async function getOptionListSingle(optionsList, locale){

  const promisesForData = [ getData('subjects'), getData('countries'), getData('regions'), getData('gbfTargets'), getData('sdgs'), getData('bchSubjects') ]
  const data            = await Promise.all(promisesForData)

  optionsList.value = [ 
    { domain: t.call({ locale }, 'bchSubjects'),  terms: data[5] },
    { domain: t.call({ locale }, 'gbfTargets'),   terms: data[3] }, 
    { domain: t.call({ locale }, 'sdgs'),         terms: data[4] },
    { domain: t.call({ locale }, 'countries'),    terms: data[1] }, 
    { domain: t.call({ locale }, 'regions'),      terms: data[2] }, 
    { domain: t.call({ locale }, 'subjects'),     terms: data[0] }
  ]
}

async function mounted(){

  await this.loadInitialValues(this.locale);
}

function getInputElement(){
  const mainEl       = document.querySelector(`input[name='field_${this.name.toLowerCase()}[0][value]']`) || document.querySelector(`edit-field-${this.name.toLowerCase()}-0-value`);
  const additionalEl = document.querySelector(`input[name='field_${this.name.toLowerCase()}[0][value2]']`) || document.querySelector(`edit-field-${this.name.toLowerCase()}-0-value2`);


  return  this.isAdditionalField? additionalEl : mainEl;
}

async function loadInitialValues(locale){

  const inputElement = this.getInputElement();
  const keysString   = inputElement?.value;
  const keys         = keysString? keysString.split(',') : [];

  if(!keys.length) return;

  if(this.singleField) this.inputValue = await lookUp('all', keys, false);
  else {
    for(const domain of this.domains){
      if(domain === 'nationalTargets7')
          this.inputValue[domain] = await getNationalTargets7({countries:this.countries, start:0, rows:300, locale:this.locale, locales:this.locales}).then((data) => data.filter(({ identifier }) => keys.includes(identifier)));
      else if(domain === 'bchSubjectGroups'){
        // Fetch bchSubjects data and populate bchSubjectGroups
        // lookUp uses 'bchSubjects' but we populate into bchSubjectGroups
        const bchSubjectsData = await lookUp('bchSubjects', keys, false);
        
        if(bchSubjectsData && bchSubjectsData.length && this.optionsList.bchSubjectGroups?.length) {
          const selectedIds = new Set(bchSubjectsData.map(item => item.identifier));
          const groupedItems = [];
          
          // Find matching items in the grouped options
          for(const identifier of selectedIds) {
            const groupItem = findInGroupedOptions(this.optionsList.bchSubjectGroups, identifier);
            if(groupItem) {
              groupedItems.push(groupItem);
            }
          }
          
          this.inputValue[domain] = groupedItems;
        } else {
          this.inputValue[domain] = [];
        }
      }
      else{
        const fullValues = await lookUp(domain, keys, this.singleValueDomains.includes(domain));

        this.inputValue[domain] = fullValues  || (this.singleValueDomains.includes(domain)? null : []);
      }
    }
  }
  this.handleChange();
}

function handleSelect(selectedOption, id){
  // Save the current selection first
  this.handleChange();
  
  // Handle GBF target auto-linking to SDGs
  if(id === 'tags-gbfTargets') {
    const sdgNumbersRaw = selectedOption?.sameAs?.filter((x)=> x.includes('SDG-')).map((x)=> x.replace('SDG-GOAL-', '')).map((x)=> x.replace('SDG-TARGET-', '')).map((x)=>  Math.floor(Number(x))).filter((x)=> x) || [];
   
    if(sdgNumbersRaw && sdgNumbersRaw.length) {
      const sdgNumbers = Array.from(new Set(sdgNumbersRaw));
      const keys = sdgNumbers.map(numbersToSdgKeys).join(',')
      const inputElement = this.getInputElement();
      inputElement.value = inputElement.value? `${inputElement.value},${keys}` : keys; 
      this.loadInitialValues();
      return;
    }
  }
}

function handleRemove(removedOption, id){
  this.handleChange();
}

function findInGroupedOptions(groupedOptions, identifier) {
  for(const group of (groupedOptions || [])) {
    if(group.children) {
      const found = group.children.find(child => child.identifier === identifier);
      if(found) return found;
    }
  }
  return null;
}

function handleGbf(selectedOption, id){
  this.handleChange();
  if(id !== 'tags-gbfTargets') return;


  const sdgNumbersRaw = selectedOption?.sameAs?.filter((x)=> x.includes('SDG-')).map((x)=> x.replace('SDG-GOAL-', '')).map((x)=> x.replace('SDG-TARGET-', '')).map((x)=>  Math.floor(Number(x))).filter((x)=> x) || [];

 
  if(!sdgNumbersRaw || !sdgNumbersRaw.length) return;

  const sdgNumbers = Array.from(new Set(sdgNumbersRaw));

   
  const keys = sdgNumbers.map(numbersToSdgKeys).join(',')


  const inputElement = document.querySelector(`input[name='field_${this.name.toLowerCase()}[0][value]']`) || document.querySelector(`edit-field-${this.name.toLowerCase()}-0-value`);

  inputElement.value = inputElement.value? `${inputElement.value},${keys}` : keys; 
  this.loadInitialValues();

}

function numbersToSdgKeys(x){
  const isSingleDigit = x < 10;

  return isSingleDigit? `SDG-GOAL-0${x}` : `SDG-GOAL-${x}`;

}

function handleChange(valuer, id){
  // console.log( arguments)
  const inputElement = this.getInputElement();

  const keys = this.getAllKeys();

  if(!inputElement) throw new Error(`Could not find element with name: field_${this.name.toLowerCase()}[0][value]`);

  inputElement.value =  keys.join();
}

function getAllKeys(){
  if(this.singleField) return this.inputValue.map(({ identifier }) => identifier);

  const keys = [];

  for(const domain of this.domains) {
    if(this.inputValue[domain] && this.inputValue[domain].length)
      keys.push(...(this.inputValue[domain]||[]).map(({ identifier }) => identifier));
    else if(this.inputValue[domain] && this.singleValueDomains.includes(domain))
      keys.push(this.inputValue[domain]?.identifier);
  }

  // Remove any duplicates that might have slipped through
  return [...new Set(keys.filter(k => k))];
}

function t(domain){
  const locale = this.locale || 'en';

  const hasLocale = (!!domainNamesMap[locale] && !!domainNamesMap[locale][domain]);

  return  hasLocale?  domainNamesMap[locale][domain] : domainNamesMap['en'][domain] || domain;
}

function indexQuery(countries = [],   start = 0, rows = 25, locale = 'en', locales = ['en']) {
    const fq = [
        "_state_s:public",
        "realm_ss:ort"
    ];
    
    const governmentQuery = countries.length > 0 ? `AND government_s : (${countries.join(' ')})` : '';

    const q = `(schema_s : (nationalTarget7)${governmentQuery})`;

    const titles =  getTitles(locales, locale);

    return JSON.stringify({
        df: `text_${locale.toUpperCase()}_txt`,
        fq,
        q,
        sort: `title_${locale.toUpperCase()}_t asc`,
        fl: `identifier:uniqueIdentifier_s, name:title_${mapLocaleFromDrupal(locale).toUpperCase()}_t${titles}`,
        wt: "json",
        start,
        rows
    });
}
function getTitles(locales, locale){
  let t = '';

  if(locales?.length === 1 && locales[0] === locale) return t;

  for(const aLocale of locales.filter((l)=> l!==locale))
    t += `, title_${mapLocaleFromDrupal(aLocale).toUpperCase()}_t`

  return t
}

function mapLocaleFromDrupal(locale){
  if(locale === 'zh-hans') return 'zh';
  if(locale === 'fil') return 'tl';

  return locale
}

async function getNationalTargets7(ctx = {}) {
    const { countries = [], start = 0, rows = 25, locale, locales } = ctx;
    const query = indexQuery(countries, start, rows, locale, locales);

    const uri = `https://api.cbd.int/api/v2013/index/select`;

    try {
        const { response } = await $fetch(uri, {
            method: 'post',
            body: query,
            headers: { 'Content-Type': 'application/json' }
        });

        return response.docs.map((doc)=>normalizeNationalTarget(mapLocaleFromDrupal(locale), locales, doc));
    } catch (error) {
        console.error('Error fetching national targets:', error);
        throw error;
    }
}

function normalizeNationalTarget(currentLocale, locales, obj) {
  if (!obj.name) {
    for (const locale of locales.filter((l) => l !== currentLocale)) {
      const alternativeTitleKey = `title_${mapLocaleFromDrupal(locale).toUpperCase()}_t`;
      if (obj[alternativeTitleKey]) {
        obj.name = obj[alternativeTitleKey];
        break;
      }
    }
  }
  return obj;
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