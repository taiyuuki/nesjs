import { MirrorType } from 'src/core/types'
import { Mapper } from '../Mapper'

export default class Mapper152 extends Mapper {
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
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        const prgselect = data >> 4 & 0xF
        const chrselect = data & 0xF

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * chrselect) & this.chrsize - 1
        }

        // remap PRG bank
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
        }
        this.setmirroring((data & 0x80) === 0 ? MirrorType.SS_MIRROR0 : MirrorType.SS_MIRROR1)
    }
    
}
