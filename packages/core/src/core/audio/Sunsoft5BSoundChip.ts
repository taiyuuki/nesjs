
import { Utils } from '../types'
import { SquareTimer } from './SquareTimer'

export class Sunsoft5BSoundChip {
    private timers = [new SquareTimer(32), new SquareTimer(32), new SquareTimer(32)]
    private enable = [false, false, false]
    private useenvelope = [false, false, false]
    private volume = [0, 0, 0]
    private enval = 0
    private static VOLTBL = Sunsoft5BSoundChip.getvoltbl()

    public write(register: number, data: number): void {
        switch (register) {
            case 0:
                this.timers[0].setperiod((this.timers[0].getperiod() & 0xf00) + data)
                break
            case 1:
                this.timers[0].setperiod((this.timers[0].getperiod() & 0xff) + ((data & 0xf) << 8))
                break
            case 2:
                this.timers[1].setperiod((this.timers[1].getperiod() & 0xf00) + data)
                break
            case 3:
                this.timers[1].setperiod((this.timers[1].getperiod() & 0xff) + ((data & 0xf) << 8))
                break
            case 4:
                this.timers[2].setperiod((this.timers[2].getperiod() & 0xf00) + data)
                break
            case 5:
                this.timers[2].setperiod((this.timers[2].getperiod() & 0xff) + ((data & 0xf) << 8))
                break
            case 7:
                for (let i = 0; i < 3; ++i) {
                    this.enable[i] = !((data & 1 << i) !== 0)
                }
                break
            case 8:
                this.volume[0] = data & 0xf
                this.useenvelope[0] = (data & Utils.BIT4) !== 0
                break
            case 9:
                this.volume[1] = data & 0xf
                this.useenvelope[1] = (data & Utils.BIT4) !== 0
                break
            case 10:
                this.volume[2] = data & 0xf
                this.useenvelope[2] = (data & Utils.BIT4) !== 0
                break
            case 13:
                this.enval = 15
                break
            default:

                // 未识别寄存器写入
        }
    }

    public clock(cycle: number): void {
        this.clockenvelope()
        this.timers[0].clock(cycle)
        this.timers[1].clock(cycle)
        this.timers[2].clock(cycle)
    }

    public getval(): number {
        return (this.enable[0] ? (this.useenvelope[0] ? this.enval : Sunsoft5BSoundChip.VOLTBL[this.volume[0]]) * this.timers[0].getval() : 0)
            + (this.enable[1] ? (this.useenvelope[1] ? this.enval : Sunsoft5BSoundChip.VOLTBL[this.volume[1]]) * this.timers[1].getval() : 0)
            + (this.enable[2] ? (this.useenvelope[2] ? this.enval : Sunsoft5BSoundChip.VOLTBL[this.volume[2]]) * this.timers[2].getval() : 0)
    }

    private static getvoltbl(): number[] {
        const vols = new Array(16)
        for (let i = 0; i < 16; ++i) {
            vols[i] = Math.floor(90 * Math.pow(1.4, i))
        }

        return vols
    }

    private clockenvelope(): void {
        this.enval = 0 // Gimmick 只用 envelope 静音
    }
}
