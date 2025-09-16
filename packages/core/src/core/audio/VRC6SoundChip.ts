
import type { ExpansionSoundChip } from '../interfaces'
import { Utils } from '../types'
import { SquareTimer } from './SquareTimer'

export class VRC6SoundChip implements ExpansionSoundChip {
    private timers = [new SquareTimer(16), new SquareTimer(16)]
    private enable = [true, true, true]
    private volume = [0, 0, 0]
    private sawdivider = 15
    private sawctr = 0
    private sawaccum = 0
    private sawseq = 0
    private clocknow = false

    public write(register: number, data: number): void {
        switch (register) {
            case 0x9000:
                this.volume[0] = data & 0xf
                this.timers[0].setduty(data & Utils.BIT7 ? 16 : (data >> 4 & 7) + 1)
                break
            case 0x9001:
                this.timers[0].setperiod((this.timers[0].getperiod() & 0xf00) + data)
                break
            case 0x9002:
                this.timers[0].setperiod((this.timers[0].getperiod() & 0xff) + ((data & 0xf) << 8))
                this.enable[0] = !!(data & Utils.BIT7)
                break
            case 0xa000:
                this.volume[1] = data & 0xf
                this.timers[1].setduty(data & Utils.BIT7 ? 16 : (data >> 4 & 7) + 1)
                break
            case 0xa001:
                this.timers[1].setperiod((this.timers[1].getperiod() & 0xf00) + data)
                break
            case 0xa002:
                this.timers[1].setperiod((this.timers[1].getperiod() & 0xff) + ((data & 0xf) << 8))
                this.enable[1] = !!(data & Utils.BIT7)
                break
            case 0xb000:
                this.sawaccum = data & 0x3f
                break
            case 0xb001:
                this.sawdivider = (this.sawdivider & 0xf00) + data
                break
            case 0xb002:
                this.sawdivider = (this.sawdivider & 0xff) + ((data & 0xf) << 8)
                this.enable[2] = !!(data & Utils.BIT7)
                break
        }
    }

    public clock(cycle: number): void {
        this.timers[0].clock(cycle)
        this.timers[1].clock(cycle)
        for (let i = 0; i < cycle; ++i) {
            this.clocksaw()
        }
    }

    public getval(): number {
        return 320 * (
            (this.enable[0] ? this.volume[0] : 0) * this.timers[0].getval()
            + (this.enable[1] ? this.volume[1] : 0) * this.timers[1].getval()
            + (this.enable[2] ? (this.volume[2] & 0xff) >> 3 : 0)
        )
    }

    private clocksaw(): void {
        --this.sawctr
        if (this.sawctr < 0) {
            this.sawctr = this.sawdivider
            if (this.clocknow) {
                this.clocknow = false
                this.volume[2] += this.sawaccum
                ++this.sawseq
                if (this.sawseq > 6) {
                    this.sawseq = 0
                    this.volume[2] = 0
                }
            }
            else {
                this.clocknow = true
            }
        }
    }
}
