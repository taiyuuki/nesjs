import { defineConfig } from 'rollup'
import ts from 'rollup-plugin-typescript2'
import commonjs from '@rollup/plugin-commonjs'
import babelPlugin from '@rollup/plugin-babel'
import raw from 'rollup-plugin-raw'
import dts from 'rollup-plugin-dts'

const config = defineConfig([
    {
        input: ['src/index.ts'],
        output: [
            {
                dir: 'dist/esm',
                format: 'esm',
            },
            {
                dir: 'dist/cjs',
                format: 'cjs',
            },
        ],
        plugins: [
            ts(),
            babelPlugin({
                exclude: '**/node_modules/**',
                babelHelpers: 'bundled',
                extensions: ['.ts'],
            }),
            commonjs(),
            raw({ filter: /.*?\.worker\.js$/ }),
        ],
    },
    {
        input: 'src/index.ts',
        output: {
            dir: 'dist/types',
            format: 'esm',
        },
        plugins: [
            raw({ filter: /.*?\.worker\.js$/ }),
            dts(),
        ],
    },
])

export default config
