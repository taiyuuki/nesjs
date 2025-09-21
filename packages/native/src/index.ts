import type { EmulatorConfig } from '@nesjs/core'
import { NES } from '@nesjs/core'

import type { CanvasRendererOptions } from './renderer'
import { CanvasRenderer } from './renderer'
import { WebNESAudioOutput } from './audio'
import type { Player } from './controller'
import { NESController } from './controller'

export type NESEmulatorOptions = CanvasRendererOptions & EmulatorConfig & {
    player1KeyMap?: Record<string, string>
    player2KeyMap?: Record<string, string>
}

class NESEmulator {
    nes: NES
    renderer: CanvasRenderer
    audioOutput: WebNESAudioOutput
    frameDuration: number
    lastFrameTime = 0
    targetFPS = 60
    status = 0 // 0: stopped, 1: running, 2: paused
    animationFrameId: number | null = null
    romData: Uint8Array | null = null
    controller: NESController

    constructor(cvs: HTMLCanvasElement, config?: NESEmulatorOptions) {
        this.nes = new NES(config || {})
        this.renderer = new CanvasRenderer(cvs, config)
        this.audioOutput = new WebNESAudioOutput(config?.audioSampleRate)
        this.frameDuration = 1000 / this.targetFPS

        this.nes.setAudioInterface(this.audioOutput)
        this.nes.setRenderer(this.renderer)

        this.controller = new NESController(this.nes.getGamepad(1), this.nes.getGamepad(2))

        if (config?.player1KeyMap) {
            this.controller.setupKeyboadController(1, config.player1KeyMap)
        }
        
        if (config?.player2KeyMap) {
            this.controller.setupKeyboadController(2, config.player2KeyMap)
        }
    }

    async loadROM(romData: Uint8Array) {
        this.romData = romData
        await this.nes.loadROM(romData)
        switch (this.nes.getTVType()) {
            case 'NTSC':
                this.targetFPS = 60
                break
            case 'PAL':
            case 'DENDY':
                this.targetFPS = 50
                break
            default:
                this.targetFPS = 60
        }
        this.frameDuration = 1000 / this.targetFPS
    }

    private mainLoop() {
        const now = performance.now()
        const deltaTime = now - this.lastFrameTime
        if (this.status === 1 && deltaTime >= this.frameDuration) {
            this.nes.runFrame()
            this.lastFrameTime += this.frameDuration
        }

        this.animationFrameId = requestAnimationFrame(() => this.mainLoop())
    }

    public async start() {
        switch (this.status) {
            case 0: // Stopped
                if (!this.romData) {
                    throw new Error('ROM not loaded')
                }
                this.status = 1
                this.lastFrameTime = performance.now()
                this.mainLoop()
                await this.audioOutput.start()
                
                break
            case 2: // Paused
                this.resume()
                break
            case 1: // Running
                // Already running
                break
        }
    }

    public pause() {
        if (this.status !== 1) return // Not running
        this.audioOutput.pause()
        this.status = 2
    }

    public resume() {
        if (this.status !== 2) return // Not paused
        this.audioOutput.resume()
        this.status = 1
    }

    public stop() {
        if (this.status === 0) return // Already stopped
        this.audioOutput.destroy()
        this.status = 0
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId)
            this.animationFrameId = null
        }
    }

    public reset() {
        this.nes.reset()
    }

    public async enableAudio() {
        try {
            await this.audioOutput.start()

            return true
        }
        catch (error) {
            console.error(`Failed to enable audio: ${error}`)

            return false
        }
    }

    public disableAudio() {
        this.audioOutput.pause()
    }

    public setVolume(volume: number) {
        this.audioOutput.setVolume(volume)
    }

    public setScale(scale: number) {
        this.renderer.setScale(scale)
    }

    public setSmoothing(smoothing: boolean) {
        this.renderer.setSmoothing(smoothing)
    }

    public addCheat(code: string) {
        const cheater = this.nes.getCheater()
        if (!cheater) return
        try {

            cheater.addCheat(code)

            return true
        }
        catch (error) {
            console.error(error)

            return false
        }
    }

    public toggleCheat(code: string) {
        const cheater = this.nes.getCheater()
        if (!cheater) return
        const cheat = cheater.getCheat(code)

        if (cheat) {
            cheater.setCheatEnabled(code, !cheat.enabled)
        }
    }

    public removeCheat(code: string) {
        const cheater = this.nes.getCheater()
        if (!cheater) return
        cheater.removeCheat(code)
    }

    public clearAllCheats() {
        const cheater = this.nes.getCheater()
        if (!cheater) return
        cheater.clearCheats()
    }

    public setupKeyboadController(player: Player, keyMap: Record<string, string>) {
        this.controller.setupKeyboadController(player, keyMap)
    }

    public saveState(): Uint8Array {
        return this.nes.createBinarySaveState()
    }

    public loadState(state: Uint8Array) {
        this.nes.loadBinarySaveState(state)
    }
}

export { NESEmulator }
