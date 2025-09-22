import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import rollupDelete from 'rollup-plugin-delete'
import dts from 'vite-plugin-dts'

function resolve(dir: string) {
    return path.join(__dirname, dir)
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        dts({
            insertTypesEntry: true,
            copyDtsFiles: true,
        }),
        rollupDelete({
            targets: ['dist/*'],
            hook: 'buildStart',
        }),
    ],
    resolve: { alias: { '@': resolve('src') } },
    build: {
        lib: {
            entry: resolve('src/index.ts'),
            name: 'nesjsReact',
            fileName: format => `nesjs-react.${format}.js`,
        },
        rollupOptions: {
            external: ['react', 'react-dom', '@nesjs/core', '@nesjs/native'],
            output: {

                // 为外部依赖提供全局变量
                globals: { NESReact: 'NESReact' },
            },
            plugins: [
                rollupDelete({
                    targets: ['dist/**/*.{ico,txt,svg,nes,NES,fm2}'],
                    hook: 'generateBundle',
                }),
            ],
        },
    },
})
