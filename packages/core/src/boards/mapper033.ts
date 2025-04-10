import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper33 extends Mapper0 {
    private prgBank0: number = 0
    private prgBank1: number = 0
    private patch: number = 0
    private crc: number

    constructor(public nes: NES) {
        super(nes)
        this.crc = nes.rom.crc
        if (this.crc === 0x5e9bc161 // Akira(J)
            || this.crc === 0xecdbafa4 // Bakushou!! Jinsei Gekijou(J)
            || this.crc === 0x59cd0c31 // Don Doko Don(J)
            || this.crc === 0x837c1342 // Golf Ko Open(J)
            || this.crc === 0x42d893e4 // Operation Wolf(J)
            || this.crc === 0x1388aeb9 // Operation Wolf(U)
            || this.crc === 0x07ee6d8f // Power Blazer(J)
            || this.crc === 0x5193fb54 // Takeshi no Sengoku Fuuunji(J)
            || this.crc === 0xa71c3452) { // Insector X(J)
            this.patch = 1
        }
    }

    override write(address: number, value: number): void {
        if (address < 0x8000) {
            super.write(address, value)

            return
        }

        switch (address) {
            case 0x8000:

                // 设置镜像方式和PRG0 (8KB @ $8000)
                if (this.patch === 1) {
                    this.nes.ppu.setMirroring(value & 0x40 ? this.nes.rom.HORIZONTAL_MIRRORING : this.nes.rom.VERTICAL_MIRRORING)
                }
                this.prgBank0 = value & 0x1F // 低6位
                this.load8kRomBank(this.prgBank0, 0x8000)
                break
            case 0x8001:

                // 设置PRG1 (8KB @ $A000)
                this.prgBank1 = this.patch === 1 ? value & 0x1F : value
                this.load8kRomBank(this.prgBank1, 0xA000)
                break
            case 0x8002:

                // 设置CHR Reg0 (2KB @ $0000)
                this.load2kVromBank(value, 0x0000)
                break
            case 0x8003:

                // 设置CHR Reg1 (2KB @ $0800)
                this.load2kVromBank(value, 0x0800)
                break
            case 0xA000:

                // 设置CHR Reg2 (1KB @ $1000)
                this.load1kVromBank(value, 0x1000)
                break
            case 0xA001:

                // 设置CHR Reg3 (1KB @ $1400)
                this.load1kVromBank(value, 0x1400)
                break
            case 0xA002:

                // 设置CHR Reg4 (1KB @ $1800)
                this.load1kVromBank(value, 0x1800)
                break
            case 0xA003:

                // 设置CHR Reg5 (1KB @ $1C00)
                this.load1kVromBank(value, 0x1C00)
                break
            default:
                super.write(address, value)
                break
        }
    }

    override loadROM(): void {
        if (!this.nes.rom.valid) {
            throw new Error('Mapper33: Invalid ROM!')
        }

        // 加载固定的PRG banks到$C000和$E000（最后两个8KB banks）
        const prg8kCount = this.nes.rom.prgCount * 2
        this.load8kRomBank(prg8kCount - 2, 0xC000) // 倒数第二个
        this.load8kRomBank(prg8kCount - 1, 0xE000) // 最后一个

        // 初始化PRG0和PRG1为前两个8KB banks
        this.load8kRomBank(0, 0x8000)
        this.load8kRomBank(1, 0xA000)

        // 加载电池RAM（如果有）
        this.loadBatteryRam()

        // 触发重置中断
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

export { Mapper33 }
