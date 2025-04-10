import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper18 extends Mapper0 {

    private prgBanks: number[] = new Array(11).fill(0)
    private irqLatch: number = 0
    private irqCounter: number = 0
    private irqEnabled: boolean = false
    private irqSizeMode: number = 0
    private prgRamEnabled: boolean = false
    private prgRamWriteable: boolean = false

    constructor(public nes: NES) {
        super(nes)
        this.reset()
    }

    reset() {
        this.prgBanks.fill(0)
        this.prgBanks[0] = 0 // $8000
        this.prgBanks[1] = 1 // $A000
        this.prgBanks[2] = 2 // $C000
        this.prgBanks[3] = this.nes.rom.prgCount * 2 - 1 // $E000
    
        // IRQ Settings
        this.irqEnabled = false
        this.irqLatch = 0
        this.irqCounter = 0
        this.irqSizeMode = 0
        this.prgRamEnabled = false
        this.prgRamWriteable = false

        super.reset()
    }

    override write(address: number, value: number): void {

        if (address < 0x8000) {

            if (address >= 0x6000 && address < 0x8000) {
                if (this.prgRamEnabled && this.prgRamWriteable) {
                    super.write(address, value)

                    if (this.nes.opts.onBatteryRamWrite) {
                        this.nes.opts.onBatteryRamWrite(address, value)
                    }
                }

                return
            }
            super.write(address, value)

            return
        }

        const addrRegion = address & 0xF003

        // const bank = address >> 12 & 0x7 // 0x8000-0xFFFF → 0-7

        switch (addrRegion) {
            case 0x8000:
                this.prgBanks[0] = this.prgBanks[0] & 0xF0 | value & 0x0F
                this.load8kRomBank(this.prgBanks[0], 0x8000)
                break

            case 0x8001:
                this.prgBanks[0] = this.prgBanks[0] & 0x0F | (value & 0x03) << 4
                this.load8kRomBank(this.prgBanks[0], 0x8000)
                break

            case 0x8002:
                this.prgBanks[1] = this.prgBanks[1] & 0xF0 | value & 0x0F
                this.load8kRomBank(this.prgBanks[1], 0xA000)
                break

            case 0x8003:
                this.prgBanks[1] = this.prgBanks[1] & 0x0F | (value & 0x0F) << 4
                this.load8kRomBank(this.prgBanks[1], 0xA000)
                break

            case 0x9000:
                this.prgBanks[2] = this.prgBanks[2] & 0xF0 | value & 0x0F
                this.load8kRomBank(this.prgBanks[2], 0xC000)
                break

            case 0x9001:
                this.prgBanks[2] = this.prgBanks[2] & 0x0F | (value & 0x0F) << 4
                this.load8kRomBank(this.prgBanks[2], 0xC000)
                break

            case 0x9002:
                this.prgRamEnabled = (value & 0x01) !== 0 // bit0: Enable
                this.prgRamWriteable = (value & 0x02) !== 0 // bit1: Write protect
                break

            case 0xA000:
                this.prgBanks[3] = this.prgBanks[3] & 0xF0 | value & 0x0F
                this.load1kVromBank(this.prgBanks[3], 0x0000)
                break

            case 0xA001:
                this.prgBanks[3] = this.prgBanks[3] & 0x0F | (value & 0x0F) << 4
                this.load1kVromBank(this.prgBanks[3], 0x0000)
                break

            case 0xA002:
                this.prgBanks[4] = this.prgBanks[4] & 0xF0 | value & 0x0F

                this.load1kVromBank(this.prgBanks[4], 0x0400)
                break

            case 0xA003:
                this.prgBanks[4] = this.prgBanks[4] & 0x0F | (value & 0x0F) << 4
                this.load1kVromBank(this.prgBanks[4], 0x0400)
                break

            case 0xB000:
                this.prgBanks[5] = this.prgBanks[5] & 0xF0 | value & 0x0F
                this.load1kVromBank(this.prgBanks[5], 0x0800)
                break

            case 0xB001:
                this.prgBanks[5] = this.prgBanks[5] & 0x0F | (value & 0x0F) << 4
                this.load1kVromBank(this.prgBanks[5], 0x0800)
                break

            case 0xB002:
                this.prgBanks[6] = this.prgBanks[6] & 0xF0 | value & 0x0F
                this.load1kVromBank(this.prgBanks[6], 0x0C00)
                break

            case 0xB003:
                this.prgBanks[6] = this.prgBanks[6] & 0x0F | (value & 0x0F) << 4
                this.load1kVromBank(this.prgBanks[6], 0x0C00)
                break

            case 0xC000:
                this.prgBanks[7] = this.prgBanks[7] & 0xF0 | value & 0x0F
                this.load1kVromBank(this.prgBanks[7], 0x1000)
                break

            case 0xC001:
                this.prgBanks[7] = this.prgBanks[7] & 0x0F | (value & 0x0F) << 4
                this.load1kVromBank(this.prgBanks[7], 0x1000)
                break

            case 0xC002:
                this.prgBanks[8] = this.prgBanks[8] & 0xF0 | value & 0x0F
                this.load1kVromBank(this.prgBanks[8], 0x1400)
                break

            case 0xC003:
                this.prgBanks[8] = this.prgBanks[8] & 0x0F | (value & 0x0F) << 4
                this.load1kVromBank(this.prgBanks[8], 0x1400)
                break

            case 0xD000:
                this.prgBanks[9] = this.prgBanks[9] & 0xF0 | value & 0x0F
                this.load1kVromBank(this.prgBanks[9], 0x1800)
                break

            case 0xD001:
                this.prgBanks[9] = this.prgBanks[9] & 0x0F | (value & 0x0F) << 4
                this.load1kVromBank(this.prgBanks[9], 0x1800)
                break

            case 0xD002:
                this.prgBanks[10] = this.prgBanks[10] & 0xF0 | value & 0x0F
                this.load1kVromBank(this.prgBanks[10], 0x1C00)
                break

            case 0xD003:
                this.prgBanks[10] = this.prgBanks[10] & 0x0F | (value & 0x0F) << 4
                this.load1kVromBank(this.prgBanks[10], 0x1C00)
                break

            case 0xE000: case 0xE001: case 0xE002: case 0xE003:
                const shift = (address & 0x3) * 4
                this.irqLatch = this.irqLatch & ~(0xF << shift) | (value & 0xF) << shift
                break

            case 0xF000:
                this.irqCounter = this.irqLatch
                this.nes.cpu.irqRequested = false
                this.nes.cpu.irqType = null
                break

            case 0xF001:
                this.irqSizeMode = value >> 2 & 0x7
                this.irqEnabled = (value & 0x01) !== 0
                this.nes.cpu.irqRequested = false
                this.nes.cpu.irqType = null
                break

            case 0xF002:
                switch (value & 0x03) {
                    case 0: this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING); break
                    case 1: this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING); break
                    case 2: this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING); break
                    case 3: this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING2); break
                }
                break

            default:
                super.write(address, value)
        }
    }

    private updatePrgBanks(): void {

        // 8K banks for $8000, $A000, $C000
        this.load8kRomBank(this.prgBanks[0], 0x8000)
        this.load8kRomBank(this.prgBanks[1], 0xA000)
        this.load8kRomBank(this.prgBanks[2], 0xC000)

        // Fixed last bank at $E000
        this.load8kRomBank(this.nes.rom.prgCount * 2 - 1, 0xE000)
    }

    override clockIrqCounter(cycles: number): void {
        if (!this.irqEnabled) return
    
        this.irqCounter -= cycles
        const mask = this.getIrqMask()
        if ((this.irqCounter & mask) === 0) {
            this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)
            this.irqCounter = this.irqLatch
        }
    }

    private getIrqMask(): number {
        switch (this.irqSizeMode) {
            case 0b100: return 0xF // 4-bit (mask 0x000F)
            case 0b010: return 0xFF // 8-bit (mask 0x00FF)
            case 0b001: return 0xFFF // 12-bit (mask 0x0FFF)
            default: return 0xFFFF // 16-bit
        }
    }

    override loadROM(): void {
        if (!this.nes.rom.valid) {
            throw new Error('Mapper18: Invalid ROM!')
        }

        // Initialize PRG banks
        this.prgBanks[0] = 0
        this.prgBanks[1] = 1
        this.prgBanks[2] = 2
        this.updatePrgBanks()

        this.loadBatteryRam()
        this.loadCHRROM() 
        
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }

    override load(address: number): number {
        
        if (address >= 0x6000 && address < 0x8000) {
            return this.prgRamEnabled ? super.load(address) : 0xFF
        }

        return super.load(address)
    }
}

export { Mapper18 }
