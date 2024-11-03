import type { CheatCodeMap } from './type'
import { objectEntries, toHexNumber } from './utils'
import type { NES } from './nes'

class Cheat {
    nes: NES
    enable: boolean
    fixed: CheatCodeMap
    greater: CheatCodeMap
    lesser: CheatCodeMap

    static REG = /([\dA-Fa-f]{4})-([0-3])([0-4])-([\dA-Fa-f]{2,8})/

    constructor(nes: NES) {
        this.nes = nes
        this.enable = false
        this.fixed = {}
        this.greater = {}
        this.lesser = {}
    }

    on(cheatAddress: number, cheatType: number, cheatValue: number) {
        if (cheatAddress > this.nes.cpu.mem.length - 1) {
            return
        }
        if (!this.enable) {
            this.enable = true
        }
        switch (cheatType) {
            case 0:
                this.fixed[cheatAddress] = cheatValue
                break
            case 1:
                this.nes.cpu.mem[cheatAddress] = cheatValue
                break
            case 2:
                this.lesser[cheatAddress] = cheatValue
                break
            case 3:
                this.greater[cheatAddress] = cheatValue
                break
        }
    }

    onCheat(cheatCode: string) {
        const matchs = Cheat.REG.exec(cheatCode)
        if (!matchs) {
            return
        }
        const cheatAddress = toHexNumber(matchs[1])
        const cheatType = toHexNumber(matchs[2])
        const cheatValue = toHexNumber(matchs[4])

        this.on(cheatAddress, cheatType, cheatValue)
    }

    removeCheat(cheatAddress: number) {
        delete this.fixed[cheatAddress]
        delete this.greater[cheatAddress]
        delete this.lesser[cheatAddress]
    }

    disableCheat(code: string) {
        const matchs = Cheat.REG.exec(code)
        if (!matchs) {
            return
        }
        const cheatAddress = toHexNumber(matchs[1])
        this.removeCheat(cheatAddress)
    }

    reset() {
        this.enable = false
        this.fixed = {}
        this.greater = {}
        this.lesser = {}
    }

    frame() {
        if (this.enable) {
            objectEntries(this.fixed).forEach(([address, value]) => {
                this.nes.cpu.mem[address] = value
            })
            objectEntries(this.greater).forEach(([address, value]) => {
                if (this.nes.cpu.mem[address] < value) {
                    this.nes.cpu.mem[address] = value
                }
            })
            objectEntries(this.lesser).forEach(([address, value]) => {
                if (this.nes.cpu.mem[address] > value) {
                    this.nes.cpu.mem[address] = value
                }
            })
        }
    }
}

export { Cheat }
