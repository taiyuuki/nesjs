import { Mapper } from '../Mapper'

export default class Mapper214 extends Mapper {
    public override loadROM(): void {
        super.loadROM()

        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xFFFF) {
            return super.cartWrite(addr, data)
        }

        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * addr) & this.chrsize - 1
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * (addr >> 2)) & this.prgsize - 1
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i + 16] = 1024 * (i + 16 * (addr >> 2)) & this.prgsize - 1
        }
    }
}
