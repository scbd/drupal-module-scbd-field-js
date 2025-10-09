import      { createApp   } from 'vue'
import App from './index'

const anApp = createApp(App, { isAdditionalField: false, name: 'tags', locale:'en', locales:['en','nl','de','fr']})//
 
anApp.mount('#app')

