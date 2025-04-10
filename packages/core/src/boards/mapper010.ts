import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper10 extends Mapper0 {

    latchLo: number = 0
    latchHi: number = 0
    latchLoVal1: number = 0
    latchLoVal2: number = 0
    latchHiVal1: number = 0
    latchHiVal2: number = 0

    constructor(nes: NES) {
        super(nes)
    }

    override write(address: number, value: number) {

        if (address < 0x8000) {

            // Handle normally.
            super.write(address, value)

        }
        else {

            // MMC4 write.

            value &= 0xFF
            switch (address >> 12) {
                case 0xA: {

                    // Select 8k ROM bank at 0x8000
                    this.loadRomBank(value, 0x8000)
                    break

                }
                case 0xB: {

                    // Select 4k VROM bank at 0x0000, $FD mode
                    this.latchLoVal1 = value
                    if (this.latchLo === 0xFD) {
                        this.loadVromBank(value, 0x0000)
                    }
                    break

                }
                case 0xC: {

                    // Select 4k VROM bank at 0x0000, $FE mode
                    this.latchLoVal2 = value
                    if (this.latchLo === 0xFE) {
                        this.loadVromBank(value, 0x0000)
                    }
                    break

                }
                case 0xD: {

                    // Select 4k VROM bank at 0x1000, $FD mode
                    this.latchHiVal1 = value
                    if (this.latchHi === 0xFD) {
                        this.loadVromBank(value, 0x1000)
                    }
                    break

                }
                case 0xE: {

                    // Select 4k VROM bank at 0x1000, $FE mode
                    this.latchHiVal2 = value
                    if (this.latchHi === 0xFE) {
                        this.loadVromBank(value, 0x1000)
                    }
                    break

                }
                case 0xF: {

                    // Select mirroring
                    if ((value & 0x1) === 0) {

                        // Vertical mirroring
                        this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING)

                    }
                    else {

                        // Horizontal mirroring
                        this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)

                    }
                    break

                }
            }

        }

    }

    loadROM() {

        if (!this.nes.rom.valid) {
            throw new Error('010: Invalid ROM! Unable to load.')

        }

        // Get number of 16K banks:
        const num_16k_banks = this.nes.rom.prgCount * 4

        // Load PRG-ROM:
        this.loadRomBank(0, 0x8000)
        this.loadRomBank(num_16k_banks - 1, 0xC000)

        // Load CHR-ROM:
        this.loadCHRROM()

        // Load Battery RAM (if present):
        this.loadBatteryRam()

        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }

    latchAccess(address: number) {

        const lo = address < 0x2000
        address &= 0x0FF0

        if (lo) {

            // Switch lo part of CHR
            if (address === 0xFD0) {

                // Set $FD mode
                this.latchLo = 0xFD
                this.loadVromBank(this.latchLoVal1, 0x0000)
            }
            else if (address === 0xFE0) {

                // Set $FE mode
                this.latchLo = 0xFE
                this.loadVromBank(this.latchLoVal2, 0x0000)
            }

        }
        else if (address === 0xFD0) {

            // Set $FD mode
            this.latchHi = 0xFD
            this.loadVromBank(this.latchHiVal1, 0x1000)

        }
        else if (address === 0xFE0) {

            // Set $FE mode
            this.latchHi = 0xFE
            this.loadVromBank(this.latchHiVal2, 0x1000)
        }

    }

    reset() {

        // Set latch to $FE mode:
        this.latchLo = 0xFE
        this.latchHi = 0xFE
        this.latchLoVal1 = 0
        this.latchLoVal2 = 4
        this.latchHiVal1 = 0
        this.latchHiVal2 = 0
    }
}

export { Mapper10 }
