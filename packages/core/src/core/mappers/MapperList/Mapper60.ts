import { Mapper } from '../Mapper'

export default class Mapper60 extends Mapper {
    private reg = 0

    public loadROM(): void {
        super.loadROM()

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }

        // remap PRG bank
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i + 16] = 1024 * i & this.prgsize - 1
        }
    }

    public reset(): void {
        this.reg = this.reg + 1 & 3

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * this.reg) & this.chrsize - 1
        }

        // remap PRG bank
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * this.reg) & this.prgsize - 1
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i + 16] = 1024 * (i + 16 * this.reg) & this.prgsize - 1
        }
    }
}
