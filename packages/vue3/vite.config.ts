import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import rollupDelete from 'rollup-plugin-delete'
import dts from 'vite-plugin-dts'
import basicSsl from '@vitejs/plugin-basic-ssl'

function resolve(dir: string) {
    return path.join(__dirname, dir)
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        basicSsl(),
        dts({
            outDir: 'dist',
            staticImport: true,
            insertTypesEntry: true,
            rollupTypes: true,
        }),
        vue(),
    ],
    resolve: {
        alias: {
            '@': resolve('src'),
            'src': resolve('src'),
            'common': resolve('src/common'),
            'components': resolve('src/components'),
            'composables': resolve('src/composables'),
        },
    },
    build: {
        lib: {
            entry: resolve('src/index.ts'),
            name: 'nesjsVue',
            fileName: format => `nesjs-vue.${format}.js`,
        },
        rollupOptions: {
            external: ['vue', '@nesjs/core', '@nesjs/native'],
            output: {

                // 为外部依赖提供全局变量
                globals: { NesVue: 'NesVue' },
            },
            plugins: [
                rollupDelete({
                    targets: ['dist/**/*.{ico,txt,svg,nes,NES,fm2}'],
                    hook: 'generateBundle',
                }),
            ],
        },
    },
    server: { 
        port: 10001,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
})
