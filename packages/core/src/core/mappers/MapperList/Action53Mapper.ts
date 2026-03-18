import { MirrorType } from '../../types'
import { Mapper } from '../Mapper'

export default class Mapper28 extends Mapper {
    private selectedRegister = 0
    private chrBank = 0
    private innerBank = 0
    private mode = 0
    private outerBank = 0

    private debugHex(value: number, width: number): string {
        return value.toString(16).toUpperCase()
            .padStart(width, '0')
    }

    private debugMirrorName(): string {
        switch (this.mode & 0x03) {
            case 0:
                return 'SS0'
            case 1:
                return 'SS1'
            case 2:
                return 'V'
            case 3:
            default:
                return 'H'
        }
    }

    public override loadROM(): void {
        super.loadROM()

        this.haschrram = true
        this.mode = this.getInitialModeFromHeader()

        if (this.chrsize < 32768) {
            const chr = new Array(32768).fill(0)
            chr.splice(0, this.chr.length, ...this.chr)
            this.chr = chr
            this.chrsize = 32768
        }

        this.reset()
    }

    public override reset(): void {
        this.outerBank = 0x3F
        this.innerBank = 0x0F
        this.sync()
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr >= 0x5000 && addr <= 0x5FFF) {
            this.selectedRegister = data & 0x81

            return
        }

        if (addr < 0x8000 || addr > 0xFFFF) {
            super.cartWrite(addr, data)

            return
        }

        switch (this.selectedRegister) {
            case 0x00:
                this.chrBank = data & 0x03
                this.updateMirroringBit(data)
                break

            case 0x01:
                this.innerBank = data & 0x0F
                this.updateMirroringBit(data)
                break

            case 0x80:
                this.mode = data & 0x3F
                this.syncMirroring()
                break

            case 0x81:
                this.outerBank = data & 0xFF
                break
        }

        this.sync()
    }

    protected override postLoadState(_state: any): void {
        this.sync()
    }

    private sync(): void {
        const outb = this.outerBank << 1
        const bankMask = Math.max(0, this.getPROM16KSize() - 1)
        let prgLo = 0
        let prgHi = 0

        switch (this.mode & 0x3C) {
            case 0x00:
            case 0x04:
                prgLo = outb
                prgHi = outb | 0x01
                break

            case 0x10:
            case 0x14:
                prgLo = outb & ~0x02 | this.innerBank << 1 & 0x02
                prgHi = prgLo | 0x01
                break

            case 0x20:
            case 0x24:
                prgLo = outb & ~0x06 | this.innerBank << 1 & 0x06
                prgHi = prgLo | 0x01
                break

            case 0x30:
            case 0x34:
                prgLo = outb & ~0x0E | this.innerBank << 1 & 0x0E
                prgHi = prgLo | 0x01
                break

            case 0x08:
                prgLo = outb
                prgHi = outb | this.innerBank & 0x01
                break

            case 0x18:
                prgLo = outb
                prgHi = outb & ~0x02 | this.innerBank & 0x03
                break

            case 0x28:
                prgLo = outb
                prgHi = outb & ~0x06 | this.innerBank & 0x07
                break

            case 0x38:
                prgLo = outb
                prgHi = outb & ~0x0E | this.innerBank & 0x0F
                break

            case 0x0C:
                prgLo = outb | this.innerBank & 0x01
                prgHi = outb | 0x01
                break

            case 0x1C:
                prgLo = outb & ~0x02 | this.innerBank & 0x03
                prgHi = outb | 0x01
                break

            case 0x2C:
                prgLo = outb & ~0x06 | this.innerBank & 0x07
                prgHi = outb | 0x01
                break

            case 0x3C:
                prgLo = outb & ~0x0E | this.innerBank & 0x0F
                prgHi = outb | 0x01
                break
        }

        this.setPROM16KBank(4, prgLo & bankMask)
        this.setPROM16KBank(6, prgHi & bankMask)
        this.setVROM8KBank(this.chrBank)
        this.syncMirroring()
    }

    private syncMirroring(): void {
        switch (this.mode & 0x03) {
            case 0:
                this.setmirroring(MirrorType.SS_MIRROR0)
                break

            case 1:
                this.setmirroring(MirrorType.SS_MIRROR1)
                break

            case 2:
                this.setmirroring(MirrorType.V_MIRROR)
                break

            case 3:
                this.setmirroring(MirrorType.H_MIRROR)
                break
        }
    }

    private updateMirroringBit(data: number): void {
        if ((this.mode & 0x02) !== 0) {
            return
        }

        this.mode = this.mode & ~0x01 | data >> 4 & 0x01
    }

    private getInitialModeFromHeader(): number {
        switch (this.scrolltype) {
            case MirrorType.V_MIRROR:
                return 0x02

            case MirrorType.H_MIRROR:
                return 0x03

            case MirrorType.SS_MIRROR1:
                return 0x01

            case MirrorType.SS_MIRROR0:
            case MirrorType.FOUR_SCREEN_MIRROR:
            default:
                return 0x00
        }
    }
}
