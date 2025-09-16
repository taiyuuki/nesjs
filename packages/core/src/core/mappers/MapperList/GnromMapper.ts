import { Mapper } from '../Mapper'

export default class GnromMapper extends Mapper {

    override loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 1; i <= 8; ++i) {
            this.chr_map[8 - i] = this.chrsize - 1024 * i
        }
    }

    override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        const prgselect = data >> 4 & 3
        const chrselect = data & 3

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
