import type { NES } from 'src/nes'
import { MMC3 } from './mapper004'

class Mapper115 extends MMC3 {
    private EXPREGS: number[] = new Array(3).fill(0)

    constructor(public nes: NES) {
        super(nes)
    }

    override write(address: number, value: number) {
        switch (address) {
            case 0x6000:
                this.EXPREGS[0] = value
                this.updateBanks()

                return
            case 0x6001:
                this.EXPREGS[1] = value
                this.nes.ppu.setChrBankOffset((value & 1) << 8)

                return
            case 0x5080:
                this.EXPREGS[2] = value

                return
        }

        super.write(address, value)
    }

    override load(address: number): number {
        if (address >= 0x5000 && address < 0x6000) {
            return this.EXPREGS[2]
        }

        return super.load(address)
    }

    updateBanks() {
        if (this.EXPREGS[0] & 0x80) {
            const prgBank = this.EXPREGS[0] & 0x0F
            if (this.EXPREGS[0] & 0x20) {
                this.load32kRomBank(prgBank >> 1, 0x8000)
            }
            else {
                this.loadRomBank(prgBank, 0x8000)
                this.loadRomBank(prgBank, 0xC000)
            }
        }
        else {
            this.load8kRomBank(this.getPrgValue(6), 0x8000)
            this.load8kRomBank(this.getPrgValue(7), 0xA000)
            this.load8kRomBank((this.nes.rom.romCount << 1) - 2, 0xC000)
            this.load8kRomBank((this.nes.rom.romCount << 1) - 1, 0xE000)
        }
    }

    override clockIrqCounter() {
        if (this.irqEnable) {
            if (this.irqLatchValue === 0) {
                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)

                return
            }
            if (--this.irqCounter < 0) {
                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)
                this.irqCounter = this.irqLatchValue
            }
        }
    }

    override reset() {
        super.reset()
        this.EXPREGS.fill(0)
        this.nes.ppu.setChrBankOffset(0)
    }
}

export { Mapper115 }
