import { MirrorType } from '../../types'
import { Mapper } from '../Mapper'

export default class Mapper80 extends Mapper {
    private chrBanks = [0, 2, 4, 5, 6, 7]
    private prgBanks = [0, 1, 2]
    private internalRamEnable = 0xFF
    private internalRam = new Uint8Array(0x80)

    public override loadROM(): void {
        super.loadROM()
        this.hasprgram = false
        this.reset()
    }

    public override reset(): void {
        this.chrBanks = [0, 2, 4, 5, 6, 7]
        this.prgBanks = [0, 1, 2]
        this.internalRamEnable = 0xFF
        this.internalRam.fill(0)
        this.setmirroring(this.scrolltype)
        this.sync()
    }

    public override cartRead(addr: number): number {
        if (addr >= 0x8000) {
            return this.prg[this.prg_map[(addr & 0x7FFF) >> 10] + (addr & 1023)]
        }

        if (addr >= 0x7F00 && addr <= 0x7FFF) {
            return this.internalRamEnable === 0xA3
                ? this.internalRam[addr & 0x7F]
                : 0xFF
        }

        return addr >> 8
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr >= 0x7F00 && addr <= 0x7FFF) {
            if (this.internalRamEnable === 0xA3) {
                this.internalRam[addr & 0x7F] = data
            }

            return
        }

        const reg = this.normalizeRegisterAddr(addr)
        if (reg === null) {
            return
        }

        switch (reg) {
            case 0x7EF0:
                this.chrBanks[0] = data
                break

            case 0x7EF1:
                this.chrBanks[1] = data
                break

            case 0x7EF2:
                this.chrBanks[2] = data
                break

            case 0x7EF3:
                this.chrBanks[3] = data
                break

            case 0x7EF4:
                this.chrBanks[4] = data
                break

            case 0x7EF5:
                this.chrBanks[5] = data
                break

            case 0x7EF6:
            case 0x7EF7:
                this.setmirroring((data & 0x01) === 0 ? MirrorType.H_MIRROR : MirrorType.V_MIRROR)
                break

            case 0x7EF8:
            case 0x7EF9:
                this.internalRamEnable = data

                return

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

    public override getPRGRam(): number[] {
        return Array.from(this.internalRam)
    }

    public override setPRGRAM(newprgram: number[]): void {
        this.internalRam.fill(0)
        this.internalRam.set(newprgram.slice(0, this.internalRam.length))
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
    }
}
