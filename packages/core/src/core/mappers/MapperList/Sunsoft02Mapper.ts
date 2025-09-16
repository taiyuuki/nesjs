import type { ROMLoader } from 'src/core/ROMLoader'
import { MirrorType } from 'src/core/types'
import { Mapper } from '../Mapper'

export default class Sunsoft02Mapper extends Mapper {
    private m93: boolean

    constructor(loader: ROMLoader) {
        super(loader)
        this.m93 = loader.mappertype === 93
    }

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
        let prgselect: number
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        if (this.m93) {
            prgselect = data >> 4 & 15
        }
        else {
            prgselect = data >> 4 & 7
            this.setmirroring((data & 0x08) === 0 ? MirrorType.SS_MIRROR0 : MirrorType.SS_MIRROR1)
            const chrselect = data & 7 | (data >> 7) * 8
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (i + 8 * chrselect) & this.chrsize - 1
            }
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
        }
    }
}
