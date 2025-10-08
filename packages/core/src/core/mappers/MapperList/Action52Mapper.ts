import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Action52Mapper extends Mapper {
    private ram: number[] = [0, 0, 0, 0]
    private prgchip = 0
    private prgpage = 0
    private chrpage = 0
    private prgmode = false

    loadROM(): void {
        super.loadROM()
        this.cartWrite(0x8000, 0)
    }

    cartWrite(addr: number, data: number): void {
        if (addr <= 0x5fff) {
            this.ram[addr & 3] = data & 0xf
        }
        else if (addr >= 0x8000) {
            this.chrpage = ((addr & 0xf) << 2) + (data & 3)
            this.prgmode = (addr & 0x20) !== 0
            this.prgpage = addr >> 6 & 0x1f
            this.prgchip = addr >> 11 & 3
            this.setmirroring((addr & 0x2000) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (this.chrpage * 8 + i) % this.chrsize
            }
            let off = 0
            switch (this.prgchip) {
                case 0:
                    off = 0
                    break
                case 1:
                    off = 0x080000
                    break
                case 3:
                    off = 0x100000
                    break
                default:

                    // Who knows
                    break
            }
            if (this.prgmode) {
                for (let i = 0; i < 16; ++i) {
                    this.prg_map[i] = (1024 * (16 * this.prgpage + i) + off) % this.prgsize
                    this.prg_map[i + 16] = (1024 * (16 * this.prgpage + i) + off) % this.prgsize
                }
            }
            else {
                for (let i = 0; i < 32; ++i) {
                    this.prg_map[i] = (1024 * (32 * (this.prgpage >> 1) + i) + off) % this.prgsize
                }
            }
        }
    }

    cartRead(addr: number): number {
        if (addr >= 0x8000) {
            return this.prg[this.prg_map[(addr & 0x7fff) >> 10] + (addr & 1023)]
        }
        else if (addr < 0x6000) {
            return this.ram[addr & 3] & 0xf
        }

        return addr >> 8 // open bus
    }

    reset(): void {
        this.cartWrite(0x8000, 0)
    }
}
