import { MirrorType } from 'src/core/types'
import { Mapper } from '../Mapper'

export default class Mapper18 extends Mapper {
    reg = new Uint8Array(11)
    irqEnable = 0
    irqMode = 0
    irqCounter = 0xFFFF
    irqLatch = 0xFFFF

    override loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 11; ++i) {
            this.reg[i] = 0
        }

        this.reg[2] = this.getPROM8KSize() - 2
        this.reg[3] = this.getPROM8KSize() - 1

        this.setPROM32KBank4(0, 1, this.reg[2], this.reg[3])
    }

    override cartWrite(addr: number, data: number): void {
        switch (addr) {
            case 0x8000:
                this.reg[0] = this.reg[0] & 0xF0 | data & 0x0F
                this.setPROM8KBank(4, this.reg[0])
                break
            case 0x8001:
                this.reg[0] = this.reg[0] & 0x0F | (data & 0x0F) << 4
                this.setPROM8KBank(4, this.reg[0])
                break
            case 0x8002:
                this.reg[1] = this.reg[1] & 0xF0 | data & 0x0F
                this.setPROM8KBank(5, this.reg[1])
                break
            case 0x8003:
                this.reg[1] = this.reg[1] & 0x0F | (data & 0x0F) << 4
                this.setPROM8KBank(5, this.reg[1])
                break
            case 0x9000:
                this.reg[2] = this.reg[2] & 0xF0 | data & 0x0F
                this.setPROM8KBank(6, this.reg[2])
                break
            case 0x9001:
                this.reg[2] = this.reg[2] & 0x0F | (data & 0x0F) << 4
                this.setPROM8KBank(6, this.reg[2])
                break

            case 0xA000:
                this.reg[3] = this.reg[3] & 0xF0 | data & 0x0F
                this.setVROM1KBank(0, this.reg[3])
                break
            case 0xA001:
                this.reg[3] = this.reg[3] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(0, this.reg[3])
                break
            case 0xA002:
                this.reg[4] = this.reg[4] & 0xF0 | data & 0x0F
                this.setVROM1KBank(1, this.reg[4])
                break
            case 0xA003:
                this.reg[4] = this.reg[4] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(1, this.reg[4])
                break

            case 0xB000:
                this.reg[5] = this.reg[5] & 0xF0 | data & 0x0F
                this.setVROM1KBank(2, this.reg[5])
                break
            case 0xB001:
                this.reg[5] = this.reg[5] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(2, this.reg[5])
                break
            case 0xB002:
                this.reg[6] = this.reg[6] & 0xF0 | data & 0x0F
                this.setVROM1KBank(3, this.reg[6])
                break
            case 0xB003:
                this.reg[6] = this.reg[6] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(3, this.reg[6])
                break

            case 0xC000:
                this.reg[7] = this.reg[7] & 0xF0 | data & 0x0F
                this.setVROM1KBank(4, this.reg[7])
                break
            case 0xC001:
                this.reg[7] = this.reg[7] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(4, this.reg[7])
                break
            case 0xC002:
                this.reg[8] = this.reg[8] & 0xF0 | data & 0x0F
                this.setVROM1KBank(5, this.reg[8])
                break
            case 0xC003:
                this.reg[8] = this.reg[8] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(5, this.reg[8])
                break

            case 0xD000:
                this.reg[9] = this.reg[9] & 0xF0 | data & 0x0F
                this.setVROM1KBank(6, this.reg[9])
                break
            case 0xD001:
                this.reg[9] = this.reg[9] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(6, this.reg[9])
                break
            case 0xD002:
                this.reg[10] = this.reg[10] & 0xF0 | data & 0x0F
                this.setVROM1KBank(7, this.reg[10])
                break
            case 0xD003:
                this.reg[10] = this.reg[10] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(7, this.reg[10])
                break

            case 0xE000:
                this.irqLatch = this.irqLatch & 0xFFF0 | data & 0x0F
                break
            case 0xE001:
                this.irqLatch = this.irqLatch & 0xFF0F | (data & 0x0F) << 4
                break
            case 0xE002:
                this.irqLatch = this.irqLatch & 0xF0FF | (data & 0x0F) << 8
                break
            case 0xE003:
                this.irqLatch = this.irqLatch & 0x0FFF | (data & 0x0F) << 12
                break

            case 0xF000:

                this.irqCounter = this.irqLatch

                break
            case 0xF001:
                this.irqMode = data >> 1 & 0x07
                this.irqEnable = data & 0x01

                this.cpu!.interrupt = 0
                break

            case 0xF002:
                data &= 0x03
                if (data === 0) this.setmirroring(MirrorType.H_MIRROR)
                else if (data === 1) this.setmirroring(MirrorType.V_MIRROR)
                else this.setmirroring(MirrorType.FOUR_SCREEN_MIRROR)
                break
        }
    }

    override cpucycle(cycles: number): void {
        let bIQR = false
        const irqCounterOld = this.irqCounter

        if (this.irqEnable && this.irqCounter !== 0) {
            this.irqCounter -= cycles

            switch (this.irqMode) {
                case 0: // CPU cycles
                    bIQR = true
                    break
                case 1:
                    if ((this.irqCounter & 0xF000) !== (irqCounterOld & 0xF000)) {
                        bIQR = true
                    }
                    break
                case 2:
                case 3:
                    if ((this.irqCounter & 0xFF00) !== (irqCounterOld & 0xFF00)) {
                        bIQR = true
                    }
                    break
                case 4:
                case 5:
                case 6:
                case 7:
                    if ((this.irqCounter & 0xFFF0) !== (irqCounterOld & 0xFFF0)) {
                        bIQR = true
                    }
                    break
            }

            if (bIQR) {
                this.irqCounter = 0
                this.irqEnable = 0
                this.cpu!.interrupt++ // IRQ_MAPPER
            }
        }
    }
}
