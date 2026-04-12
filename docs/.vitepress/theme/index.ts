// .vitepress/theme/index.js
import DefaultTheme from 'vitepress/theme'
import Playground from './components/Playground.vue'
import './code.css'
import './custom.css'

export default {
    ...DefaultTheme,
    enhanceApp({ app }: { app: any }) {

        // Register global component
         
        app.component('Playground', Playground)
    },
}
