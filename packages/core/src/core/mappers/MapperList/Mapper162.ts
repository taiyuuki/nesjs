/**
 * Mapper 162 - UNLFS304 (南晶 FS304 board)
 *
 * 用于南晶科技的部分游戏，包括：
 * - Xi You Ji Hou Zhuan (西游记后传) (ES1097)
 *
 * Banks:
 * - CPU $6000-$7FFF: 8KB PRG-RAM (battery-backed)
 * - CPU $8000-$FFFF: 32KB switchable PRG-ROM bank
 * - PPU $0000-$1FFF: 8KB CHR-RAM
 *
 * Registers:
 * - $5000: reg[0]
 * - $5100: reg[1]
 * - $5200: reg[2]
 * - $5300: reg[3] (mode register)
 *
 * Bank switching modes (reg[3] & 7):
 * - 0, 2: bank = (reg[0] & 0x0C) | (reg[1] & 0x02) | ((reg[2] & 0x0F) << 4)
 * - 1, 3: bank = (reg[0] & 0x0C) | ((reg[2] & 0x0F) << 4)
 * - 4, 6: bank = (reg[0] & 0x0E) | ((reg[1] >> 1) & 0x01) | ((reg[2] & 0x0F) << 4)
 * - 5, 7: bank = (reg[0] & 0x0F) | ((reg[2] & 0x0F) << 4)
 *
 * Reference:
 * - FCEUX source: boards/164.cpp (UNLFS304_Init)
 */

import { Mapper } from '../Mapper'

export default class Mapper162 extends Mapper {

    // Registers
    // reg[0] = $5000
    // reg[1] = $5100
    // reg[2] = $5200
    // reg[3] = $5300 (mode)
    // Initial values.
    // Power3: reg[0]=3, reg[1]=0, reg[2]=0, reg[3]=7
    private reg = [3, 0, 0, 7]

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

            // reg[(A >> 8) & 3] = V
            // $5000 → reg[0], $5100 → reg[1], $5200 → reg[2], $5300 → reg[3]
            const regIndex = addr >> 8 & 3
            this.reg[regIndex] = data
            this.syncPRG()

            return
        }

        super.cartWrite(addr, data)
    }

    private syncPRG(): void {

        // Bank switching based on mode (reg[3] & 7)
        let bank: number
        const mode = this.reg[3] & 7

        switch (mode) {
            case 0:
            case 2:
                bank = this.reg[0] & 0x0C | this.reg[1] & 0x02 | (this.reg[2] & 0x0F) << 4
                break
            case 1:
            case 3:
                bank = this.reg[0] & 0x0C | (this.reg[2] & 0x0F) << 4
                break
            case 4:
            case 6:
                bank = this.reg[0] & 0x0E | this.reg[1] >> 1 & 0x01 | (this.reg[2] & 0x0F) << 4
                break
            case 5:
            case 7:
            default:
                bank = this.reg[0] & 0x0F | (this.reg[2] & 0x0F) << 4
                break
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

    override reset(): void {

        // Initial value
        this.reg = [3, 0, 0, 7]
        this.syncPRG()
    }
}
