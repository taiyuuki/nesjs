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

            // 选择 PRG-ROM 银行
            const bank = value % this.nes.rom.romCount
            this.loadRomBank(bank, 0x8000)
            this.loadRomBank(this.nes.rom.romCount - 1, 0xC000)
        }
    }

    override loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('UxROM: Invalid ROM! Unable to load.')
        }

        // 加载第一个和最后一个 PRG-ROM 银行
        this.loadRomBank(0, 0x8000)
        this.loadRomBank(this.nes.rom.romCount - 1, 0xC000)

        // 加载 CHR-ROM
        this.loadCHRROM()

        // 加载电池 RAM（如果存在）
        this.loadBatteryRam()

        // 执行复位中断
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

export { Mapper2 }
