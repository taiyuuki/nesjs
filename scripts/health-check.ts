import { execSync } from 'node:child_process'
import { cyan, green, red, yellow } from 'kolorist'

function runCommand(command: string) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: 'pipe' })
    }
    catch (error: any) {
        return error.stdout || error.message
    }
}

function checkProjectHealth() {
    console.log(cyan('🔍 NES.js 项目健康检查'))
    console.log('='.repeat(50))

    // 检查依赖安装
    console.log(yellow('📦 检查依赖安装...'))
    try {
        runCommand('pnpm list')
        console.log(green('✅ 依赖安装正常'))
    }
    catch (_error) {
        console.log(red('❌ 依赖安装有问题'))
    }

    // 检查代码风格
    console.log(yellow('🎨 检查代码风格...'))
    try {
        runCommand('pnpm lint')
        console.log(green('✅ 代码风格正常'))
    }
    catch (_error) {
        console.log(red('❌ 代码风格有问题'))
    }

    // 检查类型检查
    console.log(yellow('🔍 检查类型...'))
    try {
        runCommand('pnpm typecheck')
        console.log(green('✅ 类型检查通过'))
    }
    catch (_error) {
        console.log(red('❌ 类型检查有问题'))
    }

    // 检查构建
    console.log(yellow('🏗️ 检查构建...'))
    try {
        runCommand('pnpm build')
        console.log(green('✅ 构建成功'))
    }
    catch (_error) {
        console.log(red('❌ 构建失败'))
    }

    // 检查测试
    console.log(yellow('🧪 检查测试...'))
    try {
        runCommand('pnpm test')
        console.log(green('✅ 测试通过'))
    }
    catch (_error) {
        console.log(red('❌ 测试失败'))
    }

    console.log('='.repeat(50))
    console.log(green('✨ 健康检查完成'))
}

checkProjectHealth()
