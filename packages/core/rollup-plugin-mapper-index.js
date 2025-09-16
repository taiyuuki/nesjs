
import path from 'node:path'
import fs from 'node:fs'
import fastGlob from 'fast-glob'

export default function mapperIndexPlugin(options = {}) {
    const {
        dir = 'src/core/mappers/MapperList',
        output = 'src/core/mappers/dyn.ts',
    } = options

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

            // const imports = files.map(f => {
            //     const varName = toValidVar(f)

            //     return `import ${varName} from './MapperList/${f.replace('.ts', '')}'`
            // }).join('\n')
            // const exportArr = files.map(f => toValidVar(f)).join(', ')
            // const exports = `export default [${exportArr}]\n`
            fs.writeFileSync(absOut, content)

            this.warn(`[mapper-index-generator] Generated ${output}`)
        },
    }
}
