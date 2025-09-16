import { Mapper } from '../Mapper'

export default class Mapper94 extends Mapper {
    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 1; i <= 16; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
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
        const prgselect = data >> 2 & 7
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
        }
    }
}
