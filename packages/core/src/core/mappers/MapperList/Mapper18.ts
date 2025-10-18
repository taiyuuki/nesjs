import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper18 extends Mapper {
    reg = new Uint8Array(11)
    irqEnable = 0
    irqMode = 0
    irqCounter = 0xFFFF
    irqLatch = 0xFFFF

    override loadROM(): void {
        super.loadROM()
        
        for (let i = 0; i < 11; ++i) {
            this.reg[i] = 0
        }

        // Initialize PRG banks according to power-up state
        // Bank 0 at $8000, Bank 1 at $A000, Bank 2 at $C000, last bank fixed at $E000
        this.setPROM8KBank(4, 0)
        this.setPROM8KBank(5, 1)
        this.setPROM8KBank(6, 2)
        this.setPROM8KBank(7, this.getPROM8KSize() - 1)
        
        // Initialize CHR banks to sequential mapping
        // Some games only update specific banks, so we need proper defaults
        this.reg[3] = 0
        this.reg[4] = 1
        this.reg[5] = 2
        this.reg[6] = 3
        this.reg[7] = 4
        this.reg[8] = 5
        this.reg[9] = 4 // Banks 6-7 mirror banks 4-5
        this.reg[10] = 5
        
        for (let i = 0; i < 8; i++) {
            this.setVROM1KBank(i, this.reg[3 + i])
        }
    }

    override cartWrite(addr: number, data: number): void {

        // Handle PRG RAM writes ($6000-$7FFF)
        if (addr >= 0x6000 && addr < 0x8000) {
            super.cartWrite(addr, data)

            return
        }

        // Mapper decodes A12-A14 and A0-A1
        // A0: distinguishes low/high nibble
        // A1: distinguishes between two registers in each range
        const isHighNibble = (addr & 1) === 1
        const regOffset = (addr & 2) >> 1 // 0 for $xxx0/$xxx1, 1 for $xxx2/$xxx3
        
        if (addr >= 0x8000 && addr <= 0x8003) {

            // $8000-$8001: PRG ROM Bank 0 ($8000-$9FFF)
            // $8002-$8003: PRG ROM Bank 1 ($A000-$BFFF)
            const regIndex = regOffset
            if (isHighNibble) {
                this.reg[regIndex] = this.reg[regIndex] & 0x0F | (data & 0x0F) << 4
                this.setPROM8KBank(4 + regIndex, this.reg[regIndex])
            }
            else {
                this.reg[regIndex] = this.reg[regIndex] & 0xF0 | data & 0x0F
            }
        }
        else if (addr >= 0x9000 && addr <= 0x9003) {

            // $9000-$9001: PRG ROM Bank 2 ($C000-$DFFF) 
            // $9002-$9003: (unused or PRG RAM control)
            if (regOffset === 0) {
                if (isHighNibble) {
                    this.reg[2] = this.reg[2] & 0x0F | (data & 0x0F) << 4
                    this.setPROM8KBank(6, this.reg[2])
                }
                else {
                    this.reg[2] = this.reg[2] & 0xF0 | data & 0x0F
                }
            }
        }
        else if (addr >= 0xA000 && addr <= 0xA003) {

            // $A000-$A001: CHR Bank 0 (PPU $0000-$03FF)
            // $A002-$A003: CHR Bank 1 (PPU $0400-$07FF)
            const chrIndex = regOffset
            if (isHighNibble) {
                this.reg[3 + chrIndex] = this.reg[3 + chrIndex] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(chrIndex, this.reg[3 + chrIndex])
            }
            else {
                this.reg[3 + chrIndex] = this.reg[3 + chrIndex] & 0xF0 | data & 0x0F
            }
        }
        else if (addr >= 0xB000 && addr <= 0xB003) {

            // $B000-$B001: CHR Bank 2 (PPU $0800-$0BFF)
            // $B002-$B003: CHR Bank 3 (PPU $0C00-$0FFF)
            const chrIndex = 2 + regOffset
            if (isHighNibble) {
                this.reg[3 + chrIndex] = this.reg[3 + chrIndex] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(chrIndex, this.reg[3 + chrIndex])
            }
            else {
                this.reg[3 + chrIndex] = this.reg[3 + chrIndex] & 0xF0 | data & 0x0F
            }
        }
        else if (addr >= 0xC000 && addr <= 0xC003) {

            // $C000-$C001: CHR Bank 4 (PPU $1000-$13FF)
            // $C002-$C003: CHR Bank 5 (PPU $1400-$17FF)
            const chrIndex = 4 + regOffset
            if (isHighNibble) {
                this.reg[3 + chrIndex] = this.reg[3 + chrIndex] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(chrIndex, this.reg[3 + chrIndex])
            }
            else {
                this.reg[3 + chrIndex] = this.reg[3 + chrIndex] & 0xF0 | data & 0x0F
            }
        }
        else if (addr >= 0xD000 && addr <= 0xD003) {

            // $D000-$D001: CHR Bank 6 (PPU $1800-$1BFF)
            // $D002-$D003: CHR Bank 7 (PPU $1C00-$1FFF)
            const chrIndex = 6 + regOffset
            if (isHighNibble) {
                this.reg[3 + chrIndex] = this.reg[3 + chrIndex] & 0x0F | (data & 0x0F) << 4
                this.setVROM1KBank(chrIndex, this.reg[3 + chrIndex])
            }
            else {
                this.reg[3 + chrIndex] = this.reg[3 + chrIndex] & 0xF0 | data & 0x0F
            }
        }
        else if (addr >= 0xE000 && addr <= 0xE003) {

            // IRQ reload value: 16-bit split into 4 nibbles
            // $E000: bits 0-3,  $E001: bits 4-7
            // $E002: bits 8-11, $E003: bits 12-15
            if (regOffset === 0) {
                if (isHighNibble) {

                    // $E001: bits 4-7
                    this.irqLatch = this.irqLatch & 0xFF0F | (data & 0x0F) << 4
                }
                else {

                    // $E000: bits 0-3
                    this.irqLatch = this.irqLatch & 0xFFF0 | data & 0x0F
                }
            }
            else if (isHighNibble) {

                // $E003: bits 12-15
                this.irqLatch = this.irqLatch & 0x0FFF | (data & 0x0F) << 12
            }
            else {

                // $E002: bits 8-11
                this.irqLatch = this.irqLatch & 0xF0FF | (data & 0x0F) << 8
            }
        }
        else if (addr >= 0xF000 && addr <= 0xF003) {

            // IRQ Control: any write reloads counter and acks IRQ
            if (isHighNibble) {

                // $F001/$F003: IRQ counter size/mode/enable
                this.irqMode = data >> 1 & 0x07
                this.irqEnable = data & 0x01
            }
            
            // $F000: just reload
            // $F002: reload + set mirroring
            if (regOffset === 1 && !isHighNibble) {
                const mirrorMode = data & 0x03
                if (mirrorMode === 0) {
                    this.setmirroring(MirrorType.H_MIRROR)
                }
                else if (mirrorMode === 1) {
                    this.setmirroring(MirrorType.V_MIRROR)
                }
                else {
                    this.setmirroring(MirrorType.FOUR_SCREEN_MIRROR)
                }
            }

            // Any write to $F000-$F003 reloads counter and acks IRQ
            this.irqCounter = this.irqLatch
            this.cpu!.interrupt = 0
        }
    }

    override cpucycle(cycles: number): void {
        if (!this.irqEnable) {
            return
        }

        for (let i = 0; i < cycles; i++) {
            if (this.irqCounter === 0) {
                continue
            }

            const oldCounter = this.irqCounter
            this.irqCounter--

            // Check for IRQ trigger based on mode
            let shouldTrigger = false

            if (this.irqMode === 0) {

                // Mode 0: Trigger when counter reaches 0
                shouldTrigger = this.irqCounter === 0
            }
            else {

                // Mode with mask: Trigger when masked bits change
                let mask = 0xFFFF
                if (this.irqMode & 0x04) {
                    mask = 0xFFF0 // 16-bit mode, trigger every 16 counts
                }
                else if (this.irqMode & 0x02) {
                    mask = 0xFF00 // 8-bit mode, trigger every 256 counts
                }
                else if (this.irqMode & 0x01) {
                    mask = 0xF000 // 4-bit mode, trigger every 4096 counts
                }

                shouldTrigger = (this.irqCounter & mask) !== (oldCounter & mask)
            }

            this.irqCounter &= 0xFFFF

            if (shouldTrigger) {
                this.cpu!.interrupt++
                this.irqEnable = 0
                break
            }
        }
    }
}
