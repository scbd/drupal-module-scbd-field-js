import      { createApp   } from 'vue'
import App from './index'

const anApp = createApp(App, { singleField: false, isAdditionalField: false, name: 'tags', locale:'en', locales:['en','nl','de','fr'],
    domains: ['bchSubjectGroups' , 'nationalTargets7', 'gbfTargets','countries', 'subjects', 'sdgs', 'bchSubjects'], countries:['gt']
})//
 
anApp.mount('#app')

