import { Mapper } from '../Mapper'

export default class Mapper203 extends Mapper {
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
        return this.prg[this.prg_map[(addr & 0x3fff) >> 10] + (addr & 0x3fff & 1023)]
    }

    cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        const prgselect = data >> 2
        const chrselect = data & 3

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * chrselect) & this.chrsize - 1
        }

        // remap PRG bank
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
        }
    }
}
