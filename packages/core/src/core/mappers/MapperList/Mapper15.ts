import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper15 extends Mapper {

    override loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        const prgbank = data << 1 & 0xFE
        const prgflip = data >> 7
        this.setmirroring(data & 0x40 ? MirrorType.H_MIRROR : MirrorType.V_MIRROR)
        switch (addr & 0xFFF) {
            case 0x000:
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i] = 1024 * (i + 8 * (prgbank | 0 ^ prgflip)) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[8 + i] = 1024 * (i + 8 * (prgbank | 1 ^ prgflip)) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[16 + i] = 1024 * (i + 8 * (prgbank | 2 ^ prgflip)) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[24 + i] = 1024 * (i + 8 * (prgbank | 3 ^ prgflip)) & this.prgsize - 1
                }
                break
            case 0x001:
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i] = 1024 * (i + 8 * (prgbank | 0 ^ prgflip)) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[8 + i] = 1024 * (i + 8 * (prgbank | 1 ^ prgflip)) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[16 + i] = 1024 * (i + 8 * (0x7E | 0 ^ prgflip)) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[24 + i] = 1024 * (i + 8 * (0x7F | 1 ^ prgflip)) & this.prgsize - 1
                }
                break
            case 0x002:
                const prgbank2 = prgbank | prgflip
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i] = 1024 * (i + 8 * prgbank2) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[8 + i] = 1024 * (i + 8 * prgbank2) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[16 + i] = 1024 * (i + 8 * prgbank2) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[24 + i] = 1024 * (i + 8 * prgbank2) & this.prgsize - 1
                }
                break
            case 0x003:
                const prgbank3 = prgbank | prgflip
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i] = 1024 * (i + 8 * prgbank3) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[8 + i] = 1024 * (i + 8 * (prgbank3 + 1)) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[16 + i] = 1024 * (i + 8 * (prgbank3 + (~addr >> 1 & 1))) & this.prgsize - 1
                }
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[24 + i] = 1024 * (i + 8 * (prgbank3 + 1)) & this.prgsize - 1
                }
                break
            default:
                break
        }
    }
}
