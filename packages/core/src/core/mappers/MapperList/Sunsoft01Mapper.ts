import { Mapper } from '../Mapper'

export default class Sunsoft01Mapper extends Mapper {
    private lowBank = 0
    private highBank = 0

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
            this.lowBank = data & 7
            this.highBank = data >> 4 & 7
            for (let i = 0; i < 4; ++i) {
                this.chr_map[i] = 1024 * (i + this.lowBank * 4) % this.chrsize
            }
            for (let i = 0; i < 4; ++i) {
                this.chr_map[4 + i] = 1024 * (i + this.highBank * 4) % this.chrsize
            }
        }
    }
}
