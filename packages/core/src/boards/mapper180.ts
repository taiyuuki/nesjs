import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper180 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    override write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            super.write(address, value)

            return
        }
        else {

            // This is a ROM bank select command.
            // Swap in the given ROM bank at 0xc000:
            this.loadRomBank(value, 0xc000)
        }
    }

    override loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('Mapper 180: Invalid ROM! Unable to load.')
        }
      
        // Load PRG-ROM:
        this.loadRomBank(0, 0x8000)
        this.loadRomBank(this.nes.rom.prgCount - 1, 0xc000)
      
        // Load CHR-ROM:
        this.loadCHRROM()
      
        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

export { Mapper180 }
