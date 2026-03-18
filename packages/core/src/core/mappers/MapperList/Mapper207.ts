import { MirrorType } from '../../types'
import { Mapper } from '../Mapper'

export default class Mapper207 extends Mapper {
    private chrBanks = [0, 2, 4, 5, 6, 7]
    private prgBanks = [0, 1, 2]
    private mirroringBits = new Array(8).fill(0)
    private lastPatternSlot = 0

    public override loadROM(): void {
        super.loadROM()
        this.hasprgram = false
        this.reset()
    }

    public override reset(): void {
        this.chrBanks = [0, 2, 4, 5, 6, 7]
        this.prgBanks = [0, 1, 2]
        this.mirroringBits.fill(0)
        this.lastPatternSlot = 0
        this.sync()
    }

    public override cartRead(addr: number): number {
        if (addr >= 0x8000) {
            return this.prg[this.prg_map[(addr & 0x7FFF) >> 10] + (addr & 1023)]
        }

        return addr >> 8
    }

    public override cartWrite(addr: number, data: number): void {
        const reg = this.normalizeRegisterAddr(addr)
        if (reg === null) {
            return
        }

        switch (reg) {
            case 0x7EF0:
                this.chrBanks[0] = data & 0x7F
                this.mirroringBits[0] = this.mirroringBits[1] = data >> 7 & 0x01
                break

            case 0x7EF1:
                this.chrBanks[1] = data & 0x7F
                this.mirroringBits[2] = this.mirroringBits[3] = data >> 7 & 0x01
                break

            case 0x7EF2:
                this.chrBanks[2] = data
                this.mirroringBits[4] = data >> 7 & 0x01
                break

            case 0x7EF3:
                this.chrBanks[3] = data
                this.mirroringBits[5] = data >> 7 & 0x01
                break

            case 0x7EF4:
                this.chrBanks[4] = data
                this.mirroringBits[6] = data >> 7 & 0x01
                break

            case 0x7EF5:
                this.chrBanks[5] = data
                this.mirroringBits[7] = data >> 7 & 0x01
                break

            case 0x7EFA:
            case 0x7EFB:
                this.prgBanks[0] = data
                break

            case 0x7EFC:
            case 0x7EFD:
                this.prgBanks[1] = data
                break

            case 0x7EFE:
            case 0x7EFF:
                this.prgBanks[2] = data
                break

            default:
                return
        }

        this.sync()
    }

    public override ppuRead(addr: number): number {
        this.updateMirroringFromPPUAddr(addr)

        return super.ppuRead(addr)
    }

    public override ppuWrite(addr: number, data: number): void {
        this.updateMirroringFromPPUAddr(addr)
        super.ppuWrite(addr, data)
    }

    protected override postLoadState(_state: any): void {
        this.sync()
    }

    private normalizeRegisterAddr(addr: number): number | null {
        if (addr >= 0x7EF0 && addr <= 0x7EFF) {
            return addr
        }

        if (addr >= 0x7E70 && addr <= 0x7E7F) {
            return 0x7EF0 | addr & 0x0F
        }

        return null
    }

    private sync(): void {
        this.setPROM8KBank(4, this.prgBanks[0])
        this.setPROM8KBank(5, this.prgBanks[1])
        this.setPROM8KBank(6, this.prgBanks[2])
        this.setPROM8KBank(7, Math.max(0, this.getPROM8KSize() - 1))

        this.setVROM2KBank(0, this.chrBanks[0] >> 1 & 0x3F)
        this.setVROM2KBank(2, this.chrBanks[1] >> 1 & 0x3F)
        this.setVROM1KBank(4, this.chrBanks[2])
        this.setVROM1KBank(5, this.chrBanks[3])
        this.setVROM1KBank(6, this.chrBanks[4])
        this.setVROM1KBank(7, this.chrBanks[5])
        this.applyMirroringForSlot(this.lastPatternSlot)
    }

    private updateMirroringFromPPUAddr(addr: number): void {
        if (addr < 0x2000) {
            this.lastPatternSlot = addr >> 10 & 0x07
            this.applyMirroringForSlot(this.lastPatternSlot)
        }
    }

    private applyMirroringForSlot(slot: number): void {
        const oneScreen = this.mirroringBits[slot & 0x07]
        this.setmirroring(oneScreen === 0 ? MirrorType.SS_MIRROR0 : MirrorType.SS_MIRROR1)
    }
}
