import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper241 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number): void {
        if (address < 0x8000) {
            super.write(address, value)

            return
        }
        else {
            this.load32kRomBank(value, 0x8000)
        }
    }
}

export { Mapper241 }
