import { NES } from '@nesjs/core'
import { Audio } from './audio'
import { Animation } from './animation'

class NesEmulator {
    nes: NES
    currentURL: string | undefined = void 0
    rom: string | null = null
    audio: Audio
    animation: Animation

    constructor(cvs: HTMLCanvasElement) {
        this.audio = new Audio()
        this.animation = new Animation(cvs)
        this.nes = new NES({ 
            onAudioSample: this.audio.onFrame.bind(this.audio),
            onFrame: this.animation.onFrame.bind(this.animation),
            sampleRate: this.audio.getSampleRate(),
        })
    }

    async start(romURL?: string) {
        if (!this.nes.break) {
            this.stop()
        }
        try {
            this.rom = await this.getROM(romURL)
            this.nes.loadROM(this.rom)
    
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

    saveState() {
        return this.nes.toJSON()
    }

    loadState(state: ReturnType<NES['toJSON']>) {
        this.nes.fromJSON(state)
    }

    async playVideo(opt: { type: 'fm2', URL?: string, text?: string }) {
        if (opt.type === 'fm2') {
            if (opt.text) {
                this.playVideoByFM2Text(opt.text)
            }
            else if (opt.URL) {
                await this.playVideoByFM2URL(opt.URL)
            }
            else {
                throw new Error('[@nesjs/native] Please specify a URL or text for the FM2 file.')
            }
        }
    }

    playVideoByFM2Text(fm2Text: string) {
        this.start(this.currentURL)
        this.nes.video.parseFM2(fm2Text)
        this.nes.video.run()
    }

    playVideoByFM2URL(fm2URL: string) {
        return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('GET', fm2URL, true)
            xhr.onload = () => {
                if (xhr.status === 200) {
                    const fm2Text = xhr.response
                    this.start(this.currentURL)
                    this.nes.video.parseFM2(fm2Text)
                    this.nes.video.run()
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
    }
}
export { NesEmulator }
