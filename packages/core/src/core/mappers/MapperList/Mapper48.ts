import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class Mapper48 extends Mapper {
    private prgbank0 = 0
    private prgbank1 = 0
    private chrbank = [0, 0, 0, 0, 0, 0]
    private irqctrreload = 0
    private irqctr = 0
    private irqenable = false
    private irqreload = false
    private interrupted = false

    public loadROM(): void {
        super.loadROM()

        // swappable bank
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }

        // fixed bank
        for (let i = 1; i <= 16; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xFFFF) {
            super.cartWrite(addr, data)

            return
        }
        else if (addr <= 0x9FFF) {
            switch (addr & 3) {
                case 0:
                    this.prgbank0 = data
                    this.setbanks()
                    break
                case 1:
                    this.prgbank1 = data
                    this.setbanks()
                    break
                case 2:
                    this.chrbank[0] = data
                    this.setbanks()
                    break
                case 3:
                    this.chrbank[1] = data
                    this.setbanks()
                    break
            }
        }
        else if (addr <= 0xBFFF) {
            switch (addr & 3) {
                case 0:
                    this.chrbank[2] = data
                    this.setbanks()
                    break
                case 1:
                    this.chrbank[3] = data
                    this.setbanks()
                    break
                case 2:
                    this.chrbank[4] = data
                    this.setbanks()
                    break
                case 3:
                    this.chrbank[5] = data
                    this.setbanks()
                    break
            }
        }
        else if (addr <= 0xDFFF) {
            switch (addr & 3) {
                case 0:
                    this.irqctrreload = data & 0xFF
                    this.irqreload = true
                    break
                case 1:
                    this.irqctr = data
                    this.irqreload = true
                    break
                case 2:
                    this.irqenable = true
                    break
                case 3:
                    if (this.interrupted) {
                        --this.cpu!.interrupt
                    }
                    this.interrupted = false
                    this.irqenable = false
                    this.irqctr = this.irqctrreload
                    break
            }
        }
        else if (addr <= 0xFFFF) {
            switch (addr & 3) {
                case 0:
                    this.setmirroring((data & Utils.BIT6) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
                    break
            }
        }
    }

    private setbanks(): void {

        // map prg banks
        for (let i = 1; i <= 16; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i] = 1024 * (i + 8 * this.prgbank0) & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i + 8] = 1024 * (i + 8 * this.prgbank1) & this.prgsize - 1
        }

        // map chr banks
        this.setppubank(1, 4, this.chrbank[2])
        this.setppubank(1, 5, this.chrbank[3])
        this.setppubank(1, 6, this.chrbank[4])
        this.setppubank(1, 7, this.chrbank[5])
        this.setppubank(2, 0, this.chrbank[0])
        this.setppubank(2, 2, this.chrbank[1])
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (i + banksize * banknum) & this.chrsize - 1
        }
    }

    public notifyscanline(scanline: number): void {

        // Scanline counter
        if (scanline > 239 && scanline !== 261) {
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
            }
            if (this.irqenable && !this.interrupted) {
                ++this.cpu!.interrupt
                this.interrupted = true
            }
            this.irqctr = this.irqctrreload
        }
    }
}
