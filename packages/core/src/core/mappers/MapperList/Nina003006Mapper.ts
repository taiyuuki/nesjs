import type { ROMLoader } from '../../ROMLoader'
import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class Nina003006Mapper extends Mapper {
    private m113: boolean = true

    constructor(loader: ROMLoader) {
        super(loader)

        // mappers 79 and 113 differ mainly on whether they can control mirroring or not
        switch (loader.mappertype) {
            case 79:
                this.m113 = false
                break
            case 113:
                this.m113 = true
                break
        }
    }

    override loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    reset(): void {
        for (let i = 0x4100; i < 0x6000; i += 0x200) {
            this.cartWrite(i, i + 0xFF)
        }
    }

    cartWrite(addr: number, data: number): void {
        if (addr < 0x4100 || addr > 0x5fff) {
            super.cartWrite(addr, data)

            return
        }

        if (this.m113) {
            this.setmirroring((data & Utils.BIT7) === 0 ? MirrorType.H_MIRROR : MirrorType.V_MIRROR)

            // remap CHR bank
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (i + 8 * (data >> 3 & 8 | data & 7)) & this.chrsize - 1
            }

            // remap PRG bank
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + 32 * (data >> 3 & 7)) & this.prgsize - 1
            }
        }
        else {

            // remap CHR bank
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (i + 8 * data) & this.chrsize - 1
            }

            // remap PRG bank
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + 32 * (data >> 3)) & this.prgsize - 1
            }
        }
    }
}
