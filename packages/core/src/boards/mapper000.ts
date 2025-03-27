import type { NES } from 'src/nes'
import { copyArrayElements } from 'src/utils'
import { BaseMapper } from './base'

class Mapper0 extends BaseMapper {

    constructor(public nes: NES) {
        super(nes)
    }
      
    write(address: number, value: number) {
        if (address < 0x2000) {

            // Mirroring of RAM:
            this.nes.cpu.mem[address & 0x7ff] = value
        }
        else if (address > 0x4017) {
            this.nes.cpu.mem[address] = value
            if (address >= 0x6000 && address < 0x8000) {

                // Write to persistent RAM
                this.nes.opts.onBatteryRamWrite(address, value)
            }
        }
        else if (address > 0x2007 && address < 0x4000) {
            this.regWrite(0x2000 + (address & 0x7), value)
        }
        else {
            this.regWrite(address, value)
        }
    }
      
    writelow(address: number, value: number) {
        if (address < 0x2000) {

            // Mirroring of RAM:
            this.nes.cpu.mem[address & 0x7ff] = value
        }
        else if (address > 0x4017) {
            this.nes.cpu.mem[address] = value
        }
        else if (address > 0x2007 && address < 0x4000) {
            this.regWrite(0x2000 + (address & 0x7), value)
        }
        else {
            this.regWrite(address, value)
        }
    }
      
    load(address: number) {

        // Wrap around:
        address &= 0xffff
      
        // Check address range:
        if (address > 0x4017) {

            // ROM:
            return this.nes.cpu.mem[address]
        }
        else if (address >= 0x2000) {

            // I/O Ports.
            return this.regLoad(address) as number
        }
        else {

            // RAM (mirrored)
            return this.nes.cpu.mem[address & 0x7ff]
        }
    }
      
    regLoad(address: number) {
        switch (
            address >> 12 // use fourth nibble (0xF000)
        ) {
            case 0:
                break
      
            case 1:
                break
      
            case 2:

            // Fall through to case 3
            case 3:

                // PPU Registers
                switch (address & 0x7) {
                    case 0x0:

                        // 0x2000:
                        // PPU Control Register 1.
                        // (the value is stored both
                        // in main memory and in the
                        // PPU as flags):
                        // (not in the real NES)
                        return this.nes.cpu.mem[0x2000]
      
                    case 0x1:

                        // 0x2001:
                        // PPU Control Register 2.
                        // (the value is stored both
                        // in main memory and in the
                        // PPU as flags):
                        // (not in the real NES)
                        return this.nes.cpu.mem[0x2001]
      
                    case 0x2:

                        // 0x2002:
                        // PPU Status Register.
                        // The value is stored in
                        // main memory in addition
                        // to as flags in the PPU.
                        // (not in the real NES)
                        return this.nes.ppu.readStatusRegister()
      
                    case 0x3:
                        return 0
      
                    case 0x4:

                        // 0x2004:
                        // Sprite Memory read.
                        return this.nes.ppu.sramLoad()
                    case 0x5:
                        return 0
      
                    case 0x6:
                        return 0
      
                    case 0x7:

                        // 0x2007:
                        // VRAM read:
                        return this.nes.ppu.vramLoad()
                }
                break
            case 4:

                // Sound+Joypad registers
                switch (address - 0x4015) {
                    case 0:

                        // 0x4015:
                        // Sound channel enable, DMC Status
                        return this.nes.papu.readReg(address)
      
                    case 1:

                        // 0x4016:
                        // Joystick 1 + Strobe
                        return this.joy1Read()
      
                    case 2:

                        // 0x4017:
                        // Joystick 2 + Strobe
                        // https://wiki.nesdev.com/w/index.php/Zapper
                        // eslint-disable-next-line
                        let w = 0
      
                        if (
                            this.zapperX != null
                            && this.zapperY != null
                            && this.nes.ppu.isPixelWhite(this.zapperX, this.zapperY)
                        ) {
                            w = 0
                        }
                        else {
                            w = 0x1 << 3
                        }
      
                        if (this.zapperFired) {
                            w |= 0x1 << 4
                        }

                        return (this.joy2Read() | w) & 0xffff
                }
                break
        }

        return 0
    }
      
    regWrite(address: number, value: number) {
        switch (address) {
            case 0x2000:

                // PPU Control register 1
                this.nes.cpu.mem[address] = value
                this.nes.ppu.updateControlReg1(value)
                break
      
            case 0x2001:

                // PPU Control register 2
                this.nes.cpu.mem[address] = value
                this.nes.ppu.updateControlReg2(value)
                break
      
            case 0x2003:

                // Set Sprite RAM address:
                this.nes.ppu.writeSRAMAddress(value)
                break
      
            case 0x2004:

                // Write to Sprite RAM:
                this.nes.ppu.sramWrite(value)
                break
      
            case 0x2005:

                // Screen Scroll offsets:
                this.nes.ppu.scrollWrite(value)
                break
      
            case 0x2006:

                // Set VRAM address:
                this.nes.ppu.writeVRAMAddress(value)
                break
      
            case 0x2007:

                // Write to VRAM:
                this.nes.ppu.vramWrite(value)
                break
      
            case 0x4014:

                // Sprite Memory DMA Access
                this.nes.ppu.sramDMA(value)
                break
      
            case 0x4015:

                // Sound Channel Switch, DMC Status
                this.nes.papu.writeReg(address, value)
                break
      
            case 0x4016:

                // Joystick 1 + Strobe
                if ((value & 1) === 0 && (this.joypadLastWrite & 1) === 1) {
                    this.joy1StrobeState = 0
                    this.joy2StrobeState = 0
                }
                this.joypadLastWrite = value
                break
      
            case 0x4017:

                // Sound channel frame sequencer:
                this.nes.papu.writeReg(address, value)
                break
      
            default:

                // Sound registers
                // console.log("write to sound reg");
                if (address >= 0x4000 && address <= 0x4017) {
                    this.nes.papu.writeReg(address, value)
                }
        }
    }
      
    joy1Read() {
        let ret
      
        switch (this.joy1StrobeState) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                ret = this.nes.controllers[1].state[this.joy1StrobeState]
                break
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
                ret = 0
                break
            case 19:
                ret = 1
                break
            default:
                ret = 0
        }
      
        this.joy1StrobeState++
        if (this.joy1StrobeState === 24) {
            this.joy1StrobeState = 0
        }
      
        return ret
    }
      
    joy2Read() {
        let ret
      
        switch (this.joy2StrobeState) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                ret = this.nes.controllers[2].state[this.joy2StrobeState]
                break
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
                ret = 0
                break
            case 19:
                ret = 1
                break
            default:
                ret = 0
        }
      
        this.joy2StrobeState++
        if (this.joy2StrobeState === 24) {
            this.joy2StrobeState = 0
        }
      
        return ret
    }
      
    loadROM() {
        if (!this.nes.rom.valid || this.nes.rom.romCount < 1) {
            throw new Error('NoMapper: Invalid ROM! Unable to load.')
        }
      
        // Load ROM into memory:
        this.loadPRGROM()
      
        // Load CHR-ROM:
        this.loadCHRROM()
      
        // Load Battery RAM (if present):
        this.loadBatteryRam()
      
        // Reset IRQ:
        // nes.getCpu().doResetInterrupt();
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
    
    loadPRGROM() {
        if (this.nes.rom.romCount > 1) {

            // Load the two first banks into memory.
            this.loadRomBank(0, 0x8000)
            this.loadRomBank(1, 0xc000)
        }
        else {

            // Load the one bank into both memory locations:
            this.loadRomBank(0, 0x8000)
            this.loadRomBank(0, 0xc000)
        }
    }
      
    loadCHRROM() {

        // console.log("Loading CHR ROM..");
        if (this.nes.rom.vromCount > 0) {
            if (this.nes.rom.vromCount === 1) {
                this.loadVromBank(0, 0x0000)
                this.loadVromBank(0, 0x1000)
            }
            else {
                this.loadVromBank(0, 0x0000)
                this.loadVromBank(1, 0x1000)
            }
        }
        else {

            // console.warn("There aren't any CHR-ROM banks..");
        }
    }
      
    loadBatteryRam() {
        if (this.nes.rom.batteryRam) {

            const ram = this.nes.rom.batteryRamData
            if (Array.isArray(ram) && ram.length === 0x2000) {

                // Load Battery RAM into memory:
                copyArrayElements(ram, 0, this.nes.cpu.mem, 0x6000, 0x2000)
            }
        }
    }
      
    loadRomBank(bank: number, address: number) {

        // Loads a ROM bank into the specified address.
        bank %= this.nes.rom.romCount

        // var data = this.nes.rom.rom[bank];
        // cpuMem.write(address,data,data.length);
        copyArrayElements(
            this.nes.rom.rom[bank],
            0,
            this.nes.cpu.mem,
            address,
            16384,
        )
    }
      
    loadVromBank(bank: number, address: number) {
        if (this.nes.rom.vromCount === 0) return
        bank = bank % this.nes.rom.vromCount
        this.nes.ppu.triggerRendering()
      
        copyArrayElements(
            this.nes.rom.vrom[bank],
            0,
            this.nes.ppu.vramMem,
            address,
            4096,
        )
      
        const vromTile = this.nes.rom.vromTile[bank]
        copyArrayElements(
            vromTile,
            0,
            this.nes.ppu.ptTile,
            address >> 4,
            256,
        )
    }
      
    load32kRomBank(bank: number, address: number) {
        this.loadRomBank(bank * 2 % this.nes.rom.romCount, address)
        this.loadRomBank((bank * 2 + 1) % this.nes.rom.romCount, address + 16384)
    }

    load16kRomBank(bank: number, address: number) {

        // 验证地址有效性（必须16KB对齐）
        if ((address & 0x3FFF) !== 0) {
            throw new Error(`Invalid 16KB ROM address: 0x${address.toString(16)}`)
        }

        // 计算ROM总页数（每页8KB）
        const totalPages = this.nes.rom.romCount * 2
        bank = bank % totalPages

        // 加载两个连续的8KB bank
        this.loadRomBank(bank, address)
        this.loadRomBank(bank + 1, address + 0x2000)
    }
      
    load8kVromBank(bank4kStart: number, address: number) {
        if (this.nes.rom.vromCount === 0) {
            return
        }
        this.nes.ppu.triggerRendering()
      
        this.loadVromBank(bank4kStart % this.nes.rom.vromCount, address)
        this.loadVromBank(
            (bank4kStart + 1) % this.nes.rom.vromCount,
            address + 4096,
        )
    }
      
    load1kVromBank(bank1k: number, address: number) {
        if (this.nes.rom.vromCount === 0) {
            return
        }
        this.nes.ppu.triggerRendering()
      
        const bank4k = Math.floor(bank1k / 4) % this.nes.rom.vromCount
        const bankoffset = bank1k % 4 * 1024
        copyArrayElements(
            this.nes.rom.vrom[bank4k],
            bankoffset,
            this.nes.ppu.vramMem,
            address,
            1024,
        )
      
        // Update tiles:
        const vromTile = this.nes.rom.vromTile[bank4k]
        const baseIndex = address >> 4
        for (let i = 0; i < 64; i++) {
            this.nes.ppu.ptTile[baseIndex + i] = vromTile[(bank1k % 4 << 6) + i]
        }
    }
      
    load2kVromBank(bank2k: number, address: number) {
        if (this.nes.rom.vromCount === 0) {
            return
        }
        this.nes.ppu.triggerRendering()
      
        const bank4k = Math.floor(bank2k / 2) % this.nes.rom.vromCount
        const bankoffset = bank2k % 2 * 2048
        copyArrayElements(
            this.nes.rom.vrom[bank4k],
            bankoffset,
            this.nes.ppu.vramMem,
            address,
            2048,
        )
      
        // Update tiles:
        const vromTile = this.nes.rom.vromTile[bank4k]
        const baseIndex = address >> 4
        for (let i = 0; i < 128; i++) {
            this.nes.ppu.ptTile[baseIndex + i] = vromTile[(bank2k % 2 << 7) + i]
        }
    }
      
    load8kRomBank(bank8k: number, address: number) {
        const bank16k = Math.floor(bank8k / 2) % this.nes.rom.romCount
        const offset = bank8k % 2 * 8192
      
        // this.nes.cpu.mem.write(address,this.nes.rom.rom[bank16k],offset,8192);
        copyArrayElements(
            this.nes.rom.rom[bank16k],
            offset,
            this.nes.cpu.mem,
            address,
            8192,
        )
    }
      
    clockIrqCounter() {

        // Does nothing. This is used by the MMC3 mapper.
    }
     
    latchAccess(_address: number) {

        // Does nothing. This is used by MMC2.
    }
      
    toJSON() {
        const keys = Object.keys(this) as Array<keyof Mapper0>
        const obj: any = {}
        for (const key of keys) {
            if (key === 'nes') {
                continue
            }
            obj[key] = this[key]
        }

        return obj
    }
      
    fromJSON(s: Mapper0) {
        Object.assign(this, s)
    }  
}

export { Mapper0 }
