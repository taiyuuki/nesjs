import { NES } from '@nesjs/core'
import { Audio } from './audio'
import { Animation } from './animation'
import type { ControllerOptions } from './gamepad'
import { NESGamepad } from './gamepad'
import { keyIn } from './utils'
import { DB } from './db'

type EmulatorOptions = {

    /** Screen options. */
    screen?: {

        /** The width of the canvas. */
        width: number

        /** The height of the canvas */
        height?: number
    }

    /** Gamepad options. */
    gamepad?: { 

        /** The sensitive threshold for the gamepad's level of input, between 0 and 1, default to 0.3 */  
        threshold?: number

        /** The mashing speed of the turbo button, in frames per second, between 5 and 30, default to 16 */
        turbo?: number
    }

    /** Keyboard options. */
    controller?: {

        /** The player 1's controller configuration. */
        p1?: ControllerOptions

        /** The player 2's controller configuration. */
        p2?: ControllerOptions
    }

    /** Audio options. */
    volume?: number

    /** Clip 8 pixels around the screen. */
    clip?: boolean

    /** Enable gamepad support. */
    enableGamepad?: boolean

    /** Whether to compress the saved state, default to true. */
    compressSaveState?: boolean
}

type VideoOptions = {
    type: 'fm2'
    text?: string
    URL?: string
}

/**
 * # NES Emulator
 * 
 * The NES emulator is a JavaScript library that runs Nintendo Entertainment System (NES) games in a web browser. It uses the Web Audio API to generate sound and the Canvas API to render graphics. It also supports gamepads and keyboards for controller input.
 * @example
 * ```typescript
 * import { NESEmulator } from '@nesjs/native'
 * 
 * const cvs = document.getElementById('canvas') // Get the canvas element.
 * const nes = new NESEmulator(cvs) // Create a new emulator instance.
 * nes.start('rom.nes') // Start the emulator with the specified ROM URL.
 * ```
 */
class NESEmulator {
    nes: NES
    currentURL: string | undefined = void 0
    rom: string | null = null
    audio: Audio
    animation: Animation
    gamepad: NESGamepad
    paused = false
    cheats: Record<string, string> = {}
    private _db: DB<{ data: Uint8Array | string, compress: boolean }>

    constructor(cvs: HTMLCanvasElement, opt?: EmulatorOptions) {
        if (!cvs || cvs.tagName !== 'CANVAS') {
            throw new Error('[@nesjs/native] Please specify a canvas element.')
        }
        this.audio = new Audio()
        this.animation = new Animation(cvs)
        this.nes = new NES({ 
            onAudioSample: this.audio.onFrame.bind(this.audio),
            onFrame: this.animation.onFrame.bind(this.animation),
            sampleRate: this.audio.getSampleRate(),
        })
        this.gamepad = new NESGamepad(this.nes)
        this._db = new DB('nesjs', 'save_data')
        if (opt) {
            this.updateOptions(opt)
        }
        this.gamepad.addKeyboadEvent()
    }

    /**
     * Resize the screen of the canvas.
     * Please keep the ratio of 256×240 for width and height.
     * @param width - The new width of the canvas.
     * @param height - Optional. The new height of the canvas. If not specified, the height will be calculated based on the width.
     */
    resizeScreen(width: number, height?: number) {
        this.animation.resize(width, height)
    }

    /**
     * Update the emulator options.
     * @param opt 
     */
    updateOptions(opt: EmulatorOptions) {
        if (opt.controller?.p1) {
            this.gamepad.p1 = opt.controller.p1
        }
        if (opt.controller?.p2) {
            this.gamepad.p2 = opt.controller.p2
        }
        if (opt.gamepad?.turbo) {
            this.gamepad.setInterval(opt.gamepad.turbo)
        }
        if (opt.gamepad?.threshold) {
            this.gamepad.setThreshold(opt.gamepad.threshold)
        }
        if (keyIn('volume', opt)) {
            this.audio.setVolume(opt.volume!)
        }
        if (keyIn('clip', opt)) {
            this.nes.ppu.clipToTvSize = opt.clip!
        }
        if (keyIn('enableGamepad', opt)) {
            this.gamepad.setEnableGamepad(opt.enableGamepad!)
        }
    }

    /**
     * Start the emulator with the specified ROM URL.
     * @param romURL 
     */
    async start(romURL?: string) {
        if (!this.nes.break) {
            this.stop()
        }
        try {
            this.rom = await this._getROM(romURL)
            this.nes.loadROM(this.rom)
            if (this.paused) {
                this.play()
            }
            this.audio.createAudioProgressor(() => {
                this.nes.frame()
            })

        }
        catch (error) {
            throw new Error(`[@nesjs/native] ${error}`)
        }
    }

    private async _getROM(romURL?: string) {
        if (romURL === this.currentURL && this.rom) {
            return this.rom
        }
        
        return new Promise<string>((resolve, reject) => {
            if (!romURL) {
                if (!this.currentURL) {
                    reject('TypeError: Invalid ROM URL')
                }

                return 
            }
            this.currentURL = romURL
            const xhr = new XMLHttpRequest()
            xhr.open('GET', romURL, true)
            xhr.overrideMimeType('text/plain; charset=x-user-defined')
            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(xhr.response)
                }
                else {
                    reject(xhr.statusText)
                }
            }
            xhr.onerror = () => {
                reject(xhr.statusText)
            }
            xhr.send()
        })
    }

    /**
     * Pause the emulator.
     */
    pause() {
        this.audio.pause()
        this.paused = true
    }

    /**
     * Resume the emulator.
     */
    play() {
        this.audio.resume()
        this.paused = false
    }

    /**
     * Toggle the emulator between paused and playing.
     * @returns Whether the emulator is paused or not.
     */
    toggle() {
        if (this.paused) {
            this.play()
        }
        else {
            this.pause()
        }

        return this.paused
    }

    /**
     * Stop the emulator.
     */
    stop() {
        this.audio.stop()
        this.nes.stop()
        this.animation.reset()
    }

    /**
     * Reset the emulator.
     */
    reset() {
        if (this.currentURL) {
            this.stop()
            this.start(this.currentURL)
        }
        else {
            throw new Error('[@nesjs/native] Please specify a ROM URL before resetting the emulator.')
        }
    }

    /**
     * Save the current game state.
     * @param id - A unique ID for the saved state.
     * @param compress - Whether to compress the saved state, default to true.
     */
    saveState(id: string) {
        const state = this.nes.toJSON()
        this._db.setItem(id, state)
    }

    /**
     * Load the game state.
     * @param id - The ID of the saved state.
     */
    async loadState(id: string) {
        const state = await this._db.getItem(id)
        if (!state) {
            return Promise.reject(`[@nesjs/native] No saved state found with ID ${id}.`)
        }
        this.nes.fromJSON(state)
    }

    /**
     * Remove the saved game state.
     * @param id - The ID of the saved state.
     */
    removeState(id: string) {
        this._db.removeItem(id)
    }

    /**
     * Remove all saved game states.
     */
    removeAllStates() {
        this._db.clear()
    }

    /**
     * Play a replay video file.
     * @param opt - The video options.
     */
    async playVideo<T extends VideoOptions>(opt: T extends Required<VideoOptions> ? never : T) {
        this.gamepad.removeKeyboardEvent()
        this.gamepad.removeGamepadEvent()

        switch (opt.type) {
            case 'fm2':
                if (opt.text) {
                    this.playVideoByFM2Text(opt.text)
                }
                else if (opt.URL) {
                    await this.playVideoByFM2URL(opt.URL)
                }
                else {
                    this.stopVideo()

                    return Promise.reject('[@nesjs/native] Please specify a text or URL for the FM2 file.')
                }
                break
        }
    }

    playVideoByFM2Text(fm2Text: string) {
        this.start(this.currentURL)
        const check = this.nes.video.parseFM2(fm2Text)
        if (check) {
            this.nes.video.run()
        }
        else {
            console.warn('[@nesjs/native] Not a valid FM2 file.')
        }
    }

    playVideoByFM2URL(fm2URL: string) {
        return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('GET', fm2URL, true)
            xhr.responseType = 'text'
            xhr.onload = () => {
                if (xhr.status === 200) {
                    const fm2Text = xhr.response
                    this.playVideoByFM2Text(fm2Text)
                    resolve()
                }
                else {
                    reject(`Failed to load fm2 file from ${fm2URL}.`)
                }
            }
            xhr.onerror = () => {
                reject(`Failed to load fm2 file from ${fm2URL}.`)
            }
            xhr.send()
        })
    }

    /**
     * Stop the replay video.
     */
    stopVideo() {
        this.nes.video.stop()
        this.gamepad.addKeyboadEvent()
        if (this.gamepad.enableGamepad) {
            this.gamepad.addGamepadEvent()
        }
    }

    /**
     * Set a cheat code.
     * @param code - The cheat code.
     */
    setCheat(code: string) {
        this.nes.cheat.onCheat(code)
        this.cheats[code] = code
    }

    /**
     * Remove a cheat code.
     * @param code - The cheat code.
     */
    removeCheat(code: string) {
        if (this.cheats[code]) {
            this.nes.cheat.disableCheat(this.cheats[code])
        }
    }

    /**
     * Reset all cheat codes.
     */
    resetCheats() {
        this.nes.cheat.reset()
    }
}
export { NESEmulator }

export type { EmulatorOptions }
