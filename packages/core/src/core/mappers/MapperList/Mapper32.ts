import { MirrorType } from '../../types'
import { Mapper } from '../Mapper'

const MAJOR_LEAGUE_CRC = 0xC0FED437

export default class Mapper32 extends Mapper {
    private control = 0
    private prgbanks = [0, 1]
    private chrbanks = [0, 1, 2, 3, 4, 5, 6, 7]
    private majorLeague = false

    public override loadROM(): void {
        super.loadROM()
        this.majorLeague = this.submapper === 1 || this.crc === MAJOR_LEAGUE_CRC
        this.reset()
    }

    public override reset(): void {
        this.control = 0
        this.prgbanks[0] = 0
        this.prgbanks[1] = this.getPROM8KSize() > 1 ? 1 : 0

        for (let i = 0; i < 8; ++i) {
            this.chrbanks[i] = i
        }

        if (this.majorLeague) {
            this.setmirroring(MirrorType.SS_MIRROR1)
        }
        else {
            this.setmirroring(this.scrolltype)
        }

        this.sync()
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xBFFF) {
            super.cartWrite(addr, data)

            return
        }

        switch (addr & 0xF000) {
            case 0x8000:
                this.prgbanks[0] = data
                break

            case 0x9000:
                if (!this.majorLeague) {
                    this.control = data & 0x03
                    this.setmirroring((data & 0x01) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
                }
                break

            case 0xA000:
                this.prgbanks[1] = data
                break

            case 0xB000:
                this.chrbanks[addr & 0x07] = data
                break
        }

        this.sync()
    }

    protected override postLoadState(_state: any): void {
        if (this.majorLeague) {
            this.setmirroring(MirrorType.SS_MIRROR1)
        }

        this.sync()
    }

    private sync(): void {
        const lastBank = Math.max(0, this.getPROM8KSize() - 1)
        const secondLastBank = Math.max(0, lastBank - 1)
        const prgMode = this.majorLeague ? 0 : this.control >> 1 & 0x01

        if (prgMode === 0) {
            this.setPROM32KBank4(this.prgbanks[0], this.prgbanks[1], secondLastBank, lastBank)
        }
        else {
            this.setPROM32KBank4(secondLastBank, this.prgbanks[1], this.prgbanks[0], lastBank)
        }

        for (let i = 0; i < 8; ++i) {
            this.setVROM1KBank(i, this.chrbanks[i])
        }
    }
}
