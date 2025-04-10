import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper21 extends Mapper0 {

    private irqCounter: number = 0
    private irqLatch: number = 0
    private irqEnable: number = 0
    private irqClock: number = 0
    private regs: number[] = new Array(8).fill(0)

    constructor(nes: NES) {
        super(nes)
        this.reset()
    }

    override write(address: number, value: number): void {
        if (address < 0x8000) {
            super.write(address, value)
        }
        else {
            switch (address & 0xF0CF) {
                case 0x8000:
                    if ((this.regs[8] & 0x02) === 0) {
                        this.load8kRomBank(value, 0x8000)
                    }
                    else {
                        this.load8kRomBank(value, 0xC000)
                    }
                    break

                case 0xA000:
                    this.load8kRomBank(value, 0xA000)
                    break

                case 0x9000:
                    value &= 0x03
                    switch (value) {
                        case 0:
                            this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING)
                            break
                        case 1:
                            this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)
                            break
                        case 2:
                            this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING)
                            break
                        default:
                            this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING2)
                    }
                    break

                case 0x9002:
                case 0x9080:
                    this.regs[8] = value
                    break

                case 0xB000:
                    this.regs[0] = this.regs[0] & 0xF0 | value & 0x0F
                    this.load1kVromBank(this.regs[0], 0x0000)
                    break

                case 0xB002:
                case 0xB040:
                    this.regs[0] = this.regs[0] & 0x0F | (value & 0x0F) << 4
                    this.load1kVromBank(this.regs[0], 0x0000)
                    break

                case 0xB001:
                case 0xB004:
                case 0xB080:
                    this.regs[1] = this.regs[1] & 0xF0 | value & 0x0F
                    this.load1kVromBank(this.regs[1], 0x0400)
                    break

                case 0xB003:
                case 0xB006:
                case 0xB0C0:
                    this.regs[1] = this.regs[1] & 0x0F | (value & 0x0F) << 4
                    this.load1kVromBank(this.regs[1], 0x0400)
                    break

                case 0xC000:
                    this.regs[2] = this.regs[2] & 0xF0 | value & 0x0F
                    this.load1kVromBank(this.regs[2], 0x0800)
                    break

                case 0xC002:
                case 0xC040:
                    this.regs[2] = this.regs[2] & 0x0F | (value & 0x0F) << 4
                    this.load1kVromBank(this.regs[2], 0x0800)
                    break

                case 0xC001:
                case 0xC004:
                case 0xC080:
                    this.regs[3] = this.regs[3] & 0xF0 | value & 0x0F
                    this.load1kVromBank(this.regs[3], 0x0C00)
                    break

                case 0xC003:
                case 0xC006:
                case 0xC0C0:
                    this.regs[3] = this.regs[3] & 0x0F | (value & 0x0F) << 4
                    this.load1kVromBank(this.regs[3], 0x0C00)
                    break

                case 0xD000:
                    this.regs[4] = this.regs[4] & 0xF0 | value & 0x0F
                    this.load1kVromBank(this.regs[4], 0x1000)
                    break

                case 0xD002:
                case 0xD040:
                    this.regs[4] = this.regs[4] & 0x0F | (value & 0x0F) << 4
                    this.load1kVromBank(this.regs[4], 0x1000)
                    break

                case 0xD001:
                case 0xD004:
                case 0xD080:
                    this.regs[5] = this.regs[5] & 0xF0 | value & 0x0F
                    this.load1kVromBank(this.regs[5], 0x1400)
                    break

                case 0xD003:
                case 0xD006:
                case 0xD0C0:
                    this.regs[5] = this.regs[5] & 0x0F | (value & 0x0F) << 4
                    this.load1kVromBank(this.regs[5], 0x1400)
                    break

                case 0xE000:
                    this.regs[6] = this.regs[6] & 0xF0 | value & 0x0F
                    this.load1kVromBank(this.regs[6], 0x1800)
                    break

                case 0xE002:
                case 0xE040:
                    this.regs[6] = this.regs[6] & 0x0F | (value & 0x0F) << 4
                    this.load1kVromBank(this.regs[6], 0x1800)
                    break

                case 0xE001:
                case 0xE004:
                case 0xE080:
                    this.regs[7] = this.regs[7] & 0xF0 | value & 0x0F
                    this.load1kVromBank(this.regs[7], 0x1C00)
                    break

                case 0xE003:
                case 0xE006:
                case 0xE0C0:
                    this.regs[7] = this.regs[7] & 0x0F | (value & 0x0F) << 4
                    this.load1kVromBank(this.regs[7], 0x1C00)
                    break

                case 0xF000:
                    this.irqLatch = this.irqLatch & 0xF0 | value & 0x0F
                    break

                case 0xF002:
                case 0xF040:
                    this.irqLatch = this.irqLatch & 0x0F | (value & 0x0F) << 4
                    break

                case 0xF003:
                case 0xF0C0:
                case 0xF006:
                    this.irqEnable = (this.irqEnable & 0x01) * 3
                    this.irqClock = 0
                    break

                case 0xF004:
                case 0xF080:
                    this.irqEnable = value & 0x03
                    if ((this.irqEnable & 0x02) !== 0) {
                        this.irqCounter = this.irqLatch
                        this.irqClock = 0
                    }
                    break
            }
        }
    }

    override loadROM(): void {
        if (!this.nes.rom.valid) {
            throw new Error('VRC4: Invalid this.nes.rom! Unable to load.')
        }

        const num_8k_banks: number = this.nes.rom.prgCount * 2
        this.load8kRomBank(0, 0x8000)
        this.load8kRomBank(1, 0xA000)
        this.load8kRomBank(num_8k_banks - 2, 0xC000)
        this.load8kRomBank(num_8k_banks - 1, 0xE000)

        this.loadCHRROM()
        this.loadBatteryRam()
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }

    override clockIrqCounter(cycles: number) {
        if ((this.irqEnable & 0x02) !== 0) {
            if ((this.irqClock -= cycles) < 0) {
                this.irqClock += 0x72
                if (this.irqCounter === 0xFF) {
                    this.irqCounter = this.irqLatch

                    this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)
                }
                else {
                    this.irqCounter++
                }
            }
        }
    }

    override reset(): void {
        this.regs = [0, 1, 2, 3, 4, 5, 6, 7, 0]
        this.irqEnable = 0
        this.irqLatch = 0
        this.irqCounter = 0
        this.irqClock = 0
    }
}

export { Mapper21 }
