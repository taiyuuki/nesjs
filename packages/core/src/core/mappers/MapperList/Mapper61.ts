import { Mapper } from '../Mapper'
import { MirrorType, Utils } from '@/core/types'

export default class Mapper61 extends Mapper {
    private reg = 0

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

        switch (addr & 0x30) {
            case 0x00: case 0x30:
                for (let i = 0; i < 32; ++i) {
                    this.prg_map[i] = 1024 * (i + 32 * (addr & 0xF)) & this.prgsize - 1
                }
                break
            case 0x10: case 0x20:
                const prgselect = addr << 1 & 0x1E | addr >> 4 & 2
                for (let i = 0; i < 16; ++i) {
                    this.prg_map[i] = 1024 * (i + 32 * prgselect) & this.prgsize - 1
                }
                for (let i = 0; i < 16; ++i) {
                    this.prg_map[i + 16] = 1024 * (i + 32 * prgselect) & this.prgsize - 1
                }
        }

        this.setmirroring((addr & Utils.BIT7) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
    }
}
