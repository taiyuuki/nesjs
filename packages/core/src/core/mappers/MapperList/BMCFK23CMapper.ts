/**
 * BMCFK23C - Mapper 176
 *
 * Used by many Chinese multicarts and games.
 * Supports both simple Mapper176 ROMs and MMC3-based BMCFK23C ROMs.
 *
 * Simple Mapper176 registers ($5000-$5FFF):
 * - $5000/$5001: PRG bank (when sbw enabled)
 * - $5010: Control register (write $24 to enable sbw)
 * - $5011: PRG bank (when sbw enabled)
 * - $5012: CHR bank (when sbw enabled)
 * - $5013: Extended register
 * - $5FF1: PRG bank select (32K)
 * - $5FF2: CHR bank select (8K)
 *
 * MMC3 registers ($8000-$FFFF):
 * - $8000/$8001: Bank select/data
 * - $A000/$A001: Mirroring/WRAM control
 *
 * Reference:
 * - https://www.nesdev.org/wiki/INES_Mapper_176
 * - FCEUX source: boards/176.cpp, boards/fk23c.cpp
 */

import { Mapper } from '../Mapper'
import { MirrorType, Utils } from '../../types'

export default class BMCFK23CMapper extends Mapper {

    // Simple mode banks (for Mapper176 compatibility)
    private prgBanks = [0, 1, 0, 0]
    private chrBank = 0
    private sbw = 0

    // MMC3 state
    private mmc3BankRegister = 0
    private mmc3PrgConfig = false
    private mmc3ChrConfig = false
    private mmc3PrgBank6 = 0
    private mmc3ChrRegs = [0, 0, 0, 0, 0, 0]

    override loadROM(): void {
        super.loadROM()

        const num8KBanks = this.prgsize >> 13

        this.prgBanks[0] = 0
        this.prgBanks[1] = 1
        this.prgBanks[2] = num8KBanks - 2 & 63
        this.prgBanks[3] = num8KBanks - 1 & 63
        this.chrBank = 0
        this.sbw = 0

        // Initialize MMC3 CHR registers only if CHR-ROM exists
        if (this.chrsize > 0) {
            this.mmc3ChrRegs[0] = 0
            this.mmc3ChrRegs[1] = 2
            this.mmc3ChrRegs[2] = 4
            this.mmc3ChrRegs[3] = 5
            this.mmc3ChrRegs[4] = 6
            this.mmc3ChrRegs[5] = 7
            this.updateMMC3ChrBanks()
        }

        this.syncBanks()
    }

    private syncBanks(): void {
        this.setPROM8KBank(4, this.prgBanks[0])
        this.setPROM8KBank(5, this.prgBanks[1])
        this.setPROM8KBank(6, this.prgBanks[2])
        this.setPROM8KBank(7, this.prgBanks[3])

        // CHR banks are managed separately by simple mode or MMC3 mode
    }

    override cartWrite(addr: number, data: number): void {

        // Handle WRAM writes
        if (addr >= 0x6000 && addr < 0x8000) {
            this.prgram[addr & 0x1fff] = data

            return
        }

        // Handle simple Mapper176 registers ($5000-$5FFF)
        if (addr >= 0x5000 && addr < 0x6000) {
            this.handleMapper176Write(addr, data)

            return
        }

        // Handle MMC3 registers ($8000-$FFFF)
        if (addr >= 0x8000 && addr <= 0xFFFF) {
            this.handleMMC3Write(addr, data)

            return
        }
    }

    private handleMapper176Write(addr: number, data: number): void {
        switch (addr) {
            case 0x5000:
            case 0x5001:
                if (this.sbw) {
                    const base = data * 4
                    this.prgBanks[0] = base
                    this.prgBanks[1] = base + 1
                    this.prgBanks[2] = base + 2
                    this.prgBanks[3] = base + 3
                    this.syncBanks()
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
                    this.syncBanks()
                }

                return

            case 0x5012:
                if (this.sbw) {
                    this.chrBank = data

                    // Only set CHR bank for CHR-ROM (not CHR-RAM)
                    if (!this.haschrram) {
                        this.setVROM8KBank(data)
                    }
                }

                return

            case 0x5FF1: {
                const base = (data >> 1) * 4
                this.prgBanks[0] = base
                this.prgBanks[1] = base + 1
                this.prgBanks[2] = base + 2
                this.prgBanks[3] = base + 3
                this.syncBanks()

                return
            }

            case 0x5FF2:
                this.chrBank = data

                // Only set CHR bank for CHR-ROM (not CHR-RAM)
                if (!this.haschrram) {
                    this.setVROM8KBank(data)
                }

                return
        }
    }

    private handleMMC3Write(addr: number, data: number): void {
        const isEven = (addr & 1) === 0

        switch (addr & 0xE000) {
            case 0x8000:
                if (isEven) {
                    this.mmc3BankRegister = data & 7
                    const newPrgConfig = (data & Utils.BIT6) !== 0
                    const newChrConfig = (data & Utils.BIT7) !== 0
                    if (newPrgConfig !== this.mmc3PrgConfig) {
                        this.mmc3PrgConfig = newPrgConfig
                        this.updateMMC3PrgBanks()
                    }
                    if (newChrConfig !== this.mmc3ChrConfig) {
                        this.mmc3ChrConfig = newChrConfig
                        this.updateMMC3ChrBanks()
                    }
                }
                else {
                    this.executeMMC3Command(this.mmc3BankRegister, data)
                }
                break

            case 0xA000:
                if (isEven) {
                    if (this.scrolltype !== MirrorType.FOUR_SCREEN_MIRROR) {
                        this.setmirroring((data & Utils.BIT0) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
                    }
                }
                break
        }
    }

    private executeMMC3Command(reg: number, data: number): void {
        switch (reg) {
            case 0:
            case 1:
                this.mmc3ChrRegs[reg] = data
                this.updateMMC3ChrBanks()
                break
            case 2:
            case 3:
            case 4:
            case 5:
                this.mmc3ChrRegs[reg] = data
                this.updateMMC3ChrBanks()
                break
            case 6:
                this.mmc3PrgBank6 = data
                this.updateMMC3PrgBanks()
                break
            case 7:
                this.prgBanks[1] = data
                this.setPROM8KBank(5, data)
                break
        }
    }

    private updateMMC3ChrBanks(): void {
        if (this.chrsize === 0) return

        // Use same logic as MMC3Mapper.setupchr()
        if (this.mmc3ChrConfig) {

            // CHR config = 1: PPU 0-3 use 1K banks, PPU 4-7 use 2K banks
            this.setppubank(1, 0, this.mmc3ChrRegs[2])
            this.setppubank(1, 1, this.mmc3ChrRegs[3])
            this.setppubank(1, 2, this.mmc3ChrRegs[4])
            this.setppubank(1, 3, this.mmc3ChrRegs[5])
            this.setppubank(2, 4, this.mmc3ChrRegs[0] >> 1 << 1)
            this.setppubank(2, 6, this.mmc3ChrRegs[1] >> 1 << 1)
        }
        else {

            // CHR config = 0: PPU 0-3 use 2K banks, PPU 4-7 use 1K banks
            this.setppubank(2, 0, this.mmc3ChrRegs[0] >> 1 << 1)
            this.setppubank(2, 2, this.mmc3ChrRegs[1] >> 1 << 1)
            this.setppubank(1, 4, this.mmc3ChrRegs[2])
            this.setppubank(1, 5, this.mmc3ChrRegs[3])
            this.setppubank(1, 6, this.mmc3ChrRegs[4])
            this.setppubank(1, 7, this.mmc3ChrRegs[5])
        }
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }

    private updateMMC3PrgBanks(): void {
        if (this.mmc3PrgConfig) {
            this.setPROM8KBank(4, (this.prgsize >> 13) - 2)
            this.setPROM8KBank(6, this.mmc3PrgBank6)
        }
        else {
            this.setPROM8KBank(4, this.mmc3PrgBank6)
            this.setPROM8KBank(6, (this.prgsize >> 13) - 2)
        }
    }
}
