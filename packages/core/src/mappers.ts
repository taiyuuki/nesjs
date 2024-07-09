import type { NES } from './nes'
import type { Mapper, MappersType } from './type'
import { copyArrayElements } from './utils'

class BaseMapper implements Mapper {
    joy1StrobeState = 0
    joy2StrobeState = 0
    joypadLastWrite = 0
  
    zapperFired = false
    zapperX = 0
    zapperY = 0
    
    constructor(public nes: NES) {}

    reset() {
        this.joy1StrobeState = 0
        this.joy2StrobeState = 0
        this.joypadLastWrite = 0
    
        this.zapperFired = false
        this.zapperX = 0
        this.zapperY = 0
    }

    regWrite(_address: number, _value: number): void {
        throw new Error('Method not implemented.')
    }

    regLoad(_address: number): number {
        throw new Error('Method not implemented.')
    }

    joy1Read(): number {
        throw new Error('Method not implemented.')
    }

    joy2Read(): number {
        throw new Error('Method not implemented.')
    }

    loadPRGROM(): void {
        throw new Error('Method not implemented.')
    }

    write(_address: number, _value: number): void {
        throw new Error('Method not implemented.')
    }

    load(_address: number): number {
        throw new Error('Method not implemented.')
    }

    writelow(_address: number, _value: number): void {
        throw new Error('Method not implemented.')
    }

    loadROM(): void {
        throw new Error('Method not implemented.')
    }

    loadCHRROM(): void {
        throw new Error('Method not implemented.')
    }

    loadBatteryRam(): void {
        throw new Error('Method not implemented.')
    }

    loadRomBank(_bank: number, _address: number): void {
        throw new Error('Method not implemented.')
    }

    loadVromBank(_bank: number, _address: number): void {
        throw new Error('Method not implemented.')
    }

    load32kRomBank(_bank: number, _address: number): void {
        throw new Error('Method not implemented.')
    }

    load8kVromBank(_bank4kStart: number, _address: number): void {
        throw new Error('Method not implemented.')
    }

    load1kVromBank(_bank1k: number, _address: number): void {
        throw new Error('Method not implemented.')
    }

    load2kVromBank(_bank2k: number, _address: number): void {
        throw new Error('Method not implemented.')
    }

    load8kRomBank(_bank8k: number, _address: number): void {
        throw new Error('Method not implemented.')
    }

    clockIrqCounter(): void {
        throw new Error('Method not implemented.')
    }

    latchAccess(_address: number): void {
        throw new Error('Method not implemented.')
    }

    toJSON() {
        throw new Error('Method not implemented.')
    }

    fromJSON(_s: Mapper): void {
        throw new Error('Method not implemented.')
    }
}

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
            return this.regLoad(address)
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

            // System.out.println("There aren't any CHR-ROM banks..");
        }
    }
      
    loadBatteryRam() {
        if (this.nes.rom.batteryRam) {

            // const ram = this.nes.rom.batteryRam
            // if (ram !== null && ram.length === 0x2000) {

            //     // Load Battery RAM into memory:
            //     copyArrayElements(ram, 0, this.nes.cpu.mem, 0x6000, 0x2000)
            // }
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
        if (this.nes.rom.vromCount === 0) {
            return
        }
        this.nes.ppu.triggerRendering()
      
        copyArrayElements(
            this.nes.rom.vrom[bank % this.nes.rom.vromCount],
            0,
            this.nes.ppu.vramMem,
            address,
            4096,
        )
      
        const vromTile = this.nes.rom.vromTile[bank % this.nes.rom.vromCount]
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
        return {
            joy1StrobeState: this.joy1StrobeState,
            joy2StrobeState: this.joy2StrobeState,
            joypadLastWrite: this.joypadLastWrite,
        }
    }
      
    fromJSON(s: Mapper0) {
        this.joy1StrobeState = s.joy1StrobeState
        this.joy2StrobeState = s.joy2StrobeState
        this.joypadLastWrite = s.joypadLastWrite
    }
      
}

class Mapper1 extends Mapper0 {

    // 5-bit buffer:
    regBuffer = 0
    regBufferCounter = 0

    // Register 0:
    mirroring = 0
    oneScreenMirroring = 0
    prgSwitchingArea = 1
    prgSwitchingSize = 1
    vromSwitchingSize = 0

    // Register 1:
    romSelectionReg0 = 0

    // Register 2:
    romSelectionReg1 = 0

    // Register 3:
    romBankSelect = 0

    constructor(public nes: NES) {
        super(nes)
    }

    reset() {
        super.reset()
        this.regBuffer = 0
        this.regBufferCounter = 0
        this.mirroring = 0
        this.oneScreenMirroring = 0
        this.prgSwitchingArea = 1
        this.prgSwitchingSize = 1
        this.vromSwitchingSize = 0
        this.romSelectionReg0 = 0
        this.romSelectionReg1 = 0
        this.romBankSelect = 0
    }

    write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            super.write.apply(this, [address, value])

            return
        }
      
        // See what should be done with the written value:
        if ((value & 128) === 0) {

            // Continue buffering:
            // regBuffer = (regBuffer & (0xFF-(1<<regBufferCounter))) | ((value & (1<<regBufferCounter))<<regBufferCounter);
            this.regBuffer
            = this.regBuffer & 0xff - (1 << this.regBufferCounter)
            | (value & 1) << this.regBufferCounter
            this.regBufferCounter++
      
            if (this.regBufferCounter === 5) {

                // Use the buffered value:
                this.setReg(this.getRegNumber(address), this.regBuffer)
      
                // Reset buffer:
                this.regBuffer = 0
                this.regBufferCounter = 0
            }
        }
        else {

            // Reset buffering:
            this.regBufferCounter = 0
            this.regBuffer = 0
      
            // Reset register:
            if (this.getRegNumber(address) === 0) {
                this.prgSwitchingArea = 1
                this.prgSwitchingSize = 1
            }
        }
    }

    setReg(reg: number, value: number) {
        let tmp
        let bank
        let baseBank = 0
      
        switch (reg) {
            case 0:

                // Mirroring:
                tmp = value & 3
                if (tmp !== this.mirroring) {

                    // Set mirroring:
                    this.mirroring = tmp
                    if ((this.mirroring & 2) === 0) {

                        // SingleScreen mirroring overrides the other setting:
                        this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING)
                    }
                    else if ((this.mirroring & 1) === 0) {
                        this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING)
                    }
                    else {

                        // Not overridden by SingleScreen mirroring.
                        this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)
                    }
                }
      
                // PRG Switching Area;
                this.prgSwitchingArea = value >> 2 & 1
      
                // PRG Switching Size:
                this.prgSwitchingSize = value >> 3 & 1
      
                // VROM Switching Size:
                this.vromSwitchingSize = value >> 4 & 1
      
                break
      
            case 1:

                // ROM selection:
                this.romSelectionReg0 = value >> 4 & 1
      
                // Check whether the cart has VROM:
                if (this.nes.rom.vromCount > 0) {

                    // Select VROM bank at 0x0000:
                    if (this.vromSwitchingSize === 0) {

                        // Swap 8kB VROM:
                        if (this.romSelectionReg0 === 0) {
                            this.load8kVromBank(value & 0xf, 0x0000)
                        }
                        else {
                            this.load8kVromBank(
                                Math.floor(this.nes.rom.vromCount / 2) + (value & 0xf),
                                0x0000,
                            )
                        }
                    }

                    // Swap 4kB VROM:
                    else if (this.romSelectionReg0 === 0) {
                        this.loadVromBank(value & 0xf, 0x0000)
                    }
                    else {
                        this.loadVromBank(
                            Math.floor(this.nes.rom.vromCount / 2) + (value & 0xf),
                            0x0000,
                        )
                    }
                    
                }
      
                break
      
            case 2:

                // ROM selection:
                this.romSelectionReg1 = value >> 4 & 1
      
                // Check whether the cart has VROM:
                if (this.nes.rom.vromCount > 0) {

                    // Select VROM bank at 0x1000:
                    if (this.vromSwitchingSize === 1) {

                        // Swap 4kB of VROM:
                        if (this.romSelectionReg1 === 0) {
                            this.loadVromBank(value & 0xf, 0x1000)
                        }
                        else {
                            this.loadVromBank(
                                Math.floor(this.nes.rom.vromCount / 2) + (value & 0xf),
                                0x1000,
                            )
                        }
                    }
                }
                break
      
            default:

                // Select ROM bank:
                // -------------------------
                tmp = value & 0xf
      
                if (this.nes.rom.romCount >= 32) {

                    // 1024 kB cart
                    if (this.vromSwitchingSize === 0) {
                        if (this.romSelectionReg0 === 1) {
                            baseBank = 16
                        }
                    }
                    else {
                        baseBank
                  = (this.romSelectionReg0 | this.romSelectionReg1 << 1) << 3
                    }
                }
                else if (this.nes.rom.romCount >= 16) {

                    // 512 kB cart
                    if (this.romSelectionReg0 === 1) {
                        baseBank = 8
                    }
                }
      
                if (this.prgSwitchingSize === 0) {

                    // 32kB
                    bank = baseBank + (value & 0xf)
                    this.load32kRomBank(bank, 0x8000)
                }
                else {

                    // 16kB
                    bank = baseBank * 2 + (value & 0xf)
                    if (this.prgSwitchingArea === 0) {
                        this.loadRomBank(bank, 0xc000)
                    }
                    else {
                        this.loadRomBank(bank, 0x8000)
                    }
                }
        }
    }

    getRegNumber(address: number) {
        if (address >= 0x8000 && address <= 0x9fff) {
            return 0
        }
        else if (address >= 0xa000 && address <= 0xbfff) {
            return 1
        }
        else if (address >= 0xc000 && address <= 0xdfff) {
            return 2
        }
        else {
            return 3
        }
    }

    loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('MMC1: Invalid ROM! Unable to load.')
        }
      
        // Load PRG-ROM:
        this.loadRomBank(0, 0x8000) //   First ROM bank..
        this.loadRomBank(this.nes.rom.romCount - 1, 0xc000) // ..and last ROM bank.
      
        // Load CHR-ROM:
        this.loadCHRROM()
      
        // Load Battery RAM (if present):
        this.loadBatteryRam()
      
        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }

    switchLowHighPrgRom(_oldSetting: any) {

        // not yet.
    }

    switch16to32() {

        // not yet.
    }

    switch32to16() {

        // not yet.
    }

    toJSON() {
        const s = Mappers[0].prototype.toJSON.apply(this)
        s.mirroring = this.mirroring
        s.oneScreenMirroring = this.oneScreenMirroring
        s.prgSwitchingArea = this.prgSwitchingArea
        s.prgSwitchingSize = this.prgSwitchingSize
        s.vromSwitchingSize = this.vromSwitchingSize
        s.romSelectionReg0 = this.romSelectionReg0
        s.romSelectionReg1 = this.romSelectionReg1
        s.romBankSelect = this.romBankSelect
        s.regBuffer = this.regBuffer
        s.regBufferCounter = this.regBufferCounter

        return s
    }

    fromJSON(s: Mapper1) {
        Mappers[0].prototype.fromJSON.apply(this, [s])
        this.mirroring = s.mirroring
        this.oneScreenMirroring = s.oneScreenMirroring
        this.prgSwitchingArea = s.prgSwitchingArea
        this.prgSwitchingSize = s.prgSwitchingSize
        this.vromSwitchingSize = s.vromSwitchingSize
        this.romSelectionReg0 = s.romSelectionReg0
        this.romSelectionReg1 = s.romSelectionReg1
        this.romBankSelect = s.romBankSelect
        this.regBuffer = s.regBuffer
        this.regBufferCounter = s.regBufferCounter
    }

}

class Mapper3 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            super.write.apply(this, [address, value])

            return
        }
        else {

            // This is a ROM bank select command.
            // Swap in the given ROM bank at 0x8000:
            // This is a VROM bank select command.
            // Swap in the given VROM bank at 0x0000:
            const bank = value % (this.nes.rom.vromCount / 2) * 2
            this.loadVromBank(bank, 0x0000)
            this.loadVromBank(bank + 1, 0x1000)
            this.load8kVromBank(value * 2, 0x0000)
        }
    }
}

class Mapper4 extends Mapper0 {
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
    pageNumber = 0
    irqCounter = 0
    irqLatchValue = 0
    irqEnable = 0
    prgAddressChanged = false

    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            super.write.apply(this, [address, value])

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
                break
      
            case 0x8001:

                // Page number for command
                this.executeCommand(this.command, value)
                break
      
            case 0xa000:

                // Mirroring select
                if ((value & 1) === 0) {
                    this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING)
                }
                else {
                    this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)
                }
                break
      
            case 0xa001:

                // SaveRAM Toggle
                // TODO
                // nes.getRom().setSaveState((value&1)!=0);
                break
      
            case 0xc000:

                // IRQ Counter register
                this.irqCounter = value

                // nes.ppu.mapperIrqCounter = 0;
                break
      
            case 0xc001:

                // IRQ Latch register
                this.irqLatchValue = value
                break
      
            case 0xe000:

                // IRQ Control Reg 0 (disable)
                // irqCounter = irqLatchValue;
                this.irqEnable = 0
                break
      
            case 0xe001:

                // IRQ Control Reg 1 (enable)
                this.irqEnable = 1
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

    loadROM() {
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
                // nes.getCpu().doIrq();
                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)
                this.irqCounter = this.irqLatchValue
            }
        }
    }

    toJSON() {
        const s = Mappers[0].prototype.toJSON.apply(this)
        s.command = this.command
        s.prgAddressSelect = this.prgAddressSelect
        s.chrAddressSelect = this.chrAddressSelect
        s.pageNumber = this.pageNumber
        s.irqCounter = this.irqCounter
        s.irqLatchValue = this.irqLatchValue
        s.irqEnable = this.irqEnable
        s.prgAddressChanged = this.prgAddressChanged

        return s
    }

    fromJSON(s: Mapper4) {
        Mappers[0].prototype.fromJSON.apply(this, [s])
        this.command = s.command
        this.prgAddressSelect = s.prgAddressSelect
        this.chrAddressSelect = s.chrAddressSelect
        this.pageNumber = s.pageNumber
        this.irqCounter = s.irqCounter
        this.irqLatchValue = s.irqLatchValue
        this.irqEnable = s.irqEnable
        this.prgAddressChanged = s.prgAddressChanged
    }
}

class Mapper5 extends Mapper0 {
    prg_size = 0
    chr_size = 0
    fill_chr = 0
    fill_pal = 0
    chr_mode = 0
    sram_we_a = 0
    sram_we_b = 0
    graphic_mode = 0
    nametable_mode = 0
    nametable_type = [0, 0, 0, 0]
    chr_page: number[][] = []
    split_control = 0
    split_scroll = 0
    split_page = 0
    irq_line = 0
    irq_enable = 0
    mult_a = 0
    mult_b = 0
    irq_status = 0

    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x5000) {
            super.write.apply(this, [address, value])

            return
        }
      
        switch (address) {
            case 0x5100:
                this.prg_size = value & 3
                break
            case 0x5101:
                this.chr_size = value & 3
                break
            case 0x5102:
                this.sram_we_a = value & 3
                break
            case 0x5103:
                this.sram_we_b = value & 3
                break
            case 0x5104:
                this.graphic_mode = value & 3
                break
            case 0x5105:
                this.nametable_mode = value
                this.nametable_type[0] = value & 3
                this.load1kVromBank(value & 3, 0x2000)
                value >>= 2
                this.nametable_type[1] = value & 3
                this.load1kVromBank(value & 3, 0x2400)
                value >>= 2
                this.nametable_type[2] = value & 3
                this.load1kVromBank(value & 3, 0x2800)
                value >>= 2
                this.nametable_type[3] = value & 3
                this.load1kVromBank(value & 3, 0x2c00)
                break
            case 0x5106:
                this.fill_chr = value
                break
            case 0x5107:
                this.fill_pal = value & 3
                break
            case 0x5113:

                // this.SetBank_SRAM(3, value & 3)
                break
            case 0x5114:
            case 0x5115:
            case 0x5116:
            case 0x5117:

                // this.SetBank_CPU(address, value)
                break
            case 0x5120:
            case 0x5121:
            case 0x5122:
            case 0x5123:
            case 0x5124:
            case 0x5125:
            case 0x5126:
            case 0x5127:
                this.chr_mode = 0
                this.chr_page[0][address & 7] = value

                // this.SetBank_PPU()
                break
            case 0x5128:
            case 0x5129:
            case 0x512a:
            case 0x512b:
                this.chr_mode = 1
                this.chr_page[1][(address & 3) + 0] = value
                this.chr_page[1][(address & 3) + 4] = value

                // this.SetBank_PPU()
                break
            case 0x5200:
                this.split_control = value
                break
            case 0x5201:
                this.split_scroll = value
                break
            case 0x5202:
                this.split_page = value & 0x3f
                break
            case 0x5203:
                this.irq_line = value

                // this.nes.cpu.ClearIRQ()
                break
            case 0x5204:
                this.irq_enable = value

                // this.nes.cpu.ClearIRQ()
                break
            case 0x5205:
                this.mult_a = value
                break
            case 0x5206:
                this.mult_b = value
                break
            default:
                if (address >= 0x5000 && address <= 0x5015) {
                    this.nes.papu.writeReg(address, value)
                }
                else if (address >= 0x5c00 && address <= 0x5fff) {
                    if (this.graphic_mode === 2) {

                        // ExRAM
                        // vram write
                    }
                    else if (this.graphic_mode !== 3) {

                        // Split,ExGraphic
                        if (this.irq_status & 0x40) {

                            // vram write
                        }
                        else {

                            // vram write
                        }
                    }
                }
                else if (address >= 0x6000 && address <= 0x7fff) {
                    if (this.sram_we_a === 2 && this.sram_we_b === 1) {

                        // additional ram write
                    }
                }
                break
        }
    }

    loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('UNROM: Invalid ROM! Unable to load.')
        }
      
        // Load PRG-ROM:
        this.load8kRomBank(this.nes.rom.romCount * 2 - 1, 0x8000)
        this.load8kRomBank(this.nes.rom.romCount * 2 - 1, 0xa000)
        this.load8kRomBank(this.nes.rom.romCount * 2 - 1, 0xc000)
        this.load8kRomBank(this.nes.rom.romCount * 2 - 1, 0xe000)
      
        // Load CHR-ROM:
        this.loadCHRROM()
      
        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

class Mapper7 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            super.write.apply(this, [address, value])
        }
        else {
            this.load32kRomBank(value & 0x7, 0x8000)
            if (value & 0x10) {
                this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING2)
            }
            else {
                this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING)
            }
        }
    }

    loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('AOROM: Invalid ROM! Unable to load.')
        }
      
        // Load PRG-ROM:
        this.loadPRGROM()
      
        // Load CHR-ROM:
        this.loadCHRROM()
      
        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

class Mapper9 extends Mapper0 {
    latchLo = 0xFE
    latchHi = 0xFE
    latchLoVal1 = 0
    latchLoVal2 = 4
    latchHiVal1 = 0
    latchHiVal2 = 0

    constructor(public nes: NES) {
        super(nes)
    }

    reset() {
        super.reset()
        this.latchLo = 0xFE
        this.latchHi = 0xFE
        this.latchLoVal1 = 0
        this.latchLoVal2 = 4
        this.latchHiVal1 = 0
        this.latchHiVal2 = 0
    }

    write(address: number, value: number) {

        if (address < 0x8000) {

            // Handle normally.
            super.write(address, value)

        }
        else {

            // MMC2 write.

            value &= 0xFF
            address &= 0xF000
            switch (address >> 12) {
                case 0xA: {

                    // Select 8k ROM bank at 0x8000
                    this.load8kRomBank(value, 0x8000)

                    break

                }
                case 0xB: {

                    // Select 4k VROM bank at 0x0000, $FD mode
                    this.latchLoVal1 = value
                    if (this.latchLo === 0xFD) {
                        this.loadVromBank(value, 0x0000)
                    }

                    break

                }
                case 0xC: {

                    // Select 4k VROM bank at 0x0000, $FE mode
                    this.latchLoVal2 = value
                    if (this.latchLo === 0xFE) {
                        this.loadVromBank(value, 0x0000)
                    }

                    break

                }
                case 0xD: {

                    // Select 4k VROM bank at 0x1000, $FD mode
                    this.latchHiVal1 = value
                    if (this.latchHi === 0xFD) {
                        this.loadVromBank(value, 0x1000)
                    }

                    break

                }
                case 0xE: {

                    // Select 4k VROM bank at 0x1000, $FE mode
                    this.latchHiVal2 = value
                    if (this.latchHi === 0xFE) {
                        this.loadVromBank(value, 0x1000)
                    }

                    break

                }
                case 0xF: {

                    // Select mirroring
                    if ((value & 0x1) === 0) {

                        // Vertical mirroring
                        this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING)

                    }
                    else {

                        // Horizontal mirroring
                        this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)

                    }

                    break
                }
            }
        }
    }

    loadROM() {

        if (!this.nes.rom.valid) {
            throw new Error('AOROM: Invalid ROM! Unable to load.')
        }

        // Get number of 8K banks:
        const num_8k_banks = this.nes.rom.romCount * 2

        // Load PRG-ROM:
        this.load8kRomBank(0, 0x8000)
        this.load8kRomBank(num_8k_banks - 3, 0xA000)
        this.load8kRomBank(num_8k_banks - 2, 0xC000)
        this.load8kRomBank(num_8k_banks - 1, 0xE000)

        // Load CHR-ROM:
        this.loadCHRROM()

        // Load Battery RAM (if present):
        this.loadBatteryRam()

        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)

    }

    latchAccess(address: number) {
        if ((address & 0x1FF0) === 0x0FD0 && this.latchLo !== 0xFD) {

            // Set $FD mode
            this.loadVromBank(this.latchLoVal1, 0x0000)
            this.latchLo = 0xFD

        }
        else if ((address & 0x1FF0) === 0x0FE0 && this.latchLo !== 0xFE) {

            // Set $FE mode
            this.loadVromBank(this.latchLoVal2, 0x0000)
            this.latchLo = 0xFE
        }
        else if ((address & 0x1FF0) === 0x1FD0 && this.latchHi !== 0xFD) {

            // Set $FD mode
            this.loadVromBank(this.latchHiVal1, 0x1000)
            this.latchHi = 0xFD
        }
        else if ((address & 0x1FF0) === 0x1FE0 && this.latchHi !== 0xFE) {

            // Set $FE mode
            this.loadVromBank(this.latchHiVal2, 0x1000)
            this.latchHi = 0xFE
        }
    }

    toJSON() {
        const s = Mappers[0].prototype.toJSON.apply(this)

        s.latchLo = this.latchLo
        s.latchHi = this.latchHi
        s.latchLoVal1 = this.latchLoVal1
        s.latchLoVal2 = this.latchLoVal2
        s.latchHiVal1 = this.latchHiVal1
        s.latchHiVal2 = this.latchHiVal2

        return s
    }

    fromJSON(s: Mapper9) {

        Mappers[0].prototype.fromJSON.apply(this, [s])
        this.latchLo = s.latchLo
        this.latchHi = s.latchHi
        this.latchLoVal1 = s.latchLoVal1 
        this.latchLoVal2 = s.latchLoVal2 
        this.latchHiVal1 = s.latchHiVal1 
        this.latchHiVal2 = s.latchHiVal2 

    }
}

class Mapper11 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {
        if (address < 0x8000) {
            super.write.apply(this, [address, value])

            return
        }
        else {

            // Swap in the given PRG-ROM bank:
            const prgbank1 = (value & 0xf) * 2 % this.nes.rom.romCount
            const prgbank2 = ((value & 0xf) * 2 + 1) % this.nes.rom.romCount
      
            this.loadRomBank(prgbank1, 0x8000)
            this.loadRomBank(prgbank2, 0xc000)
      
            if (this.nes.rom.vromCount > 0) {

                // Swap in the given VROM bank at 0x0000:
                const bank = (value >> 4) * 2 % this.nes.rom.vromCount
                this.loadVromBank(bank, 0x0000)
                this.loadVromBank(bank + 1, 0x1000)
            }
        }
    }
}

class Mapper34 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {
        if (address < 0x8000) {
            super.write.apply(this, [address, value])

            return
        }
        else {
            this.load32kRomBank(value, 0x8000)
        }
    }
}

class Mapper38 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {
        if (address < 0x7000 || address > 0x7fff) {
            super.write.apply(this, [address, value])

            return
        }
        else {

            // Swap in the given PRG-ROM bank at 0x8000:
            this.load32kRomBank(value & 3, 0x8000)
      
            // Swap in the given VROM bank at 0x0000:
            this.load8kVromBank((value >> 2 & 3) * 2, 0x0000)
        }
    }
}

class Mapper66 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {
        if (address < 0x8000) {
            super.write.apply(this, [address, value])

            return
        }
        else {

            // Swap in the given PRG-ROM bank at 0x8000:
            this.load32kRomBank(value >> 4 & 3, 0x8000)
      
            // Swap in the given VROM bank at 0x0000:
            this.load8kVromBank((value & 3) * 2, 0x0000)
        }
    }
}

class Mapper94 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            super.write.apply(this, [address, value])

            return
        }
        else {

            // This is a ROM bank select command.
            // Swap in the given ROM bank at 0x8000:
            this.loadRomBank(value >> 2, 0x8000)
        }
    }

    loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('UN1ROM: Invalid ROM! Unable to load.')
        }
      
        // Load PRG-ROM:
        this.loadRomBank(0, 0x8000)
        this.loadRomBank(this.nes.rom.romCount - 1, 0xc000)
      
        // Load CHR-ROM:
        this.loadCHRROM()
      
        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

class Mapper140 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {
        if (address < 0x6000 || address > 0x7fff) {
            super.write.apply(this, [address, value])

            return
        }
        else {

            // Swap in the given PRG-ROM bank at 0x8000:
            this.load32kRomBank(value >> 4 & 3, 0x8000)
      
            // Swap in the given VROM bank at 0x0000:
            this.load8kVromBank((value & 0xf) * 2, 0x0000)
        }
    }
}

class Mapper180 extends Mapper0 {
    constructor(public nes: NES) {
        super(nes)
    }

    write(address: number, value: number) {

        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            super.write.apply(this, [address, value])

            return
        }
        else {

            // This is a ROM bank select command.
            // Swap in the given ROM bank at 0xc000:
            this.loadRomBank(value, 0xc000)
        }
    }

    loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('Mapper 180: Invalid ROM! Unable to load.')
        }
      
        // Load PRG-ROM:
        this.loadRomBank(0, 0x8000)
        this.loadRomBank(this.nes.rom.romCount - 1, 0xc000)
      
        // Load CHR-ROM:
        this.loadCHRROM()
      
        // Do Reset-Interrupt:
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
}

const Mappers: MappersType = { 
    0: Mapper0,
    1: Mapper1,
    3: Mapper3,
    4: Mapper4,
    5: Mapper5,
    7: Mapper7,
    9: Mapper9,
    11: Mapper11,
    34: Mapper34,
    38: Mapper38,
    66: Mapper66,
    94: Mapper94,
    140: Mapper140,
    180: Mapper180,
}

export { Mappers }
