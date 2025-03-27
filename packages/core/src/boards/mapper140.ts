import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper140 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    override write(address: number, value: number) {
        if (address < 0x6000 || address > 0x7fff) {
            super.write(address, value)

            return
        }
        else {

            // Swap in the given PRG-ROM bank at 0x8000:
            this.load32kRomBank(value >> 4 & 3, 0x8000)
      
            // Swap in the given VROM bank at 0x0000:
            this.load8kVromBank((value & 0xf) * 2, 0x0000)
        }
    }
}

export { Mapper140 }
