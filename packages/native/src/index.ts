import type { EmulatorConfig, GamepadInterface } from '@nesjs/core'
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
    gamepad1: GamepadInterface
    gamepad2: GamepadInterface

    constructor(cvs: HTMLCanvasElement, config: NESEmulatorOptions = {}) {
        this.nes = new NES(config)
        this.renderer = new CanvasRenderer(cvs)
        this.audioOutput = new WebNESAudioOutput()
        this.frameDuration = 1000 / this.targetFPS

        this.nes.setAudioInterface(this.audioOutput)
        this.nes.setRenderer(this.renderer)

        this.gamepad1 = this.nes.getGamepad(1)
        this.gamepad2 = this.nes.getGamepad(2)

        this.setUpKeyboadEvents()
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

    setUpKeyboadEvents() {
        const player1KeyMap: { [key: string]: number } = {
            KeyK: 0, // A
            KeyJ: 1, // B
            Space: 2, // SELECT
            Enter: 3, // START
            KeyW: 4, // UP
            KeyS: 5, // DOWN
            KeyA: 6, // LEFT
            KeyD: 7, // RIGHT
        }
        const player2KeyMap: { [key: string]: number } = {
            Numpad1: 0, // A
            Numpad2: 1, // B
            // Numpad0: 2, // SELECT
            // NumpadEnter: 3, // START
            ArrowUp: 4, // UP
            ArrowDown: 5, // DOWN
            ArrowLeft: 6, // LEFT
            ArrowRight: 7, // RIGHT
        }

        document.addEventListener('keydown', e => {
            if (e.code in player1KeyMap) {
                this.gamepad1.setButton(player1KeyMap[e.code], 1)
                e.preventDefault()
            }
            if (e.code in player2KeyMap) {
                this.gamepad2.setButton(player2KeyMap[e.code], 1)
                e.preventDefault()
            }
        })

        document.addEventListener('keyup', e => {
            if (e.code in player1KeyMap) {
                this.gamepad1.setButton(player1KeyMap[e.code], 0)
                e.preventDefault()
            }
            if (e.code in player2KeyMap) {
                this.gamepad2.setButton(player2KeyMap[e.code], 0)
                e.preventDefault()
            }
        })
    }
}

export { NESEmulator }
