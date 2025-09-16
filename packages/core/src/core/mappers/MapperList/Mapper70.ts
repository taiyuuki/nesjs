import { Mapper } from '../Mapper'

export default class Mapper70 extends Mapper {
    private prgBank = 0
    private chrBank = 0

    public loadROM(): void {
        super.loadROM()

        // 默认 PRG/CHR bank 映射
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr >= 0x8000 && addr <= 0xFFFF) {
            this.prgBank = data & 0xF
            this.chrBank = data >> 4 & 0xF

            // 切换 PRG bank
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i] = 1024 * (i + 16 * this.prgBank) & this.prgsize - 1
            }

            // 切换 CHR bank
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (i + 8 * this.chrBank) & this.chrsize - 1
            }
        }
        else {
            super.cartWrite(addr, data)
        }
    }
}
