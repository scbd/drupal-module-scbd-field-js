<template>
  <ChmComponent :name="name" :description="description"/>
</template>

<script>
import './style.scss'

import ChmComponent from './components/index.vue';

export default {
  name      : 'App',
  props     : {
    name: { type: String, required: true },
    description          : { type: String, required: false },
    options   : { type: Object }
  },
  components: { ChmComponent }
};
</script>


