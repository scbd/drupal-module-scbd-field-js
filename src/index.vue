<template>
  <ChmComponent
    :isAdditionalField="isAdditionalField"
    :name="name"
    :description="description"
    :locale="locale"
    :locales="locales"
    :countries="countries"
    :domains="domains"
    :debug="debug"
  />
</template>

<script>
import './style.scss'

import ChmComponent from '@/components/index.vue';
import { DEFAULT_DOMAINS } from '@/utils/constants.js';

export default {
  name      : 'App',
  props     : {
    name             : { type: String,  required: true },
    description      : { type: String,  required: false },
    countries        : { type: Array,   required: false, default: () => ['be'] },
    locale           : { type: String,  required: false, default: 'en' },
    locales          : { type: Array,   required: false, default: () => ['en'] },
    domains          : { type: Array,   required: false, default: () => [...DEFAULT_DOMAINS] },
    isAdditionalField: { type: Boolean, required: false, default: false },
    debug            : { type: Boolean, required: false, default: false },
  },
  components: { ChmComponent }
};
</script>
