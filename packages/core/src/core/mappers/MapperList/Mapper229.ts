import { Mapper } from '../Mapper'
import { MirrorType } from '../../types'

export default class Mapper229 extends Mapper {
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

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * addr) & this.chrsize - 1
        }

        // remap PRG bank
        let bank = (addr & 0x1E) === 0 ? 0 : addr & 0x1F
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * bank) & this.prgsize - 1
        }
        bank = (addr & 0x1E) === 0 ? 1 : addr & 0x1F
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i + 16] = 1024 * (i + 16 * bank) & this.prgsize - 1
        }
        this.setmirroring((addr & 0x20) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
    }
}
