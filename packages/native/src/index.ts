import type { EmulatorConfig, GamepadInterface } from '@nesjs/core'
import { GamepadButton, NES } from '@nesjs/core'

import type { CanvasRendererOptions } from './renderer'
import { CanvasRenderer } from './renderer'
import { WebNESAudioOutput } from './audio'

type KeyMap = { [key: string]: GamepadButton }

type NESEmulatorOptions = CanvasRendererOptions & EmulatorConfig & {
    player1KeyMap?: KeyMap
    player2KeyMap?: KeyMap
}

class NESEmulator {
    nes: NES
    renderer: CanvasRenderer
    audioOutput: WebNESAudioOutput
    audioEnabled = false
    frameDuration: number
    lastFrameTime = 0
    targetFPS = 60
    status = 0 // 0: stopped, 1: running, 2: paused
    animationFrameId: number | null = null
    romData: Uint8Array | null = null
    gamepad1: GamepadInterface
    gamepad2: GamepadInterface
    player1KeyMap: KeyMap = {
        KeyK: GamepadButton.A,
        KeyJ: GamepadButton.B, 
        Space: GamepadButton.SELECT, 
        Enter: GamepadButton.START, 
        KeyW: GamepadButton.UP, 
        KeyS: GamepadButton.DOWN, 
        KeyA: GamepadButton.LEFT, 
        KeyD: GamepadButton.RIGHT, 
    }
    player2KeyMap: KeyMap = {
        Numpad1: GamepadButton.A,
        Numpad2: GamepadButton.B,
        ArrowUp: GamepadButton.UP, 
        ArrowDown: GamepadButton.DOWN, 
        ArrowLeft: GamepadButton.LEFT, 
        ArrowRight: GamepadButton.RIGHT, 
    }

    constructor(cvs: HTMLCanvasElement, config?: NESEmulatorOptions) {
        this.nes = new NES(config || {})
        this.renderer = new CanvasRenderer(cvs, config)
        this.audioOutput = new WebNESAudioOutput()
        this.frameDuration = 1000 / this.targetFPS

        this.nes.setAudioInterface(this.audioOutput)
        this.nes.setRenderer(this.renderer)

        this.gamepad1 = this.nes.getGamepad(1)
        this.gamepad2 = this.nes.getGamepad(2)

        if (config?.player1KeyMap) {
            Object.assign(this.player1KeyMap, config.player1KeyMap)
        }

        if (config?.player2KeyMap) {
            Object.assign(this.player2KeyMap, config.player2KeyMap)
        }

        this.setUpKeyboadEvents()
    }

    async loadROM(romData: Uint8Array) {
        this.romData = romData
        await this.nes.loadROM(romData)
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
                if (this.audioEnabled) {
                    await this.audioOutput.start()
                }
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

    private setUpKeyboadEvents() {

        document.addEventListener('keydown', e => {
            let callPreventDefault = false
            if (e.code in this.player1KeyMap) {
                this.gamepad1.setButton(this.player1KeyMap[e.code], 1)
                callPreventDefault = true
            }
            if (e.code in this.player2KeyMap) {
                this.gamepad2.setButton(this.player2KeyMap[e.code], 1)
                callPreventDefault = true
            }
            if (callPreventDefault) {
                e.preventDefault()
            }
        })

        document.addEventListener('keyup', e => {
            let callPreventDefault = false
            if (e.code in this.player1KeyMap) {
                this.gamepad1.setButton(this.player1KeyMap[e.code], 0)
                callPreventDefault = true
            }
            if (e.code in this.player2KeyMap) {
                this.gamepad2.setButton(this.player2KeyMap[e.code], 0)
                callPreventDefault = true
            }
            if (callPreventDefault) {
                e.preventDefault()
            }
        })
    }

    public async enableAudio() {
        try {
            await this.audioOutput.start()
            this.audioEnabled = true

            return true
        }
        catch (error) {
            console.error(`Failed to enable audio: ${error}`)

            return false
        }
    }

    public disableAudio() {
        this.audioOutput.pause()
        this.audioEnabled = false
    }

    public setVolume(volume: number) {
        this.audioOutput.setVolume(volume)
    }

    public setScale(scale: number) {
        this.renderer.setScale(scale)
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

    public setKeyMap(player: number, keyMap: KeyMap) {
        if (player === 1) {
            Object.assign(this.player1KeyMap, keyMap)
        }
        else if (player === 2) {
            Object.assign(this.player2KeyMap, keyMap)
        }
    }
}

export { NESEmulator }
