import { MirrorType } from '../../types'
import { Mapper } from '../Mapper'

export default class Mapper33 extends Mapper {
    private prgbank0 = 0
    private prgbank1 = 0
    private chrbank = [0, 0, 0, 0, 0, 0]

    override loadROM(): void {
        super.loadROM()

        // swappable bank
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }

        // fixed bank
        for (let i = 1; i <= 16; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xBFFF) {
            super.cartWrite(addr, data)
        }
        else if (addr <= 0x9FFF) {
            switch (addr & 3) {
                case 0:
                    this.prgbank0 = data
                    this.setmirroring(data & 0x40 ? MirrorType.H_MIRROR : MirrorType.V_MIRROR)
                    this.setbanks()
                    break
                case 1:
                    this.prgbank1 = data
                    this.setbanks()
                    break
                case 2:
                    this.chrbank[0] = data
                    this.setbanks()
                    break
                case 3:
                    this.chrbank[1] = data
                    this.setbanks()
                    break
            }
        }
        else if (addr <= 0xBFFF) {
            switch (addr & 3) {
                case 0:
                    this.chrbank[2] = data
                    this.setbanks()
                    break
                case 1:
                    this.chrbank[3] = data
                    this.setbanks()
                    break
                case 2:
                    this.chrbank[4] = data
                    this.setbanks()
                    break
                case 3:
                    this.chrbank[5] = data
                    this.setbanks()
                    break
            }
        }
    }

    private setbanks(): void {

        // map prg banks
        for (let i = 1; i <= 16; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }

        // first bank set to prg0 register
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i] = 1024 * (i + 8 * this.prgbank0) & this.prgsize - 1
        }

        // second bank set to prg1 register
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i + 8] = 1024 * (i + 8 * this.prgbank1) & this.prgsize - 1
        }

        // map chr banks
        this.setppubank(1, 4, this.chrbank[2])
        this.setppubank(1, 5, this.chrbank[3])
        this.setppubank(1, 6, this.chrbank[4])
        this.setppubank(1, 7, this.chrbank[5])
        this.setppubank(2, 0, this.chrbank[0])
        this.setppubank(2, 2, this.chrbank[1])
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (i + banksize * banknum) & this.chrsize - 1
        }
    }
}
