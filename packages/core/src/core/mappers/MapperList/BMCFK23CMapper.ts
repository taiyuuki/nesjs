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
 * - $5FF1: PRG bank select (32K)
 * - $5FF2: CHR bank select (8K)
 *
 * Extended mode (for large multicarts):
 * - $5FF0: Mode control register
 *   - &7 == 4: 32K PRG mode
 *   - &7 == 3: 16K PRG mode
 *   - &0x40: 8K CHR mode
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

    // Extended mode (for large multicarts)
    // expRegs[0]: Mode control ($5FF0)
    // expRegs[1]: PRG bank select ($5FF1)
    // expRegs[2]: CHR base/select ($5FF2)
    // expRegs[3]: Extra control ($5FF3)
    // expRegs[6], expRegs[7]: Extra CHR banks for special mode
    private expRegs = [0, 0, 0, 0, 0, 0, 0, 0]
    private dipSwitch = 0 // Allow all $5FFx and $501x writes

    // Simple Mapper176 mode
    private sbw = 0 // Special banking write enable flag

    // MMC3 state
    private mmc3BankRegister = 0
    private mmc3PrgConfig = false
    private mmc3ChrConfig = false
    private mmc3PrgBank6 = 0
    private mmc3ChrRegs = [0, 0, 0, 0, 0, 0]

    // MMC3 IRQ state
    private irqReloadValue = 0
    private irqCounter = 0
    private irqEnabled = false
    private irqReloadPending = false
    private irqTriggered = false
    private lastA12 = false

    override loadROM(): void {
        super.loadROM()

        const num8KBanks = this.prgsize >> 13

        this.prgBanks[0] = 0
        this.prgBanks[1] = 1
        this.prgBanks[2] = num8KBanks - 2 & 63
        this.prgBanks[3] = num8KBanks - 1 & 63
        this.expRegs = [0, 0, 0, 0, 0, 0, 0, 0]

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
    }

    override cartWrite(addr: number, data: number): void {

        // Handle WRAM writes
        if (addr >= 0x6000 && addr < 0x8000) {
            this.prgram[addr & 0x1fff] = data

            return
        }

        // Handle extended registers ($5000-$5FFF)
        if (addr >= 0x5000 && addr < 0x6000) {
            this.handleExpWrite(addr, data)

            return
        }

        // Handle MMC3 registers ($8000-$FFFF)
        if (addr >= 0x8000 && addr <= 0xFFFF) {
            this.handleMMC3Write(addr, data)

            return
        }
    }

    private handleExpWrite(addr: number, data: number): void {

        // Dipswitch check: only allow writes if the corresponding bit is set
        // FCEUX: if(A&(1<<(dipswitch+4)))
        const dipMask = 1 << this.dipSwitch + 4
        if (!(addr & dipMask)) {
            return
        }

        // Store in expRegs based on address low 3 bits (for full 8 registers)
        const regIndex = addr & 7
        this.expRegs[regIndex] = data

        const mode = this.expRegs[0] & 7

        // 32K PRG mode
        if (mode === 4) {
            const bank = this.expRegs[1] >> 1
            this.prgBanks[0] = bank * 4
            this.prgBanks[1] = bank * 4 + 1
            this.prgBanks[2] = bank * 4 + 2
            this.prgBanks[3] = bank * 4 + 3
            this.syncBanks()

            // Also update CHR if in 8K mode
            this.updateMMC3ChrBanks()
        }

        // 16K PRG mode
        else if (mode === 3) {
            const bank = this.expRegs[1]

            // FCEUX mirrors the 16K bank to both $8000-$BFFF and $C000-$FFFF
            this.prgBanks[0] = bank * 2
            this.prgBanks[1] = bank * 2 + 1
            this.prgBanks[2] = bank * 2
            this.prgBanks[3] = bank * 2 + 1
            this.syncBanks()

            // Also update CHR if in 8K mode
            this.updateMMC3ChrBanks()
        }

        // MMC3 extended mode (1, 2)
        else if (mode === 1 || mode === 2) {

            // In MMC3 extended mode, update banks using MMC3 registers with extended addressing
            this.updateMMC3PrgBanks()
            this.updateMMC3ChrBanks()
        }

        // Mode 0: Simple Mapper176 mode - handle $5FF1/$5FF2 directly
        else {

            // Simple Mapper176: $5FF1 = 32K PRG bank, $5FF2 = 8K CHR bank
            // Also handle $5001/$5010/$5011/$5012 when sbw is enabled
            if (addr === 0x5FF1) {
                const base = (data >> 1) * 4
                this.prgBanks[0] = base
                this.prgBanks[1] = base + 1
                this.prgBanks[2] = base + 2
                this.prgBanks[3] = base + 3
                this.syncBanks()
            }
            else if (addr === 0x5FF2) {
                if (!this.haschrram) {
                    this.setVROM8KBank(data)
                }
            }
            else if (addr === 0x5000 || addr === 0x5001) {
                if (this.sbw) {
                    const base = data * 4
                    this.prgBanks[0] = base
                    this.prgBanks[1] = base + 1
                    this.prgBanks[2] = base + 2
                    this.prgBanks[3] = base + 3
                    this.syncBanks()
                }
            }
            else if (addr === 0x5010) {
                if (data === 0x24) {
                    this.sbw = 1
                }
            }
            else if (addr === 0x5011) {
                if (this.sbw) {
                    const base = (data >> 1) * 4
                    this.prgBanks[0] = base
                    this.prgBanks[1] = base + 1
                    this.prgBanks[2] = base + 2
                    this.prgBanks[3] = base + 3
                    this.syncBanks()
                }
            }
            else if (addr === 0x5012) {
                if (this.sbw && !this.haschrram) {
                    this.setVROM8KBank(data)
                }
            }

            // For mode 0, only update CHR if 8K CHR mode (bit 6) is set
            if (this.expRegs[0] & 0x40) {
                this.updateMMC3ChrBanks()
            }
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

            case 0xC000:
                if (isEven) {

                    // IRQ Latch register ($C000)
                    this.irqReloadValue = data
                }
                else {

                    // IRQ Reload ($C001) - sets reload flag
                    this.irqReloadPending = true
                }
                break

            case 0xE000:
                if (isEven) {

                    // IRQ Control Reg 0 (disable)
                    if (this.irqTriggered) {
                        --this.cpu!.interrupt
                    }
                    this.irqTriggered = false
                    this.irqEnabled = false
                }
                else {

                    // IRQ Control Reg 1 (enable)
                    this.irqEnabled = true
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
                this.updateMMC3PrgBanks() // Use extended addressing
                break
        }
    }

    private updateMMC3ChrBanks(): void {
        if (this.chrsize === 0) return

        // 8K CHR mode when bit 6 is set
        if (this.expRegs[0] & 0x40) {
            const chrBank = this.expRegs[2] & 0x3F
            this.setVROM8KBank(chrBank)

            return
        }

        // CHR-RAM mode when bit 5 is set (handled by haschrram)
        if (this.expRegs[0] & 0x20) {
            return
        }

        // Get CHR base from expRegs[2] (bits 0-6 shifted left by 3 for 1K banks)
        const chrBase = (this.expRegs[2] & 0x7F) << 3

        // Check for special CHR mode (EXPREGS[3] & 2)
        // In this mode, the second 1K bank of each 2K pair uses expRegs[6]/expRegs[7]
        if (this.expRegs[3] & 2) {

            // cbase determines which half of PPU CHR space gets the 2K banks
            // (MMC3_cmd & 0x80) << 5 = 0 for mode 0, 0x1000 for mode 1
            const cbase = this.mmc3ChrConfig ? 0x1000 : 0

            // Set the 1K banks
            // The 2K bank regions use DRegBuf[0]/expRegs[6] and DRegBuf[1]/expRegs[7]
            if (cbase === 0) {

                // CHR mode 0: 2K banks at $0000-$0FFF
                this.setppubank(1, 0, chrBase | this.mmc3ChrRegs[0])
                this.setppubank(1, 1, chrBase | this.expRegs[6])
                this.setppubank(1, 2, chrBase | this.mmc3ChrRegs[1])
                this.setppubank(1, 3, chrBase | this.expRegs[7])

                // 1K banks at $1000-$1FFF
                this.setppubank(1, 4, chrBase | this.mmc3ChrRegs[2])
                this.setppubank(1, 5, chrBase | this.mmc3ChrRegs[3])
                this.setppubank(1, 6, chrBase | this.mmc3ChrRegs[4])
                this.setppubank(1, 7, chrBase | this.mmc3ChrRegs[5])
            }
            else {

                // CHR mode 1: 1K banks at $0000-$0FFF
                this.setppubank(1, 0, chrBase | this.mmc3ChrRegs[2])
                this.setppubank(1, 1, chrBase | this.mmc3ChrRegs[3])
                this.setppubank(1, 2, chrBase | this.mmc3ChrRegs[4])
                this.setppubank(1, 3, chrBase | this.mmc3ChrRegs[5])

                // 2K banks at $1000-$1FFF
                this.setppubank(1, 4, chrBase | this.mmc3ChrRegs[0])
                this.setppubank(1, 5, chrBase | this.expRegs[6])
                this.setppubank(1, 6, chrBase | this.mmc3ChrRegs[1])
                this.setppubank(1, 7, chrBase | this.expRegs[7])
            }
        }
        else 

            // Standard MMC3 CHR banking with extended addressing
            if (this.mmc3ChrConfig) {
                this.setppubank(1, 0, chrBase | this.mmc3ChrRegs[2])
                this.setppubank(1, 1, chrBase | this.mmc3ChrRegs[3])
                this.setppubank(1, 2, chrBase | this.mmc3ChrRegs[4])
                this.setppubank(1, 3, chrBase | this.mmc3ChrRegs[5])
                this.setppubank(2, 4, chrBase | this.mmc3ChrRegs[0])
                this.setppubank(2, 6, chrBase | this.mmc3ChrRegs[1])
            }
            else {
                this.setppubank(2, 0, chrBase | this.mmc3ChrRegs[0])
                this.setppubank(2, 2, chrBase | this.mmc3ChrRegs[1])
                this.setppubank(1, 4, chrBase | this.mmc3ChrRegs[2])
                this.setppubank(1, 5, chrBase | this.mmc3ChrRegs[3])
                this.setppubank(1, 6, chrBase | this.mmc3ChrRegs[4])
                this.setppubank(1, 7, chrBase | this.mmc3ChrRegs[5])
            }
        
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }

    private updateMMC3PrgBanks(): void {

        // In extended MMC3 mode, incorporate expRegs[1] for extended addressing
        const mode = this.expRegs[0] & 3
        const num8KBanks = this.prgsize >> 13
        const lastBank = num8KBanks - 1
        const secondLastBank = num8KBanks - 2

        // Determine bank values based on MMC3 config
        let bank4: number, 
            bank6: number

        if (this.mmc3PrgConfig) {

            // Inverted mode: $8000 fixed to 2nd last, $C000 switchable
            bank4 = secondLastBank
            bank6 = this.mmc3PrgBank6
        }
        else {

            // Normal mode: $8000 switchable, $C000 fixed to 2nd last
            bank4 = this.mmc3PrgBank6
            bank6 = secondLastBank
        }

        // Bank 5 is always switchable (register 7)
        let bank5 = this.prgBanks[1]

        // Bank 7 is always fixed to last bank
        let bank7 = lastBank

        // Apply extended addressing if mode is non-zero
        if (mode) {
            const blocksize = 6 - mode
            const mask = (1 << blocksize) - 1
            const extendedBase = this.expRegs[1] << 1
            bank4 = bank4 & mask | extendedBase
            bank5 = bank5 & mask | extendedBase
            bank6 = bank6 & mask | extendedBase
            bank7 = bank7 & mask | extendedBase
        }

        this.setPROM8KBank(4, bank4)
        this.setPROM8KBank(5, bank5)
        this.setPROM8KBank(6, bank6)
        this.setPROM8KBank(7, bank7)
    }

    // MMC3 IRQ support - A12 monitoring for scanline detection
    override ppuRead(addr: number): number {

        // Only check A12 for CHR region accesses ($0000-$1FFF)
        if (addr < 0x2000) {
            this.checkA12(addr)
        }

        return super.ppuRead(addr)
    }

    override ppuWrite(addr: number, data: number): void {

        // Only check A12 for CHR region accesses ($0000-$1FFF)
        if (addr < 0x2000) {
            this.checkA12(addr)
        }
        super.ppuWrite(addr, data)
    }

    override checkA12(addr: number): void {
        const a12 = (addr & Utils.BIT12) !== 0

        // Detect rising edge: A12 transitions from 0 to 1
        if (a12 && !this.lastA12) {
            this.clockScanCounter()
        }
        this.lastA12 = a12
    }

    private clockScanCounter(): void {
        if (this.irqCounter === 0 || this.irqReloadPending) {
            this.irqCounter = this.irqReloadValue
            this.irqReloadPending = false
        }
        else {
            --this.irqCounter

            if (this.irqCounter === 0 && this.irqEnabled && !this.irqTriggered) {
                ++this.cpu!.interrupt
                this.irqTriggered = true
            }
        }
    }
}
