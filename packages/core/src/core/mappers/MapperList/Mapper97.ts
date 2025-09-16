import { MirrorType } from 'src/core/types'
import { Mapper } from '../Mapper'

export default class Mapper97 extends Mapper {
    public loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 16; ++i) {
            this.prg_map[16 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[16 + i] = 1024 * i & this.prgsize - 1
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
        const prgselect = data & 0xF
        for (let i = 0; i < 16; ++i) {
            this.prg_map[16 + i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
        }
        const mirroring = data >> 6
        switch (mirroring) {
            case 0:
                this.setmirroring(MirrorType.SS_MIRROR0)
                break
            case 1:
                this.setmirroring(MirrorType.H_MIRROR)
                break
            case 2:
                this.setmirroring(MirrorType.V_MIRROR)
                break
            case 3:
                this.setmirroring(MirrorType.SS_MIRROR1)
                break
        }
    }
}
