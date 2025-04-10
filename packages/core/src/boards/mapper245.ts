import type { NES } from 'src/nes'
import { MMC3 } from './mapper004'

class Mapper245 extends MMC3 {
    reg0: number = 0
    reg3: number = 0
    prg0: number = 0
    prg1: number = 1
    irqLatch: number = 0
    irqRequest: boolean = false

    constructor(nes: NES) {
        super(nes)
    }

    override reset(): void {
        super.reset()
        this.reg0 = 0
        this.reg3 = 0
        this.prg0 = 0
        this.prg1 = 1
        this.irqCounter = 0
        this.irqLatch = 0
        this.irqEnable = 0
        this.irqRequest = false

        // Initialize PRG banks (last two banks in upper 512KiB)
        const lastBank = (this.nes.rom.prgCount - 1) * 2

        this.load8kRomBank(lastBank | this.reg3, 0xC000)
        this.load8kRomBank(lastBank + 1 | this.reg3, 0xE000)
        this.load8kRomBank(this.prg0 | this.reg3, 0x8000)
        this.load8kRomBank(this.prg1 | this.reg3, 0xA000)
        
    }

    override write(address: number, value: number): void {
        if (address < 0x8000) {
            super.write(address, value)

            return
        }

        switch (address) {
            case 0x8000:
                this.reg0 = value
                break
            case 0x8001:
                switch (this.reg0 & 0x07) {
                    case 0x00:

                        // Set upper PRG bits (A19) from bit 1 of value
                        this.reg3 = (value & 0x02) << 5
                        this.load8kRomBank(0x3E | this.reg3, 0xC000)
                        this.load8kRomBank(0x3F | this.reg3, 0xE000)
                        break
                    case 0x06:
                        this.prg0 = value
                        break
                    case 0x07:
                        this.prg1 = value
                        break
                }

                // Update active PRG banks with upper bits
                this.load8kRomBank(this.prg0 | this.reg3, 0x8000)
                this.load8kRomBank(this.prg1 | this.reg3, 0xA000)
                break
            case 0xA000:

                // Mirroring control
                if (!this.nes.rom.fourScreen) {
                    const mirroring = value & 0x01 
                        ? this.nes.rom.HORIZONTAL_MIRRORING 
                        : this.nes.rom.VERTICAL_MIRRORING
                    this.nes.ppu.setMirroring(mirroring)
                }
                break
            case 0xC000:
                this.irqCounter = value
                this.nes.cpu.irqRequested = false
                this.nes.cpu.irqType = null
                break
            case 0xC001:
                this.irqLatch = value
                this.nes.cpu.irqRequested = false
                this.nes.cpu.irqType = null
                break
            case 0xE000:
                this.irqEnable = 0
                this.nes.cpu.irqRequested = false
                this.nes.cpu.irqType = null
                break
            case 0xE001:
                this.irqEnable = 1
                this.nes.cpu.irqRequested = false
                this.nes.cpu.irqType = null
                break
            default:
                super.write(address, value)
        }
    }
}

export { Mapper245 }
