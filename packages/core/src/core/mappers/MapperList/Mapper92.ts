import { Mapper } from '../Mapper'

export default class Mapper92 extends Mapper {
    public loadROM(): void {
        super.loadROM()
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
        if ((data & 0x40) !== 0) {
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (i + 8 * (data & 0xF)) & this.chrsize - 1
            }
        }
        if ((data & 0x80) !== 0) {
            for (let i = 0; i < 16; ++i) {
                this.prg_map[16 + i] = 1024 * (i + 16 * (data & 0xF)) & this.prgsize - 1
            }
        }
    }
}
