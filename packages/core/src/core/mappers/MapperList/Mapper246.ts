import { Mapper } from '../Mapper'

export default class Mapper246 extends Mapper {
    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 24; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 1; i <= 8; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x6000 || addr > 0x67ff) {
            super.cartWrite(addr, data)

            return
        }
        switch (addr & 7) {
            case 0:
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i] = 1024 * (i + 8 * data) & this.prgsize - 1
                }
                break
            case 1:
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[8 + i] = 1024 * (i + 8 * data) & this.prgsize - 1
                }
                break
            case 2:
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[16 + i] = 1024 * (i + 8 * data) & this.prgsize - 1
                }
                break
            case 3:
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[24 + i] = 1024 * (i + 8 * data) & this.prgsize - 1
                }
                break
            case 4:
                for (let i = 0; i < 2; ++i) {
                    this.chr_map[i] = 1024 * (i + 2 * data) & this.chrsize - 1
                }
                break
            case 5:
                for (let i = 0; i < 2; ++i) {
                    this.chr_map[2 + i] = 1024 * (i + 2 * data) & this.chrsize - 1
                }
                break
            case 6:
                for (let i = 0; i < 2; ++i) {
                    this.chr_map[4 + i] = 1024 * (i + 2 * data) & this.chrsize - 1
                }
                break
            case 7:
                for (let i = 0; i < 2; ++i) {
                    this.chr_map[6 + i] = 1024 * (i + 2 * data) & this.chrsize - 1
                }
                break
        }
    }
}
