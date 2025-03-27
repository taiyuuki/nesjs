import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper34 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    override write(address: number, value: number) {
        if (address < 0x8000) {
            super.write(address, value)

            return
        }
        else {
            this.load32kRomBank(value, 0x8000)
        }
    }
}

export { Mapper34 }
