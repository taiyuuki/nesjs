import { Mapper } from '../Mapper'

export default class CrazyClimberMapper extends Mapper {
    public loadROM(): void {
        super.loadROM()

        // movable (second) bank; first one is fixed
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
        const bank = data & 7
        for (let i = 0; i < 16; ++i) {
            this.prg_map[16 + i] = 1024 * (i + 16 * bank) & this.prgsize - 1
        }
    }
}
