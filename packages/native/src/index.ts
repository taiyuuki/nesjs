import { NES } from '@nesjs/core'
import { Audio } from './audio'
import { Animation } from './animation'
import { NESGamepad } from './gamepad'
import { keyIn } from './utils'

type EmulatorOptions = {
    gamepad?: { 
        threshold?: number
        turbo?: number
    }
    controller?: {
        p1?: NESGamepad['_p1']
        p2?: NESGamepad['_p2']
    }
    volume?: number
    clip?: boolean
    enableGamepad?: boolean
}

type VideoOptions = {
    type: 'fm2'
    text?: string
    URL?: string
}

class NESEmulator {
    nes: NES
    currentURL: string | undefined = void 0
    rom: string | null = null
    audio: Audio
    animation: Animation
    gamepad: NESGamepad
    paused = false

    constructor(cvs: HTMLCanvasElement, opt?: EmulatorOptions) {
        if (!cvs || !(cvs instanceof HTMLCanvasElement)) {
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
        if (opt) {
            this.updateOptions(opt)
        }
        this.gamepad.addKeyboadEvent()
    }

    resizeScreen(width: number, height?: number) {
        this.animation.resize(width, height)
    }

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

    async start(romURL?: string) {
        if (!this.nes.break) {
            this.stop()
        }
        try {
            this.rom = await this.getROM(romURL)
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

    getROM(romURL?: string) {
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

    pause() {
        this.audio.pause()
    }

    play() {
        this.audio.resume()
    }

    stop() {
        this.audio.stop()
        this.nes.stop()
    }

    reset() {
        if (this.currentURL) {
            this.stop()
            this.start(this.currentURL)
        }
        else {
            throw new Error('[@nesjs/native] Please specify a ROM URL before resetting the emulator.')
        }
    }

    saveState(compress = true) {
        return this.nes.toJSON(compress)
    }

    loadState(state: ReturnType<NES['toJSON']>) {
        this.nes.fromJSON(state)
    }

    async playVideo<T extends VideoOptions>(opt: T extends Required<VideoOptions> ? never : T) {
        this.gamepad.removeKeyboardEvent()
        this.gamepad.removeGamepadEvent()
        if (opt.type === 'fm2') {
            if (opt.text) {
                this.playVideoByFM2Text(opt.text)
            }
            else if (opt.URL) {
                await this.playVideoByFM2URL(opt.URL)
            }
            else {
                this.stopVideo()
                throw new Error('[@nesjs/native] Please specify a URL or text for the FM2 file.')
            }
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

    stopVideo() {
        this.nes.video.stop()
        this.gamepad.addKeyboadEvent()
        this.gamepad.addGamepadEvent()
    }
}
export { NESEmulator }

export type { EmulatorOptions }
