import { Mapper } from '../Mapper'

export default class Mapper213 extends Mapper {
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

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * (addr >> 3)) & this.chrsize - 1
        }

        // remap PRG bank
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * (i + 32 * (addr >> 1)) & this.prgsize - 1
        }
    }
}
