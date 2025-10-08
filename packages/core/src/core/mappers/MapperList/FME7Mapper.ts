import { Sunsoft5BSoundChip } from '../../audio/Sunsoft5BSoundChip'
import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class FME7Mapper extends Mapper {
    private commandRegister = 0
    private soundCommand = 0
    private charbanks = new Array(8).fill(0)
    private prgbanks = new Array(4).fill(0)
    private ramEnable = true
    private ramSelect = false
    private irqcounter = 0xffff
    private irqenabled = false
    private irqclock = false
    private hasInitSound = false
    private sndchip = new Sunsoft5BSoundChip()
    private interrupted = false

    public loadROM(): void {
        super.loadROM()
        this.prg_map = new Array(40).fill(0)
        for (let i = 1; i <= 40; ++i) {
            this.prg_map[40 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 0
        }
    }

    public cartRead(addr: number): number {
        if (addr >= 0x6000) {
            if (addr < 0x8000 && this.ramSelect) {
                if (this.ramEnable) {
                    return this.prgram[addr - 0x6000]
                }
                else {
                    return addr >> 8
                }
            }

            return this.prg[this.prg_map[addr - 0x6000 >> 10] + (addr & 1023)]
        }

        return addr >> 8
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        if (addr === 0x8000) {
            this.commandRegister = data & 0xf
        }
        else if (addr === 0xc000) {
            this.soundCommand = data & 0xf
            if (!this.hasInitSound) {
                this.cpuram?.apu?.addExpnSound(this.sndchip)
                this.hasInitSound = true
            }
        }
        else if (addr === 0xa000) {
            switch (this.commandRegister) {
                case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                    this.charbanks[this.commandRegister] = data
                    this.setbanks()
                    break
                case 8:
                    this.ramEnable = (data & Utils.BIT7) !== 0
                    this.ramSelect = (data & Utils.BIT6) !== 0
                    this.prgbanks[0] = data & 0x3f
                    this.setbanks()
                    break
                case 9: case 0xa: case 0xb:
                    this.prgbanks[this.commandRegister - 8] = data
                    this.setbanks()
                    break
                case 0xc:
                    switch (data & 3) {
                        case 0:
                            this.setmirroring(MirrorType.V_MIRROR)
                            break
                        case 1:
                            this.setmirroring(MirrorType.H_MIRROR)
                            break
                        case 2:
                            this.setmirroring(MirrorType.SS_MIRROR0)
                            break
                        case 3:
                            this.setmirroring(MirrorType.SS_MIRROR1)
                            break
                    }
                    break
                case 0xd:
                    this.irqclock = (data & Utils.BIT7) !== 0
                    this.irqenabled = (data & Utils.BIT0) !== 0
                    if (this.interrupted && this.cpu!.interrupt > 0) {
                        --this.cpu!.interrupt
                    }
                    this.interrupted = false
                    break
                case 0xe:
                    this.irqcounter &= 0xff00
                    this.irqcounter |= data
                    break
                case 0xf:
                    this.irqcounter &= 0xff
                    this.irqcounter |= data << 8
                    break
            }
        }
        else if (addr === 0xe000) {
            this.sndchip.write(this.soundCommand, data)
        }
    }

    public cpucycle(): void {
        if (this.irqclock) {
            if (this.irqcounter === 0) {
                this.irqcounter = 0xffff
                if (this.irqenabled && !this.interrupted) {
                    this.interrupted = true
                    ++this.cpu!.interrupt
                }
            }
            else {
                --this.irqcounter
            }
        }
    }

    private setbanks(): void {
        for (let i = 0; i < 8; ++i) {
            for (let j = 0; j < 4; ++j) {
                this.prg_map[i + 8 * j] = 1024 * (i + this.prgbanks[j] * 8) % this.prgsize
            }
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * this.charbanks[i] % this.chrsize
        }
    }
}
