
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import fastGlob from 'fast-glob'
import { Linter } from 'eslint'

// 向上查找配置文件
function findConfigFile(filename, startDir) {
    let currentDir = startDir
    while (true) {
        const filePath = path.join(currentDir, filename)
        if (fs.existsSync(filePath)) {
            return filePath
        }
        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir) {
            return null
        }
        currentDir = parentDir
    }
}

export default function mapperIndexPlugin(options = {}) {
    const {
        dir = 'src/core/mappers/MapperList',
        output = 'src/core/mappers/dyn.ts',
    } = options

    let linter = null

    let eslintConfig = null

    async function loadEslintConfig() {
        if (eslintConfig) return eslintConfig

        try {
            const configPath = findConfigFile('eslint.config.mjs', process.cwd())
            if (!configPath) {
                console.warn('[mapper-index-generator] ESLint config not found')

                return null
            }

            const configModule = await import(pathToFileURL(configPath).href)
            let configs = configModule.default

            // 处理可能的 Promise
            if (configs && typeof configs.then === 'function') {
                configs = await configs
            }

            // 确保是数组
            if (!Array.isArray(configs)) {
                console.warn('[mapper-index-generator] ESLint config is not an array')

                return null
            }

            eslintConfig = configs
            linter = new Linter({ configType: 'flat' })

            return { linter, configs: eslintConfig }
        }
        catch(e) {
            console.warn('[mapper-index-generator] Failed to load ESLint config:', e.message)

            return null
        }
    }

    async function lintFix(content, filename) {
        const eslint = await loadEslintConfig()
        if (!eslint) return content

        const { linter, configs } = eslint
        const result = linter.verifyAndFix(content, configs, { filename })

        if (result.messages.length > 0) {
            console.warn('[mapper-index-generator] ESLint warnings:', result.messages)
        }

        return result.output
    }

    return {
        name: 'rollup-plugin-mapper-index',
        async buildStart() {
            const absDir = path.resolve(process.cwd(), dir)
            const absOut = path.resolve(process.cwd(), output)
            const foundFiles = await fastGlob('*.ts', { cwd: absDir })
            const files = foundFiles.sort()

            // 变量名用文件名，去掉扩展名和非法字符
            function toValidVar(name) {
                return name.replace(/\.ts$/, '').replace(/\W/g, '_')
            }
            let content = '// 该文件由 rollup-plugin-mapper-index 自动生成，请勿手动修改\n\n'
            content += '// 动态导入所有Mapper列表\n'
            content += 'import type { Mapper } from \'./Mapper\'\n\n'
            content += 'type DynamicImport<T> = ()=> Promise<{ default: T }>\n\n'
            content += 'export const dynamicMappers: Record<string, DynamicImport<typeof Mapper>> = {\n'

            files.forEach(f => {
                const varName = toValidVar(f)
                content += `    ${varName}: () => import('./MapperList/${f.replace('.ts', '')}'),\n`
            })
            content += '}\n\n'

            // 使用 ESLint 修复代码格式
            content = await lintFix(content, absOut)

            fs.writeFileSync(absOut, content)

            this.warn(`[mapper-index-generator] Generated ${output}`)
        },
    }
}
