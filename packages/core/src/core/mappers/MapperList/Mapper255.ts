import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper255 extends Mapper {
    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
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
        const mode = ~addr >> 12 & 1
        const bank = addr >> 8 & 0x40 | addr >> 6 & 0x3F
        this.setmirroring((addr & 0x2000) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * (addr >> 8 & 0x40 | addr & 0x3F)) & this.chrsize - 1
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * (bank & ~mode)) & this.prgsize - 1
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[16 + i] = 1024 * (i + 16 * (bank | mode)) & this.prgsize - 1
        }
    }
}
