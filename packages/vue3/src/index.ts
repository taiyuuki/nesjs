import type { App } from 'vue'
import NesVue from './components/nes-vue.vue'

export { NesVue }
export * from './types'

// Vue 插件支持
export function install(app: App) {
    app.component('NesVue', NesVue)
}

export default { install }
