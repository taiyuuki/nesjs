import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper15 extends Mapper0 {

    constructor(nes: NES) {
        super(nes)
    }

    override write(address: number, value: number): void {
        if (address < 0x8000) {
            super.write(address, value)
        }
        else {
            switch (address) {
                case 0x8000:
                    if ((value & 0x80) === 0) {
                        this.load8kRomBank((value & 0x3F) * 2 + 0, 0x8000)
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0xA000)
                        this.load8kRomBank((value & 0x3F) * 2 + 2, 0xC000)
                        this.load8kRomBank((value & 0x3F) * 2 + 3, 0xE000)
                    }
                    else {
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0x8000)
                        this.load8kRomBank((value & 0x3F) * 2 + 0, 0xA000)
                        this.load8kRomBank((value & 0x3F) * 2 + 3, 0xC000)
                        this.load8kRomBank((value & 0x3F) * 2 + 2, 0xE000)
                    }
                    if ((value & 0x40) === 0) {
                        this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING)
                    }
                    else {
                        this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)
                    }
                    break
                case 0x8001:
                    if ((value & 0x80) === 0) {
                        this.load8kRomBank((value & 0x3F) * 2 + 0, 0xC000)
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0xE000)
                    }
                    else {
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0xC000)
                        this.load8kRomBank((value & 0x3F) * 2 + 0, 0xE000)
                    }
                    break
                case 0x8002:
                    if ((value & 0x80) === 0) {
                        this.load8kRomBank((value & 0x3F) * 2, 0x8000)
                        this.load8kRomBank((value & 0x3F) * 2, 0xA000)
                        this.load8kRomBank((value & 0x3F) * 2, 0xC000)
                        this.load8kRomBank((value & 0x3F) * 2, 0xE000)
                    }
                    else {
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0x8000)
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0xA000)
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0xC000)
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0xE000)
                    }
                    break
                case 0x8003:
                    if ((value & 0x80) === 0) {
                        this.load8kRomBank((value & 0x3F) * 2 + 0, 0xC000)
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0xE000)
                    }
                    else {
                        this.load8kRomBank((value & 0x3F) * 2 + 1, 0xC000)
                        this.load8kRomBank((value & 0x3F) * 2 + 0, 0xE000)
                    }
                    if ((value & 0x40) === 0) {
                        this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING)
                    }
                    else {
                        this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)
                    }
                    break
            }
        }
    }

    override loadROM(): void {
        if (!this.nes.rom.valid) {
            throw new Error('015: Invalid ROM! Unable to load.')
        }

        // Load PRG-ROM:
        this.load8kRomBank(0, 0x8000)
        this.load8kRomBank(1, 0xA000)
        this.load8kRomBank(2, 0xC000)
        this.load8kRomBank(3, 0xE000)

        // Load CHR-ROM:
        this.loadCHRROM()

        // Load Battery RAM (if present):
        this.loadBatteryRam()

        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

export { Mapper15 }
