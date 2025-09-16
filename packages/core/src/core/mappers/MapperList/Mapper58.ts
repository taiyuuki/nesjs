import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class Mapper58 extends Mapper {
    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public reset(): void {
        this.cartWrite(0x8000, this.cartRead(0x8000))
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        this.setmirroring((addr & Utils.BIT7) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)

        // remap CHR bank
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * (i + 8 * (addr >> 3)) & this.chrsize - 1
        }
        let prgselect = addr & ~(~addr >> 6 & 1)

        // remap PRG bank
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
        }
        prgselect = addr | ~addr >> 6 & 1
        for (let i = 0; i < 16; ++i) {
            this.prg_map[16 + i] = 1024 * (i + 16 * prgselect) & this.prgsize - 1
        }
    }
}

