import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper200 extends Mapper {
    loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    cartRead(addr: number): number {
        if (addr < 0x4000) {
            return this.prg[this.prg_map[(addr & 0x3fff) >> 10] + (addr & 1023)]
        }
        else {
            return this.prg[this.prg_map[(addr & 0x3fff) >> 10] + (addr - 0x4000 & 1023)]
        }
    }

    cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        const reg = addr & 7
        this.setmirroring((data & 0x8) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * reg) & this.chrsize - 1
        }

        // remap PRG bank
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * reg) & this.prgsize - 1
        }
    }
}
