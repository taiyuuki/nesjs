import { Mapper } from '../Mapper'
import { MirrorType, Utils } from '@/core/types'

export default class AnromMapper extends Mapper {

    override loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    override cartWrite(addr: number, data: number) {
        if (addr < 0x8000 || addr > 0xFFFF) {
            super.cartWrite(addr, data)

            return
        }
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * (i + 32 * (data & 15)) & this.prgsize - 1
        }
        this.setmirroring((data & Utils.BIT4) === 0 ? MirrorType.SS_MIRROR0 : MirrorType.SS_MIRROR1)

    }
}
