import { MirrorType, Utils } from 'src/core/types'
import { Mapper } from '../Mapper'

export default class Mapper112 extends Mapper {
    private whichbank = 0
    private chrreg = [0, 0, 0, 0, 0, 0, 0, 0]

    public loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 0
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        if (addr === 0xA000) {
            if (this.whichbank >= 2) {
                this.chrreg[this.whichbank - 2] = data
                this.setupchr()
            }
            else if (this.whichbank === 0) {
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i] = 1024 * (i + data * 8) % this.prgsize
                }
            }
            else if (this.whichbank === 1) {
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i + 8] = 1024 * (i + data * 8) % this.prgsize
                }
            }
        }
        else if (addr === 0x8000) {
            this.whichbank = data & 7
        }
        else if (addr === 0xE000) {
            this.setmirroring((data & Utils.BIT0) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
        }
    }

    private setupchr(): void {
        this.setppubank(1, 4, this.chrreg[2])
        this.setppubank(1, 5, this.chrreg[3])
        this.setppubank(1, 6, this.chrreg[4])
        this.setppubank(1, 7, this.chrreg[5])
        this.setppubank(2, 0, this.chrreg[0] >> 1 << 1)
        this.setppubank(2, 2, this.chrreg[1] >> 1 << 1)
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }
}
