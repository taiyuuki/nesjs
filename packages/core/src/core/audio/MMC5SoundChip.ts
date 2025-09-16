import type { ExpansionSoundChip } from '../interfaces'
import { SquareTimer } from './SquareTimer'

const DUTYLOOKUP = [1, 2, 4, 6]
const LENCTRLOAD = [10,
    254,
    20,
    2,
    40,
    4,
    80,
    6,
    160,
    8,
    60,
    10,
    14,
    12,
    26,
    14,
    12,
    16,
    24,
    18,
    48,
    20,
    96,
    22,
    192,
    24,
    72,
    26,
    16,
    28,
    32,
    30]

export class MMC5SoundChip implements ExpansionSoundChip {
    timers: [SquareTimer, SquareTimer]
    volume = [0, 0]
    lenCtrEnable = [true, true, true, true]
    pcmMode = false
    pcmIRQen = false
    cycles = 0
    pcmOut = 0
    lengthctr = [0, 0, 0, 0]
    lenctrHalt = [true, true, true, true]
    envelopeValue = [15, 15, 15, 15]
    envelopeCounter = [0, 0, 0, 0]
    envelopePos = [0, 0, 0, 0]
    envConstVolume = [true, true, true, true]
    envelopeStartFlag = [false, false, false, false]
    framectr = 0
    ctrmode = 4

    constructor() {
        this.timers = [new SquareTimer(8, 2), new SquareTimer(8, 2)]
    }

    clock(cycle: number) {
        this.cycles += cycle
        if (this.cycles % 7445 !== this.cycles) {
            this.clockframecounter()
            this.cycles %= 6445
        }
        this.timers[0].clock(cycle)
        this.timers[1].clock(cycle)
    }

    write(register: number, data: number) {
        switch (register) {
            case 0x0:
                this.lenctrHalt[0] = !!(data & 0x20)
                this.timers[0].setduty(DUTYLOOKUP[data >> 6])
                this.envConstVolume[0] = !!(data & 0x10)
                this.envelopeValue[0] = data & 15
                break
            case 0x1:
                break
            case 0x2:
                this.timers[0].setperiod((this.timers[0].getperiod() & 0xfe00) + (data << 1))
                break
            case 0x3:
                if (this.lenCtrEnable[0]) {
                    this.lengthctr[0] = LENCTRLOAD[data >> 3]
                }
                this.timers[0].setperiod((this.timers[0].getperiod() & 0x1ff) + ((data & 7) << 9))
                this.timers[0].reset()
                this.envelopeStartFlag[0] = true
                break
            case 0x4:
                this.lenctrHalt[1] = !!(data & 0x20)
                this.timers[1].setduty(DUTYLOOKUP[data >> 6])
                this.envConstVolume[1] = !!(data & 0x10)
                this.envelopeValue[1] = data & 15
                break
            case 0x5:
                break
            case 0x6:
                this.timers[1].setperiod((this.timers[1].getperiod() & 0xfe00) + (data << 1))
                break
            case 0x7:
                if (this.lenCtrEnable[1]) {
                    this.lengthctr[1] = LENCTRLOAD[data >> 3]
                }
                this.timers[1].setperiod((this.timers[1].getperiod() & 0x1ff) + ((data & 7) << 9))
                this.timers[1].reset()
                this.envelopeStartFlag[1] = true
                break
            case 0x10:
                this.pcmMode = !!(data & 0x01)
                this.pcmIRQen = !!(data & 0x80)
                break
            case 0x11:
                if (!this.pcmMode) {
                    if (data !== 0) {
                        this.pcmOut = data
                    }
                }
                break
            default:
                break
        }
    }

    getval(): number {
        let accum = 0
        for (let i = 0; i < 2; ++i) {
            accum += this.volume[i] * this.timers[i].getval() * 750
        }
        accum += this.pcmOut << 5

        return accum
    }

    status(): number {
        return (this.lengthctr[0] === 0 ? 0 : 1) + (this.lengthctr[1] === 0 ? 0 : 2)
    }

    private setlength() {
        for (let i = 0; i < 4; ++i) {
            if (!this.lenctrHalt[i] && this.lengthctr[i] > 0) {
                --this.lengthctr[i]
                if (this.lengthctr[i] === 0) {
                    this.setvolumes()
                }
            }
        }
    }

    private setenvelope() {
        for (let i = 0; i < 2; ++i) {
            if (this.envelopeStartFlag[i]) {
                this.envelopeStartFlag[i] = false
                this.envelopePos[i] = this.envelopeValue[i] + 1
                this.envelopeCounter[i] = 15
            }
            else {
                --this.envelopePos[i]
            }
            if (this.envelopePos[i] <= 0) {
                this.envelopePos[i] = this.envelopeValue[i] + 1
                if (this.envelopeCounter[i] > 0) {
                    --this.envelopeCounter[i]
                }
                else if (this.lenctrHalt[i] && this.envelopeCounter[i] <= 0) {
                    this.envelopeCounter[i] = 15
                }
            }
        }
    }

    private setvolumes() {
        this.volume[0] = this.lengthctr[0] <= 0 ? 0 : this.envConstVolume[0] ? this.envelopeValue[0] : this.envelopeCounter[0]
        this.volume[1] = this.lengthctr[1] <= 0 ? 0 : this.envConstVolume[1] ? this.envelopeValue[1] : this.envelopeCounter[1]
    }

    private clockframecounter() {
        if (this.framectr < 4) {
            this.setenvelope()
        }
        if (this.ctrmode === 4 && (this.framectr === 1 || this.framectr === 3)
            || this.ctrmode === 5 && (this.framectr === 0 || this.framectr === 2)) {
            this.setlength()
        }
        ++this.framectr
        this.framectr %= this.ctrmode
        this.setvolumes()
    }
}
