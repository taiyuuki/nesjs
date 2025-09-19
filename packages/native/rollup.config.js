import { defineConfig } from 'rollup'
import ts from 'rollup-plugin-typescript2'
import commonjs from '@rollup/plugin-commonjs'
import babelPlugin from '@rollup/plugin-babel'
import dts from 'rollup-plugin-dts'
import terser from '@rollup/plugin-terser'

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
            terser(),
        ],
    },
    {
        input: 'src/index.ts',
        output: {
            dir: 'dist/types',
            format: 'esm',
        },
        plugins: [
            dts(),
        ],
    },
])

export default config
