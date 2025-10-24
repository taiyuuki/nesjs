import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper231 extends Mapper {
    loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        this.setmirroring((addr & 0x80) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
        const prg = addr & 0x1E

        // remap PRG bank
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * prg) & this.prgsize - 1
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i + 16] = 1024 * (i + 16 * (prg | addr >> 5 & 1)) & this.prgsize - 1
        }
    }
}
