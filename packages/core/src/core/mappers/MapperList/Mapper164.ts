/**
 * Mapper 164 - 南晶 (Nánjīng) Pocket Monster Gold
 *
 * 用于南晶科技的部分游戏，包括：
 * - Pocket Monster Gold
 *
 * Banks:
 * - CPU $6000-$7FFF: 8KB PRG-RAM (battery-backed)
 * - CPU $8000-$FFFF: 32KB switchable PRG-ROM bank
 * - PPU $0000-$1FFF: 8KB CHR-RAM
 *
 * Registers:
 * - $5000: reg[1] - PRG Bank Low bits
 * - $5100: reg[0] - PRG Bank High bits
 * - $5200: reg[3] - PRG Bank High bits (alternate)
 * - $5300: reg[2] - Mode register (no WSync on write)
 *
 * Bank calculation: bank = (reg[0] << 4) | (reg[1] & 0xF)
 *
 * Reference:
 * - FCEUX source: boards/164.cpp (Mapper164_Init)
 */

import { Mapper } from '../Mapper'

export default class Mapper164 extends Mapper {

    // Registers
    // reg[0] = $5100 (PRG Bank High)
    // reg[1] = $5000 (PRG Bank Low)
    // reg[2] = $5300 (Mode register)
    // reg[3] = $5200 (PRG Bank High alternate)
    // Initial values
    private reg = [0, 0xFF, 0, 0]

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

        // PRG-ROM at $8000-$FFFF
        if (addr >= 0x8000) {
            const prgAddr = this.prg_map[(addr & 0x7FFF) >> 10] + (addr & 0x3FF)

            return this.prg[prgAddr]
        }

        return super.cartRead(addr)
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

        const maskedAddr = addr & 0x7300

        switch (maskedAddr) {
            case 0x5100: // $5100 - PRG Bank High (reg[0])
                this.reg[0] = data
                this.syncPRG()
                break

            case 0x5000: // $5000 - PRG Bank Low (reg[1])
                this.reg[1] = data
                this.syncPRG()
                break

            case 0x5300: // $5300 - Mode register (reg[2]) - no WSync
                this.reg[2] = data
                break

            case 0x5200: // $5200 - PRG Bank High alternate (reg[3])
                this.reg[3] = data
                this.syncPRG()
                break
        }
    }

    private syncPRG(): void {
        const bank = (this.reg[0] << 4 | this.reg[1] & 0xF) & 0xFF
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

    override reset(): void {

        this.reg = [0, 0xFF, 0, 0]
        this.syncPRG()
    }
}
