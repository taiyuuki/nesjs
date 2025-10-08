import { Mapper } from '../Mapper'
import { IRQMETHOD } from '@/interfaces'
import { MirrorType } from '@/types'

export default class Mapper245 extends Mapper {
    reg = new Uint8Array(8)
    prg0 = 0
    prg1 = 1
    we_sram = 0 // Disable
    irqEnable = 0 // Disable
    irqCounter = 0
    irqLatch = 0
    irqRequest = 0
    
    irqType = IRQMETHOD.IRQ_CLOCK

    override loadROM(): void {
        super.loadROM()

        for (let i = 0; i < 8; i++) {
            this.reg[i] = 0x00
        }
        const prom8kSize = this.getPROM8KSize()
        this.setPROM32KBank4(0, 1, prom8kSize - 2, prom8kSize - 1)

        if (this.getVROM1KSize() > 0) {
            this.setVROM8KBank(0)
        }
    }

    override cartWrite(addr: number, data: number): void {
        switch (addr & 0xF7FF) {
            case 0x8000:
                this.reg[0] = data

                return
            case 0x8001:
                this.reg[1] = data
                switch (this.reg[0]) {
                    case 0x00:
                        this.reg[3] = (data & 2) << 5
                        this.setPROM8KBank(6, 0x3E | this.reg[3])
                        this.setPROM8KBank(7, 0x3F | this.reg[3])
                        break
                    case 0x06:
                        this.prg0 = data
                        break
                    case 0x07:
                        this.prg1 = data
                        break
                }
                this.setPROM8KBank(4, this.prg0 | this.reg[3])
                this.setPROM8KBank(5, this.prg1 | this.reg[3])

                return
            case 0xA000:
                this.reg[2] = data
                if (this.scrolltype !== MirrorType.FOUR_SCREEN_MIRROR) {
                    if ((data & 0x01) === 0) { this.setmirroring(MirrorType.V_MIRROR) }
                    else { this.setmirroring(MirrorType.H_MIRROR) }
                }

                return
            case 0xA001:

                return
            case 0xC000:
                this.reg[4] = data
                this.irqCounter = data
                this.irqRequest = 0
                this.cpu!.interrupt = 0

                return
            case 0xC001:
                this.reg[5] = data
                this.irqLatch = data
                this.irqRequest = 0; this.cpu!.interrupt = 0

                return
            case 0xE000:
                this.reg[6] = data
                this.irqEnable = 0
                this.irqRequest = 0
                this.cpu!.interrupt = 0

                return
            case 0xE001:
                this.reg[7] = data
                this.irqEnable = 1
                this.irqRequest = 0
                this.cpu!.interrupt = 0

                return
        }
        super.cartWrite(addr, data)
    }

    override notifyscanline(scanline: number): void {
        if (scanline >= 0 && scanline <= 239) {
            if (this.ppu?.renderingOn()) {
                if (this.irqEnable !== 0 && this.irqRequest === 0) {
                    if (scanline === 0) {
                        if (this.irqCounter !== 0) {
                            this.irqCounter--
                        }
                    }
                    if (this.irqCounter-- === 0) {
                        this.irqRequest = 0xFF
                        this.irqCounter = this.irqLatch
                        if (this.cpu) {
                            this.cpu.interrupt++
                        }
                    }
                }
            }
        }
    }
}
