import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { NES } from '../packages/core/src/index'

type CliOptions = {
    romPath:     string
    frames:      number[]
    expectHash?: string
    dumpState:   boolean
}

type FrameCapture = {
    frame: number
    hash:  string
}

class CaptureRenderer {
    lastFrame: Uint8Array = new Uint8Array(0)

    renderFrame(imageData: Uint8Array): void {
        this.lastFrame = imageData.slice()
    }
}

function parseArgs(argv: string[]): CliOptions {
    let romPath = ''
    let frames = [1, 30, 60, 120, 240]
    let expectHash: string | undefined
    let dumpState = false

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]

        if (!arg.startsWith('--') && !romPath) {
            romPath = arg
            continue
        }

        if (arg === '--frames') {
            const value = argv[++i]
            if (!value) {
                throw new Error('Missing value for --frames')
            }
            frames = value
                .split(',')
                .map(item => Number.parseInt(item.trim(), 10))
                .filter(item => Number.isFinite(item) && item > 0)
            continue
        }

        if (arg === '--expect-hash') {
            expectHash = argv[++i]?.trim().toLowerCase()
            if (!expectHash) {
                throw new Error('Missing value for --expect-hash')
            }
            continue
        }

        if (arg === '--dump-state') {
            dumpState = true
            continue
        }

        throw new Error(`Unknown argument: ${arg}`)
    }

    if (!romPath) {
        throw new Error('Usage: pnpm esno scripts/mmc5-frame-hash.ts <rom-path> [--frames 1,30,60,120,240] [--expect-hash <sha256>] [--dump-state]')
    }

    if (frames.length === 0) {
        throw new Error('At least one frame must be provided')
    }

    frames.sort((a, b) => a - b)

    return {
        romPath,
        frames,
        expectHash,
        dumpState,
    }
}

function hashFrame(frame: Uint8Array): string {
    return createHash('sha256').update(frame)
        .digest('hex')
}

function pickMMC5State(rawState: any) {
    if (!rawState || typeof rawState !== 'object') {
        return null
    }

    return {
        exramMode:     rawState.exramMode,
        chrMode:       rawState.chrMode,
        prgMode:       rawState.prgMode,
        chrOr:         rawState.chrOr,
        wrambank:      rawState.wrambank,
        scanctrEnable: rawState.scanctrEnable,
        irqPend:       rawState.irqPend,
        scanctrLine:   rawState.scanctrLine,
        irqCounter:    rawState.irqCounter,
        exlatch:       rawState.exlatch,
        lastfetch:     rawState.lastfetch,
        spritemode:    rawState.spritemode,
        chrregs:       Array.isArray(rawState.chrregs) ? rawState.chrregs : undefined,
        chrregsB:      Array.isArray(rawState.chrregsB) ? rawState.chrregsB : undefined,
        prgregs:       rawState.prgregs,
        romHere:       rawState.romHere,
        lastNtSetup:   rawState.lastNtSetup,
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2))
    const romData = new Uint8Array(await readFile(options.romPath))
    const nes = new NES({ enableCheat: false })
    const renderer = new CaptureRenderer()

    nes.setRenderer(renderer)
    await nes.loadROM(romData)

    const romInfo = nes.getROMInfo()
    console.log(JSON.stringify({
        romPath:      options.romPath,
        romInfo,
        sampleFrames: options.frames,
    }, null, 2))

    const captures: FrameCapture[] = []
    const maxFrame = options.frames[options.frames.length - 1]
    let frameIndex = 0

    for (let frame = 1; frame <= maxFrame; frame++) {
        nes.runFrame()

        if (frame === options.frames[frameIndex]) {
            const hash = hashFrame(renderer.lastFrame)
            captures.push({ frame, hash })
            frameIndex++
        }
    }

    console.log(JSON.stringify({ captures }, null, 2))

    const finalHash = captures[captures.length - 1]?.hash
    if (!finalHash) {
        throw new Error('No frame hash captured')
    }

    if (options.dumpState) {
        const saveState = nes.createSaveState()
        console.log(JSON.stringify({
            mapperState: pickMMC5State(saveState.mapper?.state),
            ppuState:    {
                scanline:   saveState.ppu?.scanline,
                cycles:     saveState.ppu?.cycles,
                frameCount: saveState.frameCount,
                control:    saveState.ppu?.control,
            },
        }, null, 2))
    }

    if (options.expectHash && finalHash !== options.expectHash) {
        console.error(`Hash mismatch: expected ${options.expectHash}, got ${finalHash}`)
        process.exitCode = 1
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
