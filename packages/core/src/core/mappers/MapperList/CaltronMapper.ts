import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class CaltronMapper extends Mapper {
    private reg = 0

    public override loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr >= 0x6000 && addr <= 0x67FF) {
            this.reg = addr & 0xFF

            // remap PRG bank
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + 32 * (addr & 7)) & this.prgsize - 1
            }
            this.setmirroring((addr & 0x20) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
        }
        else if (addr >= 0x8000 && addr <= 0xFFFF && (this.reg & 4) !== 0) {

            // remap CHR bank
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (i + 8 * (this.reg >> 1 & 0xC | data & 3)) & this.chrsize - 1
            }
        }
    }
}
