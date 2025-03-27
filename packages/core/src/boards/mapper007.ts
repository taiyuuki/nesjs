import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper7 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    override write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            super.write(address, value)
        }
        else {
            this.load32kRomBank(value & 0x7, 0x8000)
            if (value & 0x10) {
                this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING2)
            }
            else {
                this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING)
            }
        }
    }

    override loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('AOROM: Invalid ROM! Unable to load.')
        }
      
        // Load PRG-ROM:
        this.loadPRGROM()
      
        // Load CHR-ROM:
        this.loadCHRROM()
      
        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

export { Mapper7 }
