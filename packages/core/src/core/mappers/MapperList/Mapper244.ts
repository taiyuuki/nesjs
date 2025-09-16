import { Mapper } from '../Mapper'

export default class Mapper244 extends Mapper {
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
        if (addr < 0x8065 || addr > 0x80E4) {
            super.cartWrite(addr, data)

            return
        }
        if (addr < 0x80A5) {
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + 32 * (addr - 0x8065 & 3)) & this.prgsize - 1
            }
        }
        else {
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (i + 8 * (addr - 0x80A5 & 7)) & this.chrsize - 1
            }
        }
    }
}
