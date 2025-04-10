import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper48 extends Mapper0 {
    private irqCounter: number = 0
    private irqReload: number = 0
    private irqEnabled: boolean = false
    private irqDelay: number = 0
    private mirroring: number = 0

    constructor(public nes: NES) {
        super(nes)
    }

    override write(address: number, value: number): void {
        if (address < 0x8000) {
            super.write(address, value)

            return
        }

        const maskedAddr = address & 0xE003

        switch (maskedAddr) {

            // PRG 设置
            case 0x8000:
                this.load8kRomBank(value & 0x3F, 0x8000)
                break
            case 0x8001:
                this.load8kRomBank(value & 0x3F, 0xA000)
                break

            // CHR 设置（2KB banks）
            case 0x8002:
                this.load2kVromBank(value, 0x0000)
                break
            case 0x8003:
                this.load2kVromBank(value, 0x0800)
                break

            // CHR 设置（1KB banks）
            case 0xA000:
                this.load1kVromBank(value, 0x1000)
                break
            case 0xA001:
                this.load1kVromBank(value, 0x1400)
                break
            case 0xA002:
                this.load1kVromBank(value, 0x1800)
                break
            case 0xA003:
                this.load1kVromBank(value, 0x1C00)
                break

            // IRQ 控制
            case 0xC000:
                this.irqReload = value ^ 0xFF // 异或处理（文档要求）
                break
            case 0xC001:
                this.irqCounter = this.irqReload
                break
            case 0xC002:
                this.irqEnabled = true
                break
            case 0xC003:
                this.irqEnabled = false

                // 清除当前中断请求
                this.nes.cpu.irqRequested = false
                this.nes.cpu.irqType = null
                break

            // 镜像设置
            case 0xE000:
                this.mirroring = value & 0x80
                this.nes.ppu.setMirroring(this.mirroring ? this.nes.rom.HORIZONTAL_MIRRORING : this.nes.rom.VERTICAL_MIRRORING)
                break

            default:
                super.write(address, value)
        }
    }

    override clockIrqCounter(cycles: number): void {
        if (this.irqDelay > 0) {
            this.irqDelay -= cycles
            if (this.irqDelay === 0 && this.irqEnabled) {
                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)
            }
        }

        if (this.irqEnabled && this.irqCounter > 0) {
            this.irqCounter--
            if (this.irqCounter === 0) {
                this.irqCounter = this.irqReload
                this.irqDelay = 4 // 4周期延迟（文档要求）
            }
        }
    }

    override loadROM(): void {
        if (!this.nes.rom.valid) {
            throw new Error('Mapper48: Invalid ROM!')
        }

        // 加载固定PRG banks（最后两个8KB banks）
        const prg8kCount = this.nes.rom.prgCount * 2
        this.load8kRomBank(prg8kCount - 2, 0xC000)
        this.load8kRomBank(prg8kCount - 1, 0xE000)

        // 初始化可切换PRG banks
        this.load8kRomBank(0, 0x8000)
        this.load8kRomBank(1, 0xA000)

        // 加载CHR-ROM和电池RAM
        this.loadCHRROM()
        this.loadBatteryRam()

        // 触发重置中断
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

export { Mapper48 }
