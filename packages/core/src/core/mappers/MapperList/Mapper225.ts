import { Mapper } from '../Mapper'
import { MirrorType } from '../../types'

export default class Mapper225 extends Mapper {
    loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        this.setmirroring((addr & 0xD) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
        let bank = addr >> 7 & 0x1F
        if ((addr & 0x1000) === 0) {
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + 32 * bank) & this.prgsize - 1
            }
        }
        else {
            bank = bank << 1 | addr >> 6 & 1
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i] = 1024 * (i + 16 * bank) & this.prgsize - 1
            }
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i + 16] = 1024 * (i + 16 * bank) & this.prgsize - 1
            }
        }

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * addr) & this.chrsize - 1
        }
    }
}
