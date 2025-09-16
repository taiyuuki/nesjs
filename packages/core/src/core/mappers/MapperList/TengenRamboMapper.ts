import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class TengenRamboMapper extends Mapper {
    private whichbank = 0
    private prgconfig = false
    private chrconfig = false
    private chrmode1k = false
    private irqmode = false
    private irqctrreload = 0
    private irqctr = 0
    private irqenable = false
    private irqreload = false
    private prgreg0 = 0
    private prgreg1 = 0
    private prgreg2 = 0
    private chrreg = new Array(8).fill(0)
    private interrupted = false
    private remainder = 0
    private intnextcycle = false

    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i] = 1024 * i
            this.prg_map[i + 8] = 1024 * i
        }
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 0
        }
        this.setprgregs()
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        if ((addr & Utils.BIT0) === 0) {

            // even registers
            if (addr >= 0x8000 && addr <= 0x9fff) {
                this.whichbank = data & 0xf
                this.chrmode1k = (data & Utils.BIT5) !== 0
                this.prgconfig = (data & Utils.BIT6) !== 0
                this.chrconfig = (data & Utils.BIT7) !== 0
                this.setupchr()
                this.setprgregs()
            }
            else if (addr >= 0xA000 && addr <= 0xbfff) {
                if (this.scrolltype !== MirrorType.FOUR_SCREEN_MIRROR) {
                    this.setmirroring((data & Utils.BIT0) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
                }
            }
            else if (addr >= 0xc000 && addr <= 0xdfff) {
                this.irqctrreload = data
                this.irqreload = true
            }
            else if (addr >= 0xe000 && addr <= 0xffff) {
                if (this.interrupted) {
                    --this.cpu!.interrupt
                }
                this.interrupted = false
                this.irqenable = false
                this.irqctr = this.irqctrreload
            }
        }
        else if (addr >= 0x8000 && addr <= 0x9fff) {
            switch (this.whichbank) {
                case 0: case 1: case 2: case 3: case 4: case 5:
                    this.chrreg[this.whichbank] = data
                    this.setupchr()
                    break
                case 6:
                    this.prgreg0 = data
                    this.setprgregs()
                    break
                case 7:
                    this.prgreg1 = data
                    this.setprgregs()
                    break
                case 8: case 9:
                    this.chrreg[this.whichbank - 2] = data
                    break
                case 0xf:
                    this.prgreg2 = data
                    this.setprgregs()
                    break
            }
        }
        else if (addr >= 0xA000 && addr <= 0xbfff) {

            // PRG RAM write protect (not implemented)
        }
        else if (addr >= 0xc000 && addr <= 0xdfff) {
            this.irqreload = true
            this.irqmode = (data & Utils.BIT0) !== 0
        }
        else if (addr >= 0xe000 && addr <= 0xffff) {
            this.irqenable = true
        }
        
    }

    private setupchr(): void {
        if (this.chrconfig) {
            if (this.chrmode1k) {
                this.setppubank(1, 0, this.chrreg[2])
                this.setppubank(1, 1, this.chrreg[3])
                this.setppubank(1, 2, this.chrreg[4])
                this.setppubank(1, 3, this.chrreg[5])
                this.setppubank(1, 4, this.chrreg[0])
                this.setppubank(1, 5, this.chrreg[6])
                this.setppubank(1, 6, this.chrreg[1])
                this.setppubank(1, 7, this.chrreg[7])
            }
            else {
                this.setppubank(1, 0, this.chrreg[2])
                this.setppubank(1, 1, this.chrreg[3])
                this.setppubank(1, 2, this.chrreg[4])
                this.setppubank(1, 3, this.chrreg[5])
                this.setppubank(2, 4, this.chrreg[0] >> 1 << 1)
                this.setppubank(2, 6, this.chrreg[1] >> 1 << 1)
            }
        }
        else if (this.chrmode1k) {
            this.setppubank(1, 0, this.chrreg[0])
            this.setppubank(1, 1, this.chrreg[6])
            this.setppubank(1, 2, this.chrreg[1])
            this.setppubank(1, 3, this.chrreg[7])
            this.setppubank(1, 4, this.chrreg[2])
            this.setppubank(1, 5, this.chrreg[3])
            this.setppubank(1, 6, this.chrreg[4])
            this.setppubank(1, 7, this.chrreg[5])
        }
        else {
            this.setppubank(1, 4, this.chrreg[2])
            this.setppubank(1, 5, this.chrreg[3])
            this.setppubank(1, 6, this.chrreg[4])
            this.setppubank(1, 7, this.chrreg[5])
            this.setppubank(2, 0, this.chrreg[0] >> 1 << 1)
            this.setppubank(2, 2, this.chrreg[1] >> 1 << 1)
        }
    }

    private setprgregs(): void {
        if (this.prgconfig) {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 1024 * (i + this.prgreg2 * 8) % this.prgsize
                this.prg_map[i + 8] = 1024 * (i + this.prgreg0 * 8) % this.prgsize
                this.prg_map[i + 16] = 1024 * (i + this.prgreg1 * 8) % this.prgsize
            }
        }
        else {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 1024 * (i + this.prgreg0 * 8) % this.prgsize
                this.prg_map[i + 8] = 1024 * (i + this.prgreg1 * 8) % this.prgsize
                this.prg_map[i + 16] = 1024 * (i + this.prgreg2 * 8) % this.prgsize
            }
        }
    }

    public notifyscanline(scanline: number): void {
        if (this.irqmode) return
        if (scanline > 239 && scanline !== 261) return
        if (!this.ppu?.mmc3CounterClocking()) return
        this.clockscanlinecounter()
    }

    public cpucycle(cycles: number): void {
        if (this.intnextcycle) {
            this.intnextcycle = false
            if (!this.interrupted) {
                ++this.cpu!.interrupt
                this.interrupted = true
            }
        }
        if (!this.irqmode) return
        this.remainder += cycles
        for (let i = 0; i < this.remainder; ++i) {
            if ((i & 3) === 0) {
                this.clockscanlinecounter()
            }
        }
        this.remainder %= 4
    }

    public clockscanlinecounter(): void {
        if (this.irqreload) {
            this.irqreload = false
            this.irqctr = this.irqctrreload + 1
        }
        else if (this.irqctr === 0) {
            this.irqctr = this.irqctrreload
        }
        else if (--this.irqctr === 0 && this.irqenable) {
            this.intnextcycle = true
        }
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }
}
