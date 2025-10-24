import { Mapper } from '../Mapper'
import { MirrorType, Utils } from '@/core/types'

export default class Mapper62 extends Mapper {

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
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        const prg_mode = (addr & Utils.BIT5) !== 0
        const prgselect = addr & 0x40 | addr >> 8 & 0x3F
        const chrselect = addr << 2 | data & 3

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * chrselect) & this.chrsize - 1
        }

        // remap PRG bank
        if (prg_mode) {
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
            }
            for (let i = 0; i < 16; ++i) {
                this.prg_map[16 + i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
            }
        }
        else {
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + 32 * (prgselect >> 1)) & this.prgsize - 1
            }
        }

        this.setmirroring((addr & Utils.BIT7) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
    }
}
