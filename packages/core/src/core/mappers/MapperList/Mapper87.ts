import { Mapper } from '../Mapper'

export default class Mapper87 extends Mapper {
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
        if (addr >= 0x6000 && addr < 0x8000) {
            const bit0 = data >> 1 & 1
            const bit1 = data & 1
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (i + 8 * ((bit1 << 1) + bit0)) & this.chrsize - 1
            }
        }
        else {
            super.cartWrite(addr, data)
        }
    }
}
