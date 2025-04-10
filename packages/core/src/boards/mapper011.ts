import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper11 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    override write(address: number, value: number) {
        if (address < 0x8000) {
            super.write(address, value)

            return
        }
        else {

            // Swap in the given PRG-ROM bank:
            const prgbank1 = (value & 0xf) * 2 % this.nes.rom.prgCount
            const prgbank2 = ((value & 0xf) * 2 + 1) % this.nes.rom.prgCount
      
            this.loadRomBank(prgbank1, 0x8000)
            this.loadRomBank(prgbank2, 0xc000)
      
            if (this.nes.rom.chrCount > 0) {

                // Swap in the given VROM bank at 0x0000:
                const bank = (value >> 4) * 2 % this.nes.rom.chrCount
                this.loadVromBank(bank, 0x0000)
                this.loadVromBank(bank + 1, 0x1000)
            }
        }
    }
}

export { Mapper11 }
