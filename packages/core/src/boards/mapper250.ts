import type { NES } from 'src/nes'
import { MMC3 } from './mapper004'

class Mapper250 extends MMC3 {
    constructor(public nes: NES) {
        super(nes)
    }

    override write(address: number, value: number) {
        if (address >= 0x8000) {
            const highBits = address & 0xE000
            if (highBits === 0x8000 || highBits === 0xA000 || highBits === 0xC000 || highBits === 0xE000) {
                const a10 = address >> 10 & 1 // Extract A10
                let regAddress: number

                // Translate to MMC3 register addresses based on high bits and A10
                switch (highBits) {
                    case 0x8000:
                        regAddress = a10 ? 0x8001 : 0x8000
                        break
                    case 0xA000:
                        regAddress = a10 ? 0xA001 : 0xA000
                        break
                    case 0xC000:
                        regAddress = a10 ? 0xC001 : 0xC000
                        break
                    case 0xE000:
                        regAddress = a10 ? 0xE001 : 0xE000
                        break
                    default:
                        return
                }

                // Use lower 8 bits of the address as the value
                const regValue = address & 0xFF
                super.write(regAddress, regValue)

                return
            }
        }

        // Handle non-register writes normally
        super.write(address, value)
    }
}

export { Mapper250 }
