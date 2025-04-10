import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper2 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    override write(address: number, value: number) {
        if (address < 0x8000) {
            super.write(address, value)

            return
        }
        else {

            const bank = value
            this.loadRomBank(bank, 0x8000)
        }
    }

    override loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('UxROM: Invalid ROM! Unable to load.')
        }

        this.loadRomBank(0, 0x8000)
        this.loadRomBank(this.nes.rom.prgCount - 1, 0xC000)

        this.loadCHRROM()
        this.loadBatteryRam()
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

export { Mapper2 }
