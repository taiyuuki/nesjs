import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper212 extends Mapper {
    loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 16; ++i) {
            this.prg_map[16 + i] = 1024 * i & this.prgsize - 1
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
        else if (addr >= 0x8000 && addr <= 0xbfff) {

            // remap PRG bank
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i] = 1024 * (i + 16 * addr) & this.prgsize - 1
            }
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i + 16] = 1024 * (i + 16 * addr) & this.prgsize - 1
            }
        }
        else if (addr >= 0xc000 && addr <= 0xffff) {

            // remap PRG bank
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + 32 * (addr >> 1)) & this.prgsize - 1
            }
        }

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * addr) & this.chrsize - 1
        }
        this.setmirroring((addr & 0x10) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
    }
}
