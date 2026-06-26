<!--
  Dev-only visual test harness (NOT shipped — the lib build entry is src/index.js).

  Routes (hash-based, no router dependency) exercise the real widget configurations:
    #/bl2/tags    BL2 tags field  (multi-domain)
    #/bl2/single  BL2 single fields, one row per content type
    #/bsl/tags    BSL tags field  (multi-domain, incl. bchSubjectGroups)
    #/bsl/single  BSL single fields, one row per content type
    #/unused      every domain not used by any view above, in one multi-field widget

  Each widget reads/writes a hidden Drupal input found by `field_<name>[0][value]`. Here that
  input is rendered as a visible read-only box so the saved value is observable while testing —
  the widget writes straight to its `.value` (DOM), exactly as it does on a Drupal node form.
-->
<template>
  <div class="harness container py-4" :dir="dir">
    <header class="mb-4">
      <h1 class="h4 mb-3">SCBD Field — visual test harness</h1>

      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <ul class="nav nav-pills">
          <li v-for="r in routes" :key="r.hash" class="nav-item">
            <a class="nav-link" :class="{ active: r.hash === activeHash }" :href="r.hash">{{ r.label }}</a>
          </li>
        </ul>

        <label class="ms-auto d-flex align-items-center gap-2 mb-0">
          <span class="text-muted small">Display locale</span>
          <select v-model="locale" class="form-select form-select-sm" style="width:auto">
            <option v-for="l in site.locales" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
      </div>

      <div class="alert py-2 px-3 mb-0" :class="bannerClass">
        <strong>{{ site.label }}</strong>
        &middot; country <code>{{ site.countries.join(', ') }}</code>
        &middot; locales <code>{{ site.locales.join(', ') }}</code>
        &middot; view <code>{{ view }}</code>
      </div>
    </header>

    <!-- TAGS: a single multi-domain widget -->
    <section v-if="view === 'tags'" :key="`${siteKey}-tags-${locale}`">
      <h2 class="h6 text-muted">Tags &mdash; domains: <code>{{ site.tagsDomains.join(', ') }}</code></h2>
      <div class="card">
        <div class="card-body">
          <App
            :name="`${siteKey}_tags`"
            :domains="site.tagsDomains"
            :countries="site.countries"
            :locale="locale"
            :locales="site.locales"
            :debug="true"
          />
          <div class="mt-3">
            <label class="form-label small text-muted mb-1">Saved value (hidden Drupal input)</label>
            <input class="form-control form-control-sm font-monospace" type="text" readonly
                   :id="`edit-field-${siteKey}_tags-0-value`"
                   :name="`field_${siteKey}_tags[0][value]`" :value="site.tagsSeed.join(',')"
                   placeholder="(nothing selected yet)">
            <div class="id-line">id: <code>edit-field-{{ siteKey }}_tags-0-value</code></div>
          </div>
        </div>
      </div>
    </section>

    <!-- SINGLE FIELDS: one row per content type, each bound to its single-value domain -->
    <section v-else-if="view === 'single'" :key="`${siteKey}-single-${locale}`">
      <h2 class="h6 text-muted">Single fields &mdash; one widget per content type</h2>
      <div class="table-responsive">
        <table class="table table-bordered align-middle bg-white">
          <thead class="table-light">
            <tr>
              <th style="width:14rem">Content type</th>
              <th style="width:11rem">Domain</th>
              <th>Field</th>
              <th style="width:18rem">Saved value</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in site.singleFields" :key="f.name">
              <td class="fw-semibold">{{ f.contentType }}</td>
              <td><code>{{ f.domain }}</code></td>
              <td>
                <App
                  :name="`${siteKey}_${f.name}`"
                  :domains="[f.domain]"
                  :countries="site.countries"
                  :locale="locale"
                  :locales="site.locales"
                  :debug="true"
                />
              </td>
              <td>
                <input class="form-control form-control-sm font-monospace" type="text" readonly
                       :id="`edit-field-${siteKey}_${f.name}-0-value`"
                       :name="`field_${siteKey}_${f.name}[0][value]`" :value="f.seed" placeholder="(none)">
                <div class="id-line">id: <code>edit-field-{{ siteKey }}_{{ f.name }}-0-value</code></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- UNUSED: every multi-field domain not exercised by any BL2/BSL view, in one widget -->
    <section v-else-if="view === 'unused'" :key="`unused-${locale}`">
      <h2 class="h6 text-muted">
        Unused multi fields &mdash; domains not used by any BL2/BSL view: <code>{{ site.domains.join(', ') }}</code>
      </h2>
      <div class="card">
        <div class="card-body">
          <App
            name="unused_multi"
            :domains="site.domains"
            :countries="site.countries"
            :locale="locale"
            :locales="site.locales"
            :debug="true"
          />
          <div class="mt-3">
            <label class="form-label small text-muted mb-1">Pretend saved value (harness-only input)</label>
            <input class="form-control form-control-sm font-monospace" type="text" readonly
                   id="edit-field-unused_multi-0-value" name="field_unused_multi[0][value]"
                   placeholder="(nothing selected yet)">
            <div class="id-line">id: <code>edit-field-unused_multi-0-value</code></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import App from '@/index.vue';

// The two site profiles. Defaults mirror what each Drupal site passes to the widget.
const SITES = {
  bl2: {
    label: 'BL2',
    countries: ['be'],
    locales: ['en', 'fr', 'nl', 'de'],
    tagsDomains: ['gbfTargets', 'nationalTargets7', 'countries', 'subjects', 'sdgs'],
    // Pre-saved keys so each field hydrates a value on load (proves the load path). Real api.cbd.int ids.
    tagsSeed: ['GBF-TARGET-01', 'ort-nt7-be-276962-2', 'be', 'CBD-SUBJECT-MAR', 'SUSTAINABLE-DEVELOPMENT-GOAL-14'],
    singleFields: [
      { name: 'event_status',      contentType: 'Event Status',      domain: 'eventStatuses',   seed: 'NCHM-EVENT-STATUS-CONFIRMED' },
      { name: 'project_status',    contentType: 'Project Status',    domain: 'projectStatuses', seed: 'AD9696E5-52E9-49BB-A635-1DB06C89A757' },
      { name: 'organization_type', contentType: 'Organization Type', domain: 'orgTypes',        seed: '86D464C3-B5BB-4B02-85E4-1AAD8D64CD27' },
      { name: 'ecosystem_type',    contentType: 'Ecosystem Type',    domain: 'ecosystemTypes',  seed: 'T1.1' },
      { name: 'document_type',     contentType: 'Document Type',     domain: 'documentTypes',   seed: '474BC340-A877-4827-81AF-38B9378F56D0' },
    ],
  },
  bsl: {
    label: 'BSL',
    countries: ['gt'],
    locales: ['en', 'fr', 'es', 'ru', 'zh', 'ar'], // 6 UN languages
    tagsDomains: ['bchSubjectGroups', 'gbfTargets', 'nationalTargets7', 'countries'],
    tagsSeed: ['8431E752-F266-4823-B3DE-BF7194972FC0', 'GBF-TARGET-01', 'ort-nt7-gt-287002-1', 'gt'],
    singleFields: [
      { name: 'event_status',   contentType: 'Event Status',   domain: 'eventStatuses',   seed: 'NCHM-EVENT-STATUS-CONFIRMED' },
      { name: 'project_status', contentType: 'Project Status', domain: 'projectStatuses', seed: 'AD9696E5-52E9-49BB-A635-1DB06C89A757' },
      { name: 'document_type',  contentType: 'Document Type',  domain: 'documentTypes',   seed: '474BC340-A877-4827-81AF-38B9378F56D0' },
    ],
  },
};

// Every domain the widget can render, so we can derive what the BL2/BSL views leave out.
const ALL_DOMAINS = [
  'gbfTargets', 'nationalTargets7', 'countries', 'subjects', 'sdgs', 'regions', 'bchSubjects',
  'bchSubjectGroups', 'orgTypes', 'govTypes', 'projectStatuses', 'geoScopes', 'documentTypes',
  'ecosystemTypes', 'jurisdictions', 'eventStatuses',
];
const usedDomains = new Set(Object.values(SITES).flatMap((s) => [...s.tagsDomains, ...s.singleFields.map((f) => f.domain)]));

// Synthetic profile for the "Unused" view: one multi-field widget holding every leftover domain.
const UNUSED = {
  label: 'Unused',
  countries: ['be'],
  locales: ['en', 'fr', 'es'],
  domains: ALL_DOMAINS.filter((d) => !usedDomains.has(d)),
};

const ROUTES = [
  { hash: '#/bl2/tags',   site: 'bl2', view: 'tags',   label: 'BL2 · Tags' },
  { hash: '#/bl2/single', site: 'bl2', view: 'single', label: 'BL2 · Single fields' },
  { hash: '#/bsl/tags',   site: 'bsl', view: 'tags',   label: 'BSL · Tags' },
  { hash: '#/bsl/single', site: 'bsl', view: 'single', label: 'BSL · Single fields' },
  { hash: '#/unused',     site: null,  view: 'unused', label: 'Unused · Multi fields' },
];

export default {
  name: 'Harness',
  components: { App },
  data() {
    return { activeHash: window.location.hash || ROUTES[0].hash, locale: 'en', routes: ROUTES };
  },
  computed: {
    route()   { return ROUTES.find((r) => r.hash === this.activeHash) || ROUTES[0]; },
    siteKey() { return this.route.site || 'unused'; },
    site()    { return this.route.site ? SITES[this.route.site] : UNUSED; },
    view()    { return this.route.view; },
    dir()     { return this.locale === 'ar' ? 'rtl' : 'ltr'; },
    bannerClass() { return { bsl: 'alert-info', unused: 'alert-secondary' }[this.siteKey] || 'alert-success'; },
  },
  watch: {
    // Keep the chosen display locale valid when switching sites (en exists in both).
    site: { immediate: true, handler(s) { if (!s.locales.includes(this.locale)) this.locale = s.locales[0]; } },
  },
  mounted() {
    window.addEventListener('hashchange', this.onHashChange);
    if (!window.location.hash) window.location.hash = ROUTES[0].hash;
  },
  beforeUnmount() { window.removeEventListener('hashchange', this.onHashChange); },
  methods: { onHashChange() { this.activeHash = window.location.hash || ROUTES[0].hash; } },
};
</script>

<style scoped>
.harness { max-width: 1100px; }
.harness :deep(.multiselect) { min-width: 22rem; }

/* Saved-value id readout — matches the component's per-field `.debug-ids` style. */
.id-line {
  margin-top: 0.25rem;
  color: #6c757d;
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
}

/* Hover affordance on the unselected nav items. */
.nav-pills .nav-link {
  transition: background-color 0.12s ease, color 0.12s ease;
}
.nav-pills .nav-link:not(.active):hover {
  background-color: #e9ecef;
  color: #0a58ca;
}
</style>
