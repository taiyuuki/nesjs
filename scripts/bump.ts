import fs from 'node:fs'
import fg from 'fast-glob'
import prompts from 'prompts'
import { cyan, green, red, yellow } from 'kolorist'

async function bump() {
    
    const bumpType = process.argv[2]

    const packageFiles = fg.sync(['**/package.json'], {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        absolute: true,
    })

    const replacemenets: [string, string][] = []

    packageFiles.forEach(file => {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf-8'))
        const currentVersion = packageJson.version
        const versionParts = currentVersion.split('.')
        let newVersion = ''
        if (bumpType === 'patch') {
            versionParts[2] = (Number.parseInt(versionParts[2]) + 1).toString()
            newVersion = versionParts.join('.')
        }
        else if (bumpType === 'minor') {
            versionParts[1] = (Number.parseInt(versionParts[1]) + 1).toString()
            versionParts[2] = '0'
            newVersion = versionParts.join('.')
        }
        else if (bumpType === 'major') {
            versionParts[0] = (Number.parseInt(versionParts[0]) + 1).toString()
            versionParts[1] = '0'
            versionParts[2] = '0'
            newVersion = versionParts.join('.')
        }
        if (newVersion) {
            console.log(cyan(file), red(currentVersion), yellow('->'), green(newVersion))
            replacemenets.push([file, JSON.stringify({ ...packageJson, version: newVersion }, null, 2)])
        }
    })
    console.log()

    if (replacemenets.length > 0) {
        const { ok } = await prompts({
            type: 'confirm',
            name: 'ok',
            message: `Are you sure you want to update ${green(replacemenets.length)} package.json files?`,
        })
        if (ok) {
            replacemenets.forEach(([file, content]) => {
                fs.writeFileSync(file, content)
            })
            console.log(green('Package.json files updated successfully.'))
        }
        else {
            console.log(red('Aborting.'))
        }
    }
}

bump()
