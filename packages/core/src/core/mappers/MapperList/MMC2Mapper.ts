import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class MMC2Mapper extends Mapper {
    private chrlatchL = true
    private chrlatchR = false
    private chrbankL1 = 0
    private chrbankR1 = 0
    private chrbankL2 = 0
    private chrbankR2 = 0

    override loadROM(): void {
        super.loadROM()

        // PRG bank: $8000-$FFFF 固定最后32KB
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }

        // CHR bank: 初始化为0
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 0
        }
    }

    override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        else if (addr >= 0xa000 && addr <= 0xafff) {

            // PRG bank切换
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 1024 * (i + 8 * (data & 0xf)) & this.chrsize - 1
            }
        }
        else if (addr >= 0xb000 && addr <= 0xbfff) {
            this.chrbankL1 = data & 0x1f
            this.setupPPUBanks()
        }
        else if (addr >= 0xc000 && addr <= 0xcfff) {
            this.chrbankL2 = data & 0x1f
            this.setupPPUBanks()
        }
        else if (addr >= 0xd000 && addr <= 0xdfff) {
            this.chrbankR1 = data & 0x1f
            this.setupPPUBanks()
        }
        else if (addr >= 0xe000 && addr <= 0xefff) {
            this.chrbankR2 = data & 0x1f
            this.setupPPUBanks()
        }
        else if (addr >= 0xf000 && addr <= 0xffff) {
            this.setmirroring(data & 0x1 ? MirrorType.H_MIRROR : MirrorType.V_MIRROR)
        }
    }

    override ppuRead(addr: number): number {
        const retval = super.ppuRead(addr)
        if ((addr & 0x8) !== 0) {

            // A3为1，表示pattern table第二次读
            switch (addr >> 4) {
                case 0xfd:
                    if ((addr & 3) === 0) {
                        this.chrlatchL = false
                        this.setupPPUBanks()
                    }
                    break
                case 0xfe:
                    if ((addr & 3) === 0) {
                        this.chrlatchL = true
                        this.setupPPUBanks()
                        break
                    }
                    break
                case 0x1fd:
                    this.chrlatchR = false
                    this.setupPPUBanks()
                    break
                case 0x1fe:
                    this.chrlatchR = true
                    this.setupPPUBanks()
                    break
                default:
                    break
            }
        }

        return retval
    }

    private setupPPUBanks(): void {
        if (this.chrlatchL) {
            this.setppubank(4, 0, this.chrbankL2)
        }
        else {
            this.setppubank(4, 0, this.chrbankL1)
        }
        if (this.chrlatchR) {
            this.setppubank(4, 4, this.chrbankR2)
        }
        else {
            this.setppubank(4, 4, this.chrbankR1)
        }
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banksize * banknum + i) % this.chrsize
        }
    }
}
