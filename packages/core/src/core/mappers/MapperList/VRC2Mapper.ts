import { MirrorType } from '../../types'
import { Mapper } from '../Mapper'

/**
 * VRC2 Mapper (INES #22) 
 * VRC2a mapper; VRC2b is mapped to 23 along with one form of VRC4
 */
export default class VRC2Mapper extends Mapper {
    private prgbank0 = 0
    private prgbank1 = 0
    private chrbank = [0, 0, 0, 0, 0, 0, 0, 0]

    public override loadROM(): void {
        super.loadROM()

        // Map last banks in to start off
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }

        const bit0 = (addr & 0x02) !== 0
        const bit1 = (addr & 0x01) !== 0

        switch (addr >> 12) {
            case 0x8:
                this.prgbank0 = data & 0xf
                break
            case 0x9:

                // Mirroring
                switch (data & 1) {
                    case 0:
                        this.setmirroring(MirrorType.V_MIRROR)
                        break
                    case 1:
                        this.setmirroring(MirrorType.H_MIRROR)
                        break
                }

                // VRC2 only has 1 mirroring bit
                break
            case 0xa:
                this.prgbank1 = data & 0xf
                break
            case 0xb:
            case 0xc:
            case 0xd:
            case 0xe:

                // CHR bank select. Black magic
                data &= 0xf
                const whichreg = (addr - 0xb000 >> 11) + (bit1 ? 1 : 0)
                let oldval = this.chrbank[whichreg]
                if (bit0) {
                    oldval &= 0xf
                    oldval |= data << 4
                }
                else {
                    oldval &= 0xf0
                    oldval |= data
                }
                this.chrbank[whichreg] = oldval
                break
        }

        if (addr < 0xf000) {
            this.setbanks()
        }
    }

    private setbanks(): void {

        // Map PRG banks
        // Last 2 banks fixed to last two in ROM
        for (let i = 1; i <= 16; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }

        // First bank set to prg0 register
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i] = 1024 * (i + 8 * this.prgbank0) % this.prgsize
        }

        // Second bank set to prg1 register
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i + 8] = 1024 * (i + 8 * this.prgbank1) % this.prgsize
        }

        // Map CHR banks
        for (let i = 0; i < 8; ++i) {
            this.setppubank(1, i, this.chrbank[i] >> 1)
        }
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }

    public override getMapperState(): any {
        const state = super.getMapperState()

        return {
            ...state,
            prgbank0: this.prgbank0,
            prgbank1: this.prgbank1,
            chrbank: [...this.chrbank],
        }
    }

    public override setMapperState(state: any): void {
        super.setMapperState(state)
        if (state.prgbank0 !== undefined) {
            this.prgbank0 = state.prgbank0
        }
        if (state.prgbank1 !== undefined) {
            this.prgbank1 = state.prgbank1
        }
        if (state.chrbank) {
            this.chrbank = [...state.chrbank]
        }
    }
}
