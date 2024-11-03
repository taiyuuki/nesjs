import type { NES } from './nes'
import { fillArray } from './utils'

class Video { 
    static REG = /\|\d\|([.ABDLR-U]{8})\|([.ABDLR-U]{8})?\|\|/g
    static NONE = '........'

    nes: NES
    running = false
    offset = 0

    controllerState: {
        [frame: number]: {
            p1: number[]
            p2: number[]
        }
    }

    constructor(nes: NES) { 
        this.nes = nes
        this.controllerState = {}
    }

    parseFM2(fm2Text: string) {
        let match = Video.REG.exec(fm2Text)
        if (!match) {
            return false
        }
        let frame = 0
        let last = false
        this.reset()
        while (match) {
            const p1_match = match[1] === Video.NONE
            const p2_match = match[2] === Video.NONE
            if (p1_match && p2_match) {
                if (last) {
                    this.controllerState[frame] = {
                        p1: fillArray(0x40, 8),
                        p2: fillArray(0x40, 8),
                    }
                    last = false
                }
                frame++
                match = Video.REG.exec(fm2Text)
                continue
            }
            last = true
            const p1 = match[1] ? match[1].split('').map(x => x === '.' ? 0x40 : 0x41)
                .reverse() : fillArray(0x40, 8)
            const p2 = match[2] ? match[2].split('').map(x => x === '.' ? 0x40 : 0x41)
                .reverse() : fillArray(0x40, 8)
            match = Video.REG.exec(fm2Text)
    
            this.controllerState[frame] = {
                p1,
                p2,
            }
            frame++
        }

        return true
    }

    reset() {
        this.controllerState = {}
        this.running = false
    }

    run(offset?: number) {
        if (Object.keys(this.controllerState).length === 0) {
            console.warn('[@nes/core] No video data found.')

            return
        }
        this.running = true
        if (offset) {
            this.offset = offset
        }
    }

    frame() {
        if (this.running) {
            const frame = this.nes.frameCount + 1 + this.offset
            if (frame in this.controllerState) {
                const script = this.controllerState[frame]
                this.nes.controllers[1].state = script.p1
                this.nes.controllers[2].state = script.p2
            }
        }
    }

    stop() {
        this.running = false
    }
}

export { Video }
