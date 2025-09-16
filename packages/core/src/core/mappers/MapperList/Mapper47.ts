import { MirrorType, Utils } from '../../types'
import MMC3Mapper from './MMC3Mapper'

export default class Mapper47 extends MMC3Mapper {
    private multibank = 1

    public loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 0
        }
        this.setbank6()
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x6000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }

        // multicart bankswitch
        if (addr >= 0x6000 && addr <= 0x7fff) {
            this.multibank = data & 1

            // setup all banks
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 8] = 1024 * (i + data * 8) % 131072 + this.multibank * 131072
            }
            this.setbank6()
            this.setupchr()
            for (let i = 1; i <= 8; ++i) {
                this.prg_map[32 - i] = 131072 - 1024 * i + this.multibank * 131072
            }
        }

        // even/odd register logic
        if ((addr & Utils.BIT0) === 0) {

            // even registers
            if (addr >= 0x8000 && addr <= 0x9fff) {

                // bank select
                this.whichbank = data & 7
                this.prgconfig = (data & Utils.BIT6) !== 0
                this.chrconfig = (data & Utils.BIT7) !== 0
                this.setupchr()
                this.setbank6()
            }
            else if (addr >= 0xA000 && addr <= 0xbfff) {

                // mirroring setup
                if (this.scrolltype !== MirrorType.FOUR_SCREEN_MIRROR) {
                    this.setmirroring((data & Utils.BIT0) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
                }
            }
            else if (addr >= 0xc000 && addr <= 0xdfff) {

                // reload IRQ counter value
                this.irqctrreload = data
            }
            else if (addr >= 0xe000 && addr <= 0xffff) {

                // disable IRQ and acknowledge
                if (this.interrupted) {
                    --this.cpu!.interrupt
                }
                this.interrupted = false
                this.irqenable = false
            }
        }

        // odd registers
        else if (addr >= 0x8000 && addr <= 0x9fff) {

            // bank change
            if (this.whichbank <= 5) {
                this.chrreg[this.whichbank] = data
                this.setupchr()
            }
            else if (this.whichbank === 6) {
                this.bank6 = data
                this.setbank6()
            }
            else if (this.whichbank === 7) {

                // bank 7 always swappable
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i + 8] = 1024 * (i + data * 8) % 131072 + this.multibank * 131072
                }
            }
        }
        else if (addr >= 0xA000 && addr <= 0xbfff) {

            // PRG RAM write protect (not implemented)
        }
        else if (addr >= 0xc000 && addr <= 0xdfff) {

            // reload IRQ counter
            this.irqreload = true
        }
        else if (addr >= 0xe000 && addr <= 0xffff) {

            // enable IRQ
            this.irqenable = true
        }
        
    }

    protected setbank6(): void {
        if (this.prgconfig) {

            // map 8000-9fff to last bank, c000-dfff to selected bank
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 131072 - 16384 + 1024 * (i + this.multibank * 128)
                this.prg_map[i + 16] = 1024 * (i + this.bank6 * 8) % 131072 + this.multibank * 131072
            }
        }
        else {

            // map c000-dfff to last bank, 8000-9fff to selected bank
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 1024 * (i + this.bank6 * 8) % 131072 + this.multibank * 131072
                this.prg_map[i + 16] = 131072 - 16384 + 1024 * (i + this.multibank * 128)
            }
        }
    }

    protected setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % (this.chrsize / 2) + this.multibank * 131072
        }
    }
}
