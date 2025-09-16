import { Mapper } from '../Mapper'

export default class Mapper240 extends Mapper {
    
    override loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    override cartWrite(addr: number, data: number): void {
        if (addr < 0x4020 || addr > 0x5fff) {
            super.cartWrite(addr, data)

            return
        }
        const prgselect = data >> 4 & 0xF
        const chrselect = data & 0xF

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * chrselect) & this.chrsize - 1
        }

        // remap PRG bank
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * (i + 32 * prgselect) & this.prgsize - 1
        }
    }
}
