import type { EmulatorConfig } from '@nesjs/core'
import { NES } from '@nesjs/core'

import { CanvasRenderer } from './renderer'
import { WebNESAudioOutput } from './audio'

type NESEmulatorOptions = EmulatorConfig & {}

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

    constructor(cvs: HTMLCanvasElement, config: NESEmulatorOptions = {}) {
        this.nes = new NES(config)
        this.renderer = new CanvasRenderer(cvs)
        this.audioOutput = new WebNESAudioOutput()
        this.frameDuration = 1000 / this.targetFPS

        this.nes.setAudioInterface(this.audioOutput)
        this.nes.setRenderer(this.renderer)
    }

    async loadROM(romData: Uint8Array) {
        this.romData = romData
        await this.nes.loadROM(romData)
    }

    mainLoop() {
        const now = performance.now()
        const deltaTime = now - this.lastFrameTime
        if (this.status === 1 && deltaTime >= this.frameDuration) {
            this.nes.runFrame()
            this.lastFrameTime = now
        }

        this.animationFrameId = requestAnimationFrame(() => this.mainLoop())
    }

    async start() {
        switch (this.status) {
            case 0: // Stopped
                if (!this.romData) {
                    throw new Error('ROM not loaded')
                }
                await this.audioOutput.start()
                this.status = 1
                this.lastFrameTime = performance.now()
                this.mainLoop()
                break
            case 2: // Paused
                this.resume()
                break
            case 1: // Running
                // Already running
                break
        }
    }

    pause() {
        if (this.status !== 1) return // Not running
        this.audioOutput.pause()
        this.status = 2
    }

    resume() {
        if (this.status !== 2) return // Not paused
        this.audioOutput.resume()
        this.status = 1
    }

    stop() {
        if (this.status === 0) return // Already stopped
        this.audioOutput.destroy()
        this.status = 0
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId)
            this.animationFrameId = null
        }
    }

    reset() {
        this.nes.reset()
    }
}

export { NESEmulator }
