import { Mapper } from '../Mapper'

/**
 * Mapper36 - NES Mapper，支持CHR/PRG bank切换
 */
export default class Mapper36 extends Mapper {
    public override loadROM(): void {
        super.loadROM()

        // PRG bank倒序映射
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }

        // CHR bank倒序映射
        for (let i = 1; i <= 8; ++i) {
            this.chr_map[8 - i] = this.chrsize - 1024 * i
        }
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr < 0x8400 || addr > 0xfffe) {
            super.cartWrite(addr, data)

            return
        }

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * data) & this.chrsize - 1
        }

        // remap PRG bank
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * (i + 32 * (data >> 4)) & this.prgsize - 1
        }
    }
}
