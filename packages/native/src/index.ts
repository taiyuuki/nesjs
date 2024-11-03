import { NES } from '@nesjs/core'
import { Audio } from './audio'
import { Animation } from './animation'

class NesEmulator {
    nes: NES
    currentURL: string | null = null
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

    async start(romURL: string) {
        if (!this.nes.break) {
            this.stop()
        }
        try {
            this.rom = await this.getROM(romURL)
            this.nes.loadROM(this.rom)
    
            this.audio.createAudioProgressor(() => {
                this.nes.frame()
            })

            setTimeout(() => {
                console.log(this.saveState())
            }, 1000)

        }
        catch (error) {
            throw new Error(`[@nesjs/native] ${error}`)
        }
    }

    getROM(romURL: string) {
        if (romURL === this.currentURL && this.rom) {
            return this.rom
        }
        
        return new Promise<string>((resolve, reject) => {
            if (typeof romURL !== 'string') {
                reject('TypeError: Invalid ROM URL')
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
}

export { NesEmulator }
