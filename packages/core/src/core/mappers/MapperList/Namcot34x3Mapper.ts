import type { ROMLoader } from 'src/core/ROMLoader'
import { MirrorType } from 'src/core/types'
import { Mapper } from '../Mapper'

export default class Namcot34x3Mapper extends Mapper {
    private mirroring = false
    private whichbank = 0
    private chrreg = [0, 0, 0, 0, 0, 0]

    constructor(loader: ROMLoader) {
        super(loader)
        this.mirroring = loader.mappertype === 154
    }

    public loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 0
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        if (addr === 0x8001) {
            if (this.whichbank <= 5) {
                this.chrreg[this.whichbank] = data & 0x3f
                this.setupchr()
            }
            else if (this.whichbank === 6) {
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i] = 1024 * (i + data * 8) % this.prgsize
                }
            }
            else if (this.whichbank === 7) {
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i + 8] = 1024 * (i + data * 8) % this.prgsize
                }
            }
        }
        else if (addr === 0x8000) {
            this.whichbank = data & 7
        }
        if (this.mirroring) {
            this.setmirroring((data & 0x40) === 0 ? MirrorType.SS_MIRROR0 : MirrorType.SS_MIRROR1)
        }
    }

    private setupchr(): void {
        this.setppubank(1, 4, this.chrreg[2] | 0x40)
        this.setppubank(1, 5, this.chrreg[3] | 0x40)
        this.setppubank(1, 6, this.chrreg[4] | 0x40)
        this.setppubank(1, 7, this.chrreg[5] | 0x40)
        this.setppubank(2, 0, this.chrreg[0] >> 1 << 1)
        this.setppubank(2, 2, this.chrreg[1] >> 1 << 1)
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }
}
