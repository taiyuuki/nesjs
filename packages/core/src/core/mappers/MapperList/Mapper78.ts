import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper78 extends Mapper {
    public loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 1; i <= 8; ++i) {
            this.chr_map[8 - i] = this.chrsize - 1024 * i
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        const prgselect = data & 7
        const chrselect = data >> 4 & 0xf
        if (this.crc === 0x42392440) {
            this.setmirroring((data & 0x8) === 0 ? MirrorType.SS_MIRROR0 : MirrorType.SS_MIRROR1)
        }
        else {
            this.setmirroring((data & 0x8) === 0 ? MirrorType.H_MIRROR : MirrorType.V_MIRROR)
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * chrselect) & this.chrsize - 1
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
        }
    }
}
