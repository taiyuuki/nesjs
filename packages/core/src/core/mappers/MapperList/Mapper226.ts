import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper226 extends Mapper {
    private reg: number[] = [0, 0]

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
        this.reg[addr & 1] = data
        let bank = this.reg[0] >> 1 & 0x0F | this.reg[0] >> 3 & 0x10 | this.reg[1] << 5 & 0x20
        this.setmirroring((this.reg[0] & 0x40) === 0 ? MirrorType.H_MIRROR : MirrorType.V_MIRROR)
        if ((this.reg[0] & 0x20) === 0) {
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + 32 * bank) & this.prgsize - 1
            }
        }
        else {
            bank = bank << 1 | this.reg[0] & 1
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i] = 1024 * (i + 16 * bank) & this.prgsize - 1
            }
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i + 16] = 1024 * (i + 16 * bank) & this.prgsize - 1
            }
        }
    }
}
