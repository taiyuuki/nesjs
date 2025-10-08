import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class VRC1Mapper extends Mapper {
    private prgbank0 = 0
    private prgbank1 = 0
    private prgbank2 = 0
    private chrbank = [0, 0]

    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 24; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 1; i <= 8; ++i) {
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
        switch (addr >> 12) {
            case 0x8:
                this.prgbank0 = data & 0xf
                this.setbanks()
                break
            case 0x9:
                this.setmirroring((data & 0x1) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
                this.chrbank[0] = this.chrbank[0] & 0xf | data << 3 & 0x10
                this.chrbank[1] = this.chrbank[1] & 0xf | data << 2 & 0x10
                this.setbanks()
                break
            case 0xA:
                this.prgbank1 = data & 0xf
                this.setbanks()
                break
            case 0xC:
                this.prgbank2 = data & 0xf
                this.setbanks()
                break
            case 0xE:
                this.chrbank[0] = this.chrbank[0] & 0x10 | data & 0xf
                this.setbanks()
                break
            case 0xF:
                this.chrbank[1] = this.chrbank[1] & 0x10 | data & 0xf
                this.setbanks()
                break
        }
    }

    private setbanks(): void {
        for (let i = 1; i <= 8; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i] = 1024 * (i + 8 * this.prgbank0) % (this.prgsize - 1)
        }
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i + 8] = 1024 * (i + 8 * this.prgbank1) % (this.prgsize - 1)
        }
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i + 16] = 1024 * (i + 8 * this.prgbank2) % (this.prgsize - 1)
        }
        this.setppubank(4, 0, this.chrbank[0])
        this.setppubank(4, 4, this.chrbank[1])
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (i + 4 * banknum) % (this.chrsize - 1)
        }
    }
}
