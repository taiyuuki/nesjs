import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class IremH3001Mapper extends Mapper {
    private chrbank = [0, 0, 0, 0, 0, 0, 0, 0]
    private irqctr = 0
    private irqreload = 0
    private irqenable = false
    private interrupted = false

    public loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xCFFF) {
            super.cartWrite(addr, data)

            return
        }
        if (addr >= 0x8000 && addr <= 0x8FFF) {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 1024 * (i + data * 8) & this.prgsize - 1
            }
        }
        else if (addr === 0x9001) {
            this.setmirroring((data & Utils.BIT7) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
        }
        else if (addr === 0x9003) {
            this.irqenable = (data & Utils.BIT7) !== 0
            if (this.interrupted) {
                --this.cpu!.interrupt
                this.interrupted = false
            }
        }
        else if (addr === 0x9004) {
            this.irqctr = this.irqreload
            if (this.interrupted) {
                --this.cpu!.interrupt
                this.interrupted = false
            }
        }
        else if (addr === 0x9005) {
            this.irqreload = this.irqreload & 0x00FF | data << 8
        }
        else if (addr === 0x9006) {
            this.irqreload = this.irqreload & 0xFF00 | data
        }
        else if (addr >= 0xA000 && addr <= 0xAFFF) {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 8] = 1024 * (i + data * 8) & this.prgsize - 1
            }
        }
        else if (addr >= 0xB000 && addr <= 0xBFFF) {
            this.chrbank[addr & 7] = data
            this.setppubank(1, addr & 7, this.chrbank[addr & 7])
        }
        else if (addr >= 0xC000 && addr <= 0xCFFF) {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 16] = 1024 * (i + data * 8) & this.prgsize - 1
            }
        }
    }

    public cpucycle(cycles: number): void {
        if (this.irqenable) {
            if (this.irqctr <= 0) {
                if (!this.interrupted) {
                    ++this.cpu!.interrupt
                    this.interrupted = true
                }
                this.irqenable = false
            }
            else {
                this.irqctr -= cycles
            }
        }
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) & this.chrsize - 1
        }
    }
}
