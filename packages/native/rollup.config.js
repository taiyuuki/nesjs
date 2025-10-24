import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'rollup'
import ts from 'rollup-plugin-typescript2'
import commonjs from '@rollup/plugin-commonjs'
import babelPlugin from '@rollup/plugin-babel'
import dts from 'rollup-plugin-dts'
import terser from '@rollup/plugin-terser'

function inlineWorklet() {
    return {
        name: 'inline-worklet',
        transform(code, id) {
            if (!id.endsWith(path.join('src', 'audio.ts'))) return null

            const workletPath = path.resolve(path.dirname(id), 'nes-audio-processor.js')
           
            let workletSource = ''
            try {
                workletSource = fs.readFileSync(workletPath, 'utf8')
            }
            catch {
                this.warn(`inline-worklet: failed to read ${workletPath}, leaving placeholder`)

                return null
            }

            // escape backticks and ${ to safely embed into template literal
            const safe = workletSource.replace(/`/g, '\\`').replace(/\${/g, '\\${')
 
            // replace any assignment to `workletCode` (supports several placeholder formats)
            const replaced = code.replace(/const\s+workletCode\s*=\s*.*$/m, `const workletCode = \`${safe}\``)

            return {
                code: replaced,
                map: null,
            }
        },
    }
}

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
            inlineWorklet(),
            ts(),
            babelPlugin({
                exclude: '**/node_modules/**',
                babelHelpers: 'bundled',
                extensions: ['.ts'],
            }),
            commonjs(),
            
            // build-time injection handles embedding the worklet; no file copy needed
            
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
