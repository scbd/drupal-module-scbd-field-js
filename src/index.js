import   component    from './index.vue'
import { pascalCase } from 'change-case'
import { name       } from '../package.json'


const NAME =  pascalCase(name.replace('@scbd/', ''))

export function install(Vue){
  if (install.installed) return
  
  install.installed = true
  
  Vue.component(NAME, component)
}

export const plugin = { install, NAME }

export default component