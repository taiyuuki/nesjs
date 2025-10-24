import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

// Pirate MMC3 clone with scrambled registers
export default class Mapper182 extends Mapper {
    private whichbank: number = 0
    private prgconfig: boolean = false
    private chrconfig: boolean = false
    private irqctrreload: number = 0
    private irqctr: number = 0
    private irqenable: boolean = false
    private irqreload: boolean = false
    private bank6: number = 0
    private chrreg: number[] = [0, 0, 0, 0, 0, 0]
    private interrupted: boolean = false

    loadrom(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 0
        }
        this.setbank6()

        // this.cpuram?.setPrgRAMEnable(false)
    }

    cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }

        // bankswitches here
        // different register for even/odd writes
        if ((addr & 0x1) === 1) {

            // odd registers
            if (addr >= 0x8000 && addr <= 0x9fff) {

                // mirroring setup
                this.setmirroring((data & 0x1) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
            }
            else if (addr >= 0xa000 && addr <= 0xbfff) {

                // prg ram write protect
                // this.cpuram?.setPrgRAMEnable(!(data & 0x80))
            }
            else if (addr >= 0xc000 && addr <= 0xdfff) {

                // reloads irq counter @ end of scanline
                this.irqreload = true
                this.irqctrreload = data
            }
            else if (addr >= 0xe000 && addr <= 0xffff) {

                // enables interrupts
                this.irqenable = true
            }
        }
        else if (addr >= 0xa000 && addr <= 0xbfff) {

            // bank select
            this.whichbank = data & 7
            this.prgconfig = (data & 0x10) !== 0

            // if bit is false, 8000-9fff swappable and c000-dfff fixed to 2nd to last bank
            // if bit is true, c000-dfff swappable and 8000-9fff fixed to 2nd to last bank
            this.chrconfig = (data & 0x20) !== 0

            // if false: 2 2k banks @ 0000-0fff, 4 1k banks in 1000-1fff
            // if true: 4 1k banks @ 0000-0fff, 2 2k banks @ 1000-1fff
            this.setupchr()
            this.setbank6()
        }
        else if (addr >= 0xc000 && addr <= 0xdfff) {

            // bank select
            switch (this.whichbank) {
                case 0:
                    this.chrreg[0] = data
                    this.setupchr()
                    break
                case 1:
                    this.chrreg[3] = data
                    this.setupchr()
                    break
                case 2:
                    this.chrreg[1] = data
                    this.setupchr()
                    break
                case 3:
                    this.chrreg[5] = data
                    this.setupchr()
                    break
                case 4:
                    this.bank6 = data
                    this.setbank6()
                    break
                case 5:

                    // bank 5 always swappable, always in same place
                    for (let i = 0; i < 8; ++i) {
                        this.prg_map[i + 8] = 1024 * (i + data * 8) % this.prgsize
                    }
                    break
                case 6:
                    this.chrreg[2] = data
                    this.setupchr()
                    break
                case 7:
                    this.chrreg[4] = data
                    this.setupchr()
                    break
            }
        }
        else if (addr >= 0xe000 && addr <= 0xffff) {

            // disables IRQ and acknowledges
            if (this.interrupted && this.cpu) {
                --this.cpu.interrupt
            }
            this.interrupted = false
            this.irqenable = false
            this.irqctr = this.irqctrreload
        }
        
    }

    private setupchr(): void {
        if (this.chrconfig) {
            this.setppubank(1, 0, this.chrreg[2])
            this.setppubank(1, 1, this.chrreg[3])
            this.setppubank(1, 2, this.chrreg[4])
            this.setppubank(1, 3, this.chrreg[5])

            // Lowest bit of bank number IS IGNORED for the 2k banks
            this.setppubank(2, 4, this.chrreg[0] >> 1 << 1)
            this.setppubank(2, 6, this.chrreg[1] >> 1 << 1)
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

    private setbank6(): void {
        if (this.prgconfig) {

            // map 8000-9fff to last bank, c000-dfff to selected bank
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = this.prgsize - 16384 + 1024 * i
                this.prg_map[i + 16] = 1024 * (i + this.bank6 * 8) % this.prgsize
            }
        }
        else {

            // map c000-dfff to last bank, 8000-9fff to selected bank
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 1024 * (i + this.bank6 * 8) % this.prgsize
                this.prg_map[i + 16] = this.prgsize - 16384 + 1024 * i
            }
        }
    }

    notifyscanline(scanline: number): void {

        // Scanline counter
        if (scanline > 239 && scanline !== 261) {

            // clocked on LAST line of vblank and all lines of frame. Not on 240.
            return
        }
        if (!this.ppu?.mmc3CounterClocking()) {
            return
        }
        if (this.irqreload) {
            this.irqreload = false
            this.irqctr = this.irqctrreload
        }
        if (this.irqctr-- <= 0) {
            if (this.irqctrreload === 0) {
                return

                // irqs stop being generated if reload set to zero
            }
            if (this.irqenable && !this.interrupted && this.cpu) {
                ++this.cpu.interrupt
                this.interrupted = true
            }
            this.irqctr = this.irqctrreload
        }
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }
}
