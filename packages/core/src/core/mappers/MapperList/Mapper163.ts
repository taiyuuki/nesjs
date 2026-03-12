/**
 * Mapper 163 - 南晶 (Nánjīng) FC-001
 *
 * 用于南晶科技的游戏，包括：
 * - 牧场物语 - Harvest Moon (NJ011)
 * - 水浒神兽 (NJ019)
 * - 暗黑破坏神 - Diablo (NJ037)
 * - 轩辕剑外传 之 天之痕 (NJ045)
 * - Final Fantasy IV (NJ098)
 *
 * Banks:
 * - CPU $6000-$7FFF: 8KB PRG-RAM (battery-backed)
 * - CPU $8000-$FFFF: 32KB switchable PRG-ROM bank
 * - PPU $0000-$1FFF: 8KB CHR-RAM (4KB can be auto-switched)
 * - Nametable mirroring: hard-wired
 *
 * Registers:
 * - $5000: PRG Bank Low (bits 3-0) / CHR-RAM Auto-switch (bit 7)
 * - $5100: Feedback register
 * - $5101: Strobe for trigger mechanism
 * - $5200: PRG Bank High (bits 3-0)
 * - $5300: Mode register
 *
 * Reference:
 * - https://www.nesdev.org/wiki/INES_Mapper_163
 * - FCEUX source: boards/164.cpp (Mapper163_Init)
 */

import { Mapper } from '../Mapper'

export default class Mapper163 extends Mapper {

    // Registers
    // reg[0] = $5200 (PRG Bank High)
    // reg[1] = $5000 (PRG Bank Low / CHR-RAM Switch)
    // reg[2] = $5300 (Mode register)
    // reg[3] = $5100 (Feedback)
    // Note: All registers initialize to $00 on reset (nesdev)
    private reg = [0, 0, 0, 0]

    // Feedback mechanism for copy protection
    private lastStrobe = true
    private trigger = false

    // CHR auto-switch state
    private chrBank = 0

    override loadROM(): void {
        super.loadROM()

        // 8KB CHR-RAM
        this.haschrram = true
        if (this.chrsize === 0) {
            this.chrsize = 8192
            this.chr = new Array(8192).fill(0)
        }

        // Initialize PRG bank mapping
        this.syncPRG()
    }

    override cartRead(addr: number): number {

        // PRG-RAM at $6000-$7FFF
        if (addr >= 0x6000 && addr < 0x8000) {
            return this.prgram[addr & 0x1FFF]
        }

        // Read at $5000-$5FFF range
        if (addr >= 0x5000 && addr < 0x6000) {
            return this.readLow(addr)
        }

        // PRG-ROM at $8000-$FFFF
        if (addr >= 0x8000) {
            const prgAddr = this.prg_map[(addr & 0x7FFF) >> 10] + (addr & 0x3FF)

            return this.prg[prgAddr]
        }

        return super.cartRead(addr)
    }

    private readLow(addr: number): number {
        switch (addr & 0x7700) {
            case 0x5100:

                return this.reg[2] | this.reg[0] | this.reg[1] | this.reg[3] ^ 0xFF

            case 0x5500:

                // Trigger read for copy protection
                if (this.trigger) {
                    return this.reg[2] | this.reg[1]
                }

                return 0
        }

        return 4
    }

    override cartWrite(addr: number, data: number): void {

        // PRG-RAM at $6000-$7FFF
        if (addr >= 0x6000 && addr < 0x8000) {
            this.prgram[addr & 0x1FFF] = data

            return
        }

        // Register writes at $5000-$5FFF
        if (addr >= 0x5000 && addr < 0x6000) {
            this.handleRegisterWrite(addr, data)

            return
        }

        super.cartWrite(addr, data)
    }

    private handleRegisterWrite(addr: number, data: number): void {

        // Handle $5101 separately for trigger mechanism (before $5100 mask)
        if (addr === 0x5101) {
            if (this.lastStrobe && !(data & 1)) {
                this.trigger = !this.trigger
            }
            this.lastStrobe = (data & 1) !== 0

            return
        }

        // Handle $5100 protection check
        if (addr === 0x5100 && data === 6) {

            // Protected games: write 6 to $5100 forces bank 3
            this.setprg32(3)

            return
        }

        const maskedAddr = addr & 0x7300

        switch (maskedAddr) {
            case 0x5200: // $5200 - PRG Bank High (reg[0])
                this.reg[0] = data
                this.syncPRG()
                break

            case 0x5000: // $5000 - PRG Bank Low / CHR-RAM Switch (reg[1])
                this.reg[1] = data
                this.syncPRG()

                // CHR auto-switch: if bit 7 is clear, reset chrBank
                if (!(data & 0x80)) {
                    this.chrBank = 0
                }
                break

            case 0x5300: // $5300 - Mode register (reg[2])
                this.reg[2] = data

                break

            case 0x5100: // $5100 - Feedback (reg[3])
                this.reg[3] = data
                this.syncPRG()
                break
        }
    }

    private syncPRG(): void {

        // Mode register (reg[2] / $5300) bit 2 (A bit):
        // 0: PRG A15/A16 = 11 (force low 2 bits to 3) - boot state
        // 1: PRG A15/A16 from $5000 (normal operation)
        // nesdev: "Because reset clears the A bit, games will boot in 32 KiB PRG-ROM bank #3."
        let bank: number
        if (this.reg[2] & 0x04) {

            // A bit set: use $5000 directly
            bank = (this.reg[0] << 4 | this.reg[1] & 0x0F) & 0xFF
        }
        else {

            // A bit clear: force bits 0-1 to 11 (bank 3)
            bank = (this.reg[0] << 4 | (this.reg[1] & 0x0C | 0x03)) & 0xFF
        }
        this.setprg32(bank)
    }

    private setprg32(bank: number): void {

        // Apply bank mask based on PRG size
        const bankCount = this.prgsize >>> 15 // prgsize / 32KB
        const maskedBank = bank & bankCount - 1

        // Set $8000-$FFFF to the 32KB bank
        const baseOffset = maskedBank * 32768
        for (let i = 0; i < 32; i++) {
            this.prg_map[i] = baseOffset + i * 1024
        }
    }

    override ppuRead(addr: number): number {
        if (addr < 0x2000) {

            // CHR-RAM with auto-switch support
            let adjustedAddr = addr
            if (this.reg[1] & 0x80) {

                // Auto-switch enabled: modify A12 based on chrBank
                adjustedAddr = addr & 0x0FFF | this.chrBank << 12
            }

            return this.chr[adjustedAddr & this.chrsize - 1]
        }

        return super.ppuRead(addr)
    }

    override ppuWrite(addr: number, data: number): void {
        if (addr < 0x2000) {

            // CHR-RAM with auto-switch support
            let adjustedAddr = addr
            if (this.reg[1] & 0x80) {
                adjustedAddr = addr & 0x0FFF | this.chrBank << 12
            }
            this.chr[adjustedAddr & this.chrsize - 1] = data

            return
        }
        super.ppuWrite(addr, data)
    }

    /**
     * Scanline notification for CHR auto-switch
     * Called by PPU at each scanline
     */
    override notifyscanline(scanline: number): void {

        // Auto 4KB CHR-RAM switch when bit 7 of $5000 (reg[1]) is set
        if (this.reg[1] & 0x80) {
            if (scanline === 239) {

                // VBlank line: switch to CHR bank 0 for bottom half
                this.chrBank = 0
            }
            else if (scanline === 127) {

                // Mid-screen: switch to CHR bank 1 for top half
                this.chrBank = 1
            }
        }
    }

    override reset(): void {
        this.reg = [0, 0, 0, 0]
        this.lastStrobe = true
        this.trigger = false
        this.chrBank = 0
        this.syncPRG()
    }
}
