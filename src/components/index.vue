<template>
  <multiselect
      :id="name"
      v-model="inputValue"
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

    />

</template>

<script>
import { toRef, ref  } from 'vue'
import { initializeApiStore, getData, lookUp } from '@scbd/cached-apis'
import Multiselect   from 'vue-multiselect'

export default {
name       : 'ChmSelectInputControl',
components : { Multiselect },
props      : {
                name          : { type: String, required: true },
                description          : { type: String, required: false, default: ' ' },
                value         : { type: [ Object, Array ] }
              },
methods: {  loadInitialValues, handleChange },
setup,  mounted
}


function setup(props) {
const   optionsList = ref([])

initializeApiStore()
getOptionList()
    .then((data) =>  optionsList.value = data ) 

const name = toRef(props, 'name');
const value = toRef(props, 'value');
const inputValue = ref(value.value);


return { name, inputValue, optionsList }
}


async function getOptionList(){

const promisesForData = [ getData('subjects'), getData('countries'), getData('regions'), getData('gbfTargets'), getData('sdgs') ]
const data            = await Promise.all(promisesForData)

return [ 


  { domain: 'GBF', terms: data[3] }, 
  { domain: 'SDGs', terms: data[4] },
  { domain: 'Countries', terms: data[1] }, 
  { domain: 'Regions', terms: data[2] }, 
  { domain: 'Thematic Areas', terms: data[0] },
]
}

function mounted(){
//chrome anoying with muliselect
this.$refs.multiSelect.$refs.search.setAttribute('autocomplete', 'none')


this.loadInitialValues()
}

async function loadInitialValues(){
  const element = document.querySelector(`input[name='field_${this.name.toLowerCase()}[0][value]']`) || document.querySelector(`edit-field-${this.name.toLowerCase()}-0-value`)
  const keysString = element?.value
  const keys = keysString? keysString.split(',') : [];

  this.inputValue = await lookUp('all', keys, false)
}

function handleChange(){
  if(!this.inputValue) return;
  const element = document.querySelector(`input[name='field_${this.name.toLowerCase()}[0][value]']`) || document.querySelector(`edit-field-${this.name.toLowerCase()}-0-value`)
  const keys = this.inputValue.map(({ identifier }) => identifier)


  if(!element) throw new Error(`Could not find element with name: field_${this.name.toLowerCase()}[0][value]`);

  element.value =  keys.join();

}


</script>


<style scoped>
.multiselect{ padding-top: .25em;}

.help-text {
    margin-top: calc(6rem / 16);
    margin-bottom: calc(6rem / 16);
    color: var(--input-fg-color--description);
    font-size: var(--font-size-xs);
    line-height: calc(17rem / 16);
}

</style>