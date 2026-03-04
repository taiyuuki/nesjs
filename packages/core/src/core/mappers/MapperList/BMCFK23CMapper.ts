/**
 * BMCFK23C - Mapper 176
 *
 * Used by many Chinese multicarts and games.
 * Simple implementation compatible with both Mapper176 and BMCFK23C ROMs.
 *
 * Registers:
 * - $5001: PRG bank (when sbw enabled)
 * - $5010: Control register (write $24 to enable sbw)
 * - $5011: PRG bank (when sbw enabled)
 * - $5012: CHR bank (when sbw enabled)
 * - $5FF1: PRG bank select (32K)
 * - $5FF2: CHR bank select (8K)
 *
 * Reference:
 * - https://www.nesdev.org/wiki/INES_Mapper_176
 * - FCEUX source: boards/176.cpp, boards/fk23c.cpp
 * - VirtuaNES source: Mapper176.cpp
 */

import { Mapper } from '../Mapper'

export default class BMCFK23CMapper extends Mapper {

    // Simple mode banks
    private prgBanks = [0, 1, 0, 0]
    private chrBank = 0
    private sbw = 0 // Software bank write enable

    override loadROM(): void {
        super.loadROM()

        // Initialize banks
        const num8KBanks = this.prgsize >> 13

        this.prgBanks[0] = 0
        this.prgBanks[1] = 1
        this.prgBanks[2] = num8KBanks - 2 & 63
        this.prgBanks[3] = num8KBanks - 1 & 63
        this.chrBank = 0
        this.sbw = 0

        this.sync()
    }

    override reset(): void {
        const num8KBanks = this.prgsize >> 13

        this.prgBanks[0] = 0
        this.prgBanks[1] = 1
        this.prgBanks[2] = num8KBanks - 2 & 63
        this.prgBanks[3] = num8KBanks - 1 & 63
        this.chrBank = 0
        this.sbw = 0

        this.sync()
    }

    private sync(): void {
        this.setPROM8KBank(4, this.prgBanks[0])
        this.setPROM8KBank(5, this.prgBanks[1])
        this.setPROM8KBank(6, this.prgBanks[2])
        this.setPROM8KBank(7, this.prgBanks[3])

        // Only set CHR bank if not using CHR-RAM
        if (!this.haschrram) {
            this.setVROM8KBank(this.chrBank)
        }
    }

    override cartWrite(addr: number, data: number): void {

        // Handle WRAM writes
        if (addr >= 0x6000 && addr < 0x8000) {
            this.prgram[addr & 0x1fff] = data

            return
        }

        switch (addr) {
            case 0x5000:
            case 0x5001:
                if (this.sbw) {
                    const base = data * 4
                    this.prgBanks[0] = base
                    this.prgBanks[1] = base + 1
                    this.prgBanks[2] = base + 2
                    this.prgBanks[3] = base + 3
                    this.sync()
                }

                return

            case 0x5010:
                if (data === 0x24) {
                    this.sbw = 1
                }

                return

            case 0x5011:
                if (this.sbw) {
                    const base = (data >> 1) * 4
                    this.prgBanks[0] = base
                    this.prgBanks[1] = base + 1
                    this.prgBanks[2] = base + 2
                    this.prgBanks[3] = base + 3
                    this.sync()
                }

                return

            case 0x5012:
                if (this.sbw) {
                    this.chrBank = data
                    this.sync()
                }

                return

            case 0x5FF1: {
                const base = (data >> 1) * 4
                this.prgBanks[0] = base
                this.prgBanks[1] = base + 1
                this.prgBanks[2] = base + 2
                this.prgBanks[3] = base + 3
                this.sync()

                return
            }

            case 0x5FF2:
                this.chrBank = data
                this.sync()

                return
        }
    }

    protected override postLoadState(): void {
        this.sync()
    }
}
