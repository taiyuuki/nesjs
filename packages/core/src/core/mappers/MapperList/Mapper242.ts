import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper242 extends Mapper {
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
        if (addr < 0x8000 || addr > 0xFFFF) {
            super.cartWrite(addr, data)

            return
        }
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * (i + 32 * (addr >> 3)) & this.prgsize - 1
        }
        this.setmirroring((addr & 0x02) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
    }
}
