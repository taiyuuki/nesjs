import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class Sunsoft03Mapper extends Mapper {
    private chrbank = [0, 0, 0, 0]
    private irqctr = 0
    private irqenable = false
    private interrupted = false
    private irqtoggle = false

    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 1; i <= 16; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr >= 0x8800 && addr <= 0x8FFF) {
            this.chrbank[0] = data
            this.setupchr()
        }
        else if (addr >= 0x9800 && addr <= 0x9FFF) {
            this.chrbank[1] = data
            this.setupchr()
        }
        else if (addr >= 0xA800 && addr <= 0xAFFF) {
            this.chrbank[2] = data
            this.setupchr()
        }
        else if (addr >= 0xB800 && addr <= 0xBFFF) {
            this.chrbank[3] = data
            this.setupchr()
        }
        else if (addr >= 0xC800 && addr <= 0xCFFF) {
            if (this.irqtoggle) {
                this.irqctr = this.irqctr & 0xFF00 | data & 0xFF
                this.irqtoggle = false
            }
            else {
                this.irqctr = this.irqctr & 0xFF | data << 8
                this.irqtoggle = true
            }
        }
        else if (addr >= 0xD800 && addr <= 0xDFFF) {
            if (this.interrupted) {
                --this.cpu!.interrupt
                this.interrupted = false
            }
            this.irqenable = (data & Utils.BIT4) !== 0
            this.irqtoggle = false
        }
        else if (addr >= 0xE800 && addr <= 0xEFFF) {
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
        }
        else if (addr >= 0xF800 && addr <= 0xFFFF) {
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i] = 1024 * (i + 16 * data) & this.prgsize - 1
            }
        }
    }

    public cpucycle(cycles: number): void {
        if (this.irqenable) {
            if (this.irqctr <= 0) {
                this.irqctr = 0xFFFF
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

    private setupchr(): void {
        this.setppubank(2, 0, this.chrbank[0])
        this.setppubank(2, 2, this.chrbank[1])
        this.setppubank(2, 4, this.chrbank[2])
        this.setppubank(2, 6, this.chrbank[3])
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (i + 2 * banknum) % this.chrsize
        }
    }
}
