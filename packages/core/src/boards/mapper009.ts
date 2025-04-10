import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

// class Mapper9 extends Mapper0 {
//     latchLo = 0xFE
//     latchHi = 0xFE
//     latchLoVal1 = 0
//     latchLoVal2 = 4
//     latchHiVal1 = 0
//     latchHiVal2 = 0

//     constructor(public nes: NES) {
//         super(nes)
//     }

//     override reset() {
//         super.reset()
//         this.latchLo = 0xFE
//         this.latchHi = 0xFE
//         this.latchLoVal1 = 0
//         this.latchLoVal2 = 4
//         this.latchHiVal1 = 0
//         this.latchHiVal2 = 0
//     }

//     override loadCHRROM() {
//         this.latchLo = 0xFE
//         this.latchHi = 0xFE
//         this.loadVromBank(this.latchLoVal1, 0x0000)
//         this.loadVromBank(this.latchHiVal1, 0x1000)
//     }

//     override write(address: number, value: number) {

//         if (address < 0x8000) {

//             // Handle normally.
//             super.write(address, value)
//         }
//         else {

//             // MMC2 write.

//             value &= 0xFF
//             address &= 0xF000
//             switch (address >> 12) {
//                 case 0xA: {

//                     // Select 8k ROM bank at 0x8000
//                     this.load8kRomBank(value, 0x8000)

//                     break
//                 }
//                 case 0xB: {

//                     // Select 4k VROM bank at 0x0000, $FD mode
//                     this.latchLoVal1 = value

//                     if (this.latchLo === 0xFD) {
//                         this.loadVromBank(value, 0x0000)
//                     }
                    
//                     break
//                 }
//                 case 0xC: {

//                     // Select 4k VROM bank at 0x0000, $FE mode
//                     this.latchLoVal2 = value

//                     if (this.latchLo === 0xFE) {
//                         this.loadVromBank(value, 0x0000)
//                     }

//                     break
//                 }
//                 case 0xD: {

//                     // Select 4k VROM bank at 0x1000, $FD mode
//                     this.latchHiVal1 = value

//                     if (this.latchHi === 0xFD) {
//                         this.loadVromBank(value, 0x1000)
//                     }

//                     break
//                 }
//                 case 0xE: {

//                     // Select 4k VROM bank at 0x1000, $FE mode
//                     this.latchHiVal2 = value

//                     if (this.latchHi === 0xFE) {
//                         this.loadVromBank(value, 0x1000)
//                     }

//                     break
//                 }
//                 case 0xF: {
//                     const mirroring = value & 0x1
//                     this.nes.ppu.setMirroring(mirroring 
//                         ? this.nes.rom.HORIZONTAL_MIRRORING 
//                         : this.nes.rom.VERTICAL_MIRRORING)

//                     break
//                 }
//             }
//         }
//     }

//     override loadROM() {

//         if (!this.nes.rom.valid) {
//             throw new Error('AOROM: Invalid ROM! Unable to load.')
//         }

//         // Get number of 8K banks:
//         const num_8k_banks = this.nes.rom.romCount * 2

//         // Load PRG-ROM:
//         this.load8kRomBank(0, 0x8000)
//         this.load8kRomBank(num_8k_banks - 3, 0xA000)
//         this.load8kRomBank(num_8k_banks - 2, 0xC000)
//         this.load8kRomBank(num_8k_banks - 1, 0xE000)

//         // Load CHR-ROM:
//         this.loadCHRROM()

//         // Load Battery RAM (if present):
//         this.loadBatteryRam()

//         // Do Reset-Interrupt:
//         this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)

//     }

//     override latchAccess(address: number) {
//         const addr = address & 0x1FFF

//         // Latch0
//         if (addr === 0x0FD8 && this.latchLo !== 0xFD) {
//             this.loadVromBank(this.latchLoVal1, 0x0000)
//             this.latchLo = 0xFD
//         }
//         else if (addr === 0x0FE8 && this.latchLo !== 0xFE) {
//             this.loadVromBank(this.latchLoVal2, 0x0000)
//             this.latchLo = 0xFE
//         }

//         // Latch1
//         else if (addr >= 0x1FD8 && addr <= 0x1FDF && this.latchHi !== 0xFD) {
//             this.loadVromBank(this.latchHiVal1, 0x1000)
//             this.latchHi = 0xFD
//         }
//         else if (addr >= 0x1FE8 && addr <= 0x1FEF && this.latchHi !== 0xFE) {
//             this.loadVromBank(this.latchHiVal2, 0x1000)
//             this.latchHi = 0xFE
//         }
//     }
// }

class Mapper9 extends Mapper0 {
    latchLo = 0xFE
    latchHi = 0xFE
    latchLoVal1 = 0
    latchLoVal2 = 4
    latchHiVal1 = 0
    latchHiVal2 = 0

    constructor(public nes: NES) {
        super(nes)
    }

    override reset() {
        super.reset()
        this.latchLo = 0xFE
        this.latchHi = 0xFE
        this.latchLoVal1 = 0
        this.latchLoVal2 = 4
        this.latchHiVal1 = 0
        this.latchHiVal2 = 0
    }

    override loadCHRROM() {
        this.latchLo = 0xFE
        this.latchHi = 0xFE
        this.loadVromBank(this.latchLoVal1, 0x0000)
        this.loadVromBank(this.latchHiVal1, 0x1000)
    }

    override write(address: number, value: number) {

        if (address < 0x8000) {

            // Handle normally.
            super.write(address, value)
        }
        else {

            // MMC2 write.

            value &= 0xFF
            address &= 0xF000
            switch (address >> 12) {
                case 0xA: {

                    // Select 8k ROM bank at 0x8000
                    this.load8kRomBank(value, 0x8000)

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
                    const mirroring = value & 0x1
                    this.nes.ppu.setMirroring(mirroring 
                        ? this.nes.rom.HORIZONTAL_MIRRORING 
                        : this.nes.rom.VERTICAL_MIRRORING)

                    break
                }
            }
        }
    }

    override loadROM() {

        if (!this.nes.rom.valid) {
            throw new Error('AOROM: Invalid ROM! Unable to load.')
        }

        // Get number of 8K banks:
        const num_8k_banks = this.nes.rom.prgCount * 2

        // Load PRG-ROM:
        this.load8kRomBank(0, 0x8000)
        this.load8kRomBank(num_8k_banks - 3, 0xA000)
        this.load8kRomBank(num_8k_banks - 2, 0xC000)
        this.load8kRomBank(num_8k_banks - 1, 0xE000)

        // Load CHR-ROM:
        this.loadCHRROM()

        // Load Battery RAM (if present):
        this.loadBatteryRam()

        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)

    }

    override latchAccess(address: number) {
        const addr = address & 0x1FFF

        // Latch0
        if (addr === 0x0FD8 && this.latchLo !== 0xFD) {
            this.loadVromBank(this.latchLoVal1, 0x0000)
            this.latchLo = 0xFD
        }
        else if (addr === 0x0FE8 && this.latchLo !== 0xFE) {
            this.loadVromBank(this.latchLoVal2, 0x0000)
            this.latchLo = 0xFE
        }

        // Latch1
        else if (addr >= 0x1FD8 && addr <= 0x1FDF && this.latchHi !== 0xFD) {
            this.loadVromBank(this.latchHiVal1, 0x1000)
            this.latchHi = 0xFD
        }
        else if (addr >= 0x1FE8 && addr <= 0x1FEF && this.latchHi !== 0xFE) {
            this.loadVromBank(this.latchHiVal2, 0x1000)
            this.latchHi = 0xFE
        }
    }
}

export { Mapper9 }
