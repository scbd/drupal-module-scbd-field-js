<template>
  <ChmComponent
    :isAdditionalField="isAdditionalField"
    :name="name"
    :description="description"
    :locale="locale"
    :locales="locales"
    :countries="countries"
    :domains="domains"
    :single-value-domains="singleValueDomains"
    :debug="debug"
  />
</template>

<script>
import './style.scss'

import ChmComponent from '@/components/index.vue';
import { DEFAULT_DOMAINS, DEFAULT_SINGLE_VALUE_DOMAINS } from '@/utils/constants.js';

export default {
  name      : 'App',
  props     : {
    name             : { type: String,  required: true },
    description      : { type: String,  required: false },
    countries        : { type: Array,   required: false, default: () => ['be'] },
    locale           : { type: String,  required: false, default: 'en' },
    locales          : { type: Array,   required: false, default: () => ['en'] },
    domains          : { type: Array,   required: false, default: () => [...DEFAULT_DOMAINS] },
    // Which domains render as a single-select (one term) vs multi-select (array). Forwarded to the
    // inner component so a host can configure it through the public wrapper; mirrors
    // `src/components/index.vue`'s `singleValueDomains` default via the shared canonical constant.
    singleValueDomains: { type: Array,   required: false, default: () => [...DEFAULT_SINGLE_VALUE_DOMAINS] },
    isAdditionalField: { type: Boolean, required: false, default: false },
    debug            : { type: Boolean, required: false, default: false },
  },
  components: { ChmComponent }
};
</script>
