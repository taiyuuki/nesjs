import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class AfterburnerMapper extends Mapper {
    private bank = 0x0
    private useromnt = false
    private romnt1 = 0
    private romnt2 = 0

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
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        else if (addr <= 0x8fff) {
            this.setppubank(2, 0, data)
        }
        else if (addr <= 0x9fff) {
            this.setppubank(2, 2, data)
        }
        else if (addr <= 0xafff) {
            this.setppubank(2, 4, data)
        }
        else if (addr <= 0xbfff) {
            this.setppubank(2, 6, data)
        }
        else if (addr <= 0xcfff) {
            this.romnt1 = data | 0x80
        }
        else if (addr <= 0xdfff) {
            this.romnt2 = data | 0x80
        }
        else if (addr <= 0xefff) {
            this.useromnt = (data & Utils.BIT4) !== 0
            this.setmirroring((data & Utils.BIT0) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
        }
        else if (addr <= 0xffff) {
            this.bank = data & 0xf
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i] = 1024 * (i + 16 * this.bank) & this.prgsize - 1
            }
        }
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banksize * banknum + i) % this.chrsize
        }
    }

    public ppuRead(addr: number): number {
        if (addr < 0x2000) {
            return this.chr[this.chr_map[addr >> 10] + (addr & 1023)]
        }
        else {
            switch (addr & 0xc00) {
                case 0:
                    return this.useromnt ? this.chr[(addr & 0x3ff) + this.romnt1 * 1024] : this.nt0[addr & 0x3ff]
                case 0x400:
                    return this.useromnt ? this.chr[(addr & 0x3ff) + this.romnt2 * 1024] : this.nt1[addr & 0x3ff]
                case 0x800:
                    return this.useromnt ? this.chr[(addr & 0x3ff) + this.romnt2 * 1024] : this.nt2[addr & 0x3ff]
                case 0xc00:
                default:
                    if (addr >= 0x3f00) {
                        let palAddr = addr & 0x1f
                        if (palAddr >= 0x10 && (palAddr & 3) === 0) {
                            palAddr -= 0x10
                        }

                        return this.ppu!.pal[palAddr]
                    }
                    else {
                        return this.useromnt ? this.chr[(addr & 0x3ff) + this.romnt1 * 1024] : this.nt3[addr & 0x3ff]
                    }
            }
        }
    }
}
