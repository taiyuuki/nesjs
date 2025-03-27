import type { NES } from 'src/nes'
import type { Mapper } from 'src/type'
import { Mapper0 } from './mapper000'

class MMC3 extends Mapper0 {
    CMD_SEL_2_1K_VROM_0000 = 0
    CMD_SEL_2_1K_VROM_0800 = 1
    CMD_SEL_1K_VROM_1000 = 2
    CMD_SEL_1K_VROM_1400 = 3
    CMD_SEL_1K_VROM_1800 = 4
    CMD_SEL_1K_VROM_1C00 = 5
    CMD_SEL_ROM_PAGE1 = 6
    CMD_SEL_ROM_PAGE2 = 7
  
    command = 0
    prgAddressSelect = 0
    chrAddressSelect = 0
    irqCounter = 0
    irqLatchValue = 0
    irqEnable = 0
    prgAddressChanged = false

    prgBanks: number[] = new Array(8).fill(0)
    currentCommand = 0

    constructor(public nes: NES) {
        super(nes)
    }

    protected getCommand() { return this.currentCommand }

    protected getPrgValue(index: number) { return this.prgBanks[index] }

    override write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            super.write(address, value)

            return
        }
      
        const tmp = value >> 6 & 1
        switch (address) {
            case 0x8000:

                // Command/Address Select register
                this.command = value & 7
                if (tmp !== this.prgAddressSelect) {
                    this.prgAddressChanged = true
                }
                this.prgAddressSelect = tmp
                this.chrAddressSelect = value >> 7 & 1
                this.currentCommand = value & 0x07
                this.prgBanks[0] = value
                break
      
            case 0x8001:

                // Page number for command
                this.executeCommand(this.command, value)
                this.prgBanks[1] = value
                break
      
            case 0xa000:

                // Mirroring select
                if ((value & 1) === 0) {
                    this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING)
                }
                else {
                    this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)
                }
                this.prgBanks[2] = value
                break
      
            case 0xa001:

                // SaveRAM Toggle
                // TODO
                this.prgBanks[3] = value
                break
      
            case 0xc000:

                // IRQ Counter register
                this.irqCounter = value

                // nes.ppu.mapperIrqCounter = 0;
                this.prgBanks[4] = value
                break
      
            case 0xc001:

                // IRQ Latch register
                this.irqLatchValue = value
                this.prgBanks[5] = value
                break
      
            case 0xe000:

                // IRQ Control Reg 0 (disable)
                // irqCounter = irqLatchValue;
                this.irqEnable = 0
                this.prgBanks[6] = value
                break
      
            case 0xe001:

                // IRQ Control Reg 1 (enable)
                this.irqEnable = 1
                this.prgBanks[7] = value
                break
      
            default:

          // Not a MMC3 register.
          // The game has probably crashed,
          // since it tries to write to ROM..
          // IGNORE.
        }
    }

    executeCommand(cmd: number, arg: number) {
        switch (cmd) {
            case this.CMD_SEL_2_1K_VROM_0000:

                // Select 2 1KB VROM pages at 0x0000:
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x0000)
                    this.load1kVromBank(arg + 1, 0x0400)
                }
                else {
                    this.load1kVromBank(arg, 0x1000)
                    this.load1kVromBank(arg + 1, 0x1400)
                }
                break
      
            case this.CMD_SEL_2_1K_VROM_0800:

                // Select 2 1KB VROM pages at 0x0800:
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x0800)
                    this.load1kVromBank(arg + 1, 0x0c00)
                }
                else {
                    this.load1kVromBank(arg, 0x1800)
                    this.load1kVromBank(arg + 1, 0x1c00)
                }
                break
      
            case this.CMD_SEL_1K_VROM_1000:

                // Select 1K VROM Page at 0x1000:
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x1000)
                }
                else {
                    this.load1kVromBank(arg, 0x0000)
                }
                break
      
            case this.CMD_SEL_1K_VROM_1400:

                // Select 1K VROM Page at 0x1400:
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x1400)
                }
                else {
                    this.load1kVromBank(arg, 0x0400)
                }
                break
      
            case this.CMD_SEL_1K_VROM_1800:

                // Select 1K VROM Page at 0x1800:
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x1800)
                }
                else {
                    this.load1kVromBank(arg, 0x0800)
                }
                break
      
            case this.CMD_SEL_1K_VROM_1C00:

                // Select 1K VROM Page at 0x1C00:
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x1c00)
                }
                else {
                    this.load1kVromBank(arg, 0x0c00)
                }
                break
      
            case this.CMD_SEL_ROM_PAGE1:
                if (this.prgAddressChanged) {

                    // Load the two hardwired banks:
                    if (this.prgAddressSelect === 0) {
                        this.load8kRomBank((this.nes.rom.romCount - 1) * 2, 0xc000)
                    }
                    else {
                        this.load8kRomBank((this.nes.rom.romCount - 1) * 2, 0x8000)
                    }
                    this.prgAddressChanged = false
                }
      
                // Select first switchable ROM page:
                if (this.prgAddressSelect === 0) {
                    this.load8kRomBank(arg, 0x8000)
                }
                else {
                    this.load8kRomBank(arg, 0xc000)
                }
                break
      
            case this.CMD_SEL_ROM_PAGE2:

                // Select second switchable ROM page:
                this.load8kRomBank(arg, 0xa000)
      
                // hardwire appropriate bank:
                if (this.prgAddressChanged) {

                    // Load the two hardwired banks:
                    if (this.prgAddressSelect === 0) {
                        this.load8kRomBank((this.nes.rom.romCount - 1) * 2, 0xc000)
                    }
                    else {
                        this.load8kRomBank((this.nes.rom.romCount - 1) * 2, 0x8000)
                    }
                    this.prgAddressChanged = false
                }
        }
    }

    override loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('MMC3: Invalid ROM! Unable to load.')
        }
      
        // Load hardwired PRG banks (0xC000 and 0xE000):
        this.load8kRomBank((this.nes.rom.romCount - 1) * 2, 0xc000)
        this.load8kRomBank((this.nes.rom.romCount - 1) * 2 + 1, 0xe000)
      
        // Load swappable PRG banks (0x8000 and 0xA000):
        this.load8kRomBank(0, 0x8000)
        this.load8kRomBank(1, 0xa000)
      
        // Load CHR-ROM:
        this.loadCHRROM()
      
        // Load Battery RAM (if present):
        this.loadBatteryRam()
      
        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }

    clockIrqCounter() {
        if (this.irqEnable === 1) {
            this.irqCounter--
            if (this.irqCounter < 0) {

                // Trigger IRQ:
                // this.nes.cpu.doIrq()
                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)
                this.irqCounter = this.irqLatchValue
            }
        }
    }
}

const Mapper4 = class {
    constructor(public nes: NES) {
        if (this.nes.rom.isNES20 && this.nes.rom.submapper !== 0) {
            this.nes.rom.notSupportError()

            return
        }

        return new MMC3(nes)
    }
} as new (nes: NES)=> Mapper

export {
    MMC3, 
    Mapper4,
}
