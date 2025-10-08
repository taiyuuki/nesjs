import type { ROMLoader } from '../../ROMLoader'
import { Mapper } from '../Mapper'

export default class Mapper34 extends Mapper {
    hasCHR: boolean

    constructor(loader: ROMLoader) {
        super(loader)
        this.hasCHR = loader.chrsize > 0
    }
    
    override loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; i++) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }

        for (let i = 0; i < 8; i++) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    override cartWrite(addr: number, data: number): void {
        if (this.hasCHR) {
            if (addr < 0x7ffd || addr > 0x7fff) {
                super.cartWrite(addr, data)

                return
            }

            switch (addr) {
                case 0x7FFD:
                    for (let i = 0; i < 32; ++i) {
                        this.prg_map[i] = 1024 * (i + 32 * data) & this.prgsize - 1
                    }
                    break
                case 0x7FFE:
                    for (let i = 0; i < 4; ++i) {
                        this.chr_map[i] = 1024 * (i + 4 * data) & this.chrsize - 1
                    }
                    break
                case 0x7FFF:
                    for (let i = 0; i < 4; ++i) {
                        this.chr_map[4 + i] = 1024 * (i + 4 * data) & this.chrsize - 1
                    }
                    break
            }
        }
        else {
            if (addr < 0x8000 || addr > 0xffff) {
                super.cartWrite(addr, data)

                return
            }

            const bankstart = 32 * (data & 15)
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + bankstart) & this.prgsize - 1
            }
        }
    }
}
