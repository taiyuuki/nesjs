import { MirrorType } from 'src/core/types'
import MMC3Mapper from './MMC3Mapper'

export default class Mapper74 extends MMC3Mapper {
    private reg = new Uint8Array(8)
    prg0 = 0
    prg1 = 1
                
    chr01 = 0
    chr23 = 2
    chr4 = 4
    chr5 = 5
    chr6 = 6
    chr7 = 7

    irqEnable = 0 // Disable
    irqCounter = 0
    irqLatch = 0
    irqRequest = 0
    patch = 0

    override loadROM(): void {
        super.loadROM()
        this.setBankCPU()
        this.setBankPPU()
        if (this.crc === 0x37ae04a8) {
            this.patch = 1
        }
    }

    override cartWrite(addr: number, data: number): void {
        switch (addr & 0xE001) {
            case 0x8000:
                this.reg[0] = data
                this.setBankCPU()
                this.setBankPPU()
                break
            case 0x8001:
                this.reg[1] = data

                switch (this.reg[0] & 0x07) {
                    case 0x00:
                        this.chr01 = data & 0xFE
                        this.setBankPPU()
                        break
                    case 0x01:
                        this.chr23 = data & 0xFE
                        this.setBankPPU()
                        break
                    case 0x02:
                        this.chr4 = data
                        this.setBankPPU()
                        break
                    case 0x03:
                        this.chr5 = data
                        this.setBankPPU()
                        break
                    case 0x04:
                        this.chr6 = data
                        this.setBankPPU()
                        break
                    case 0x05:
                        this.chr7 = data
                        this.setBankPPU()
                        break
                    case 0x06:
                        this.prg0 = data
                        this.setBankCPU()
                        break
                    case 0x07:
                        this.prg1 = data
                        this.setBankCPU()
                        break
                }
                break
            case 0xA000:
                this.reg[2] = data
                if (this.scrolltype !== MirrorType.FOUR_SCREEN_MIRROR) {
                    if ((data & 0x01) === 0) { this.setmirroring(MirrorType.V_MIRROR) }
                    else { this.setmirroring(MirrorType.H_MIRROR) }
                }
                break
            case 0xA001:
                this.reg[3] = data
                break
            case 0xC000:
                this.reg[4] = data
                this.irqCounter = data
                this.irqRequest = 0
                break
            case 0xC001:
                this.reg[5] = data
                this.irqLatch = data
                this.irqRequest = 0
                break
            case 0xE000:
                this.reg[6] = data
                this.irqEnable = 0
                this.irqRequest = 0
                this.cpu!.interrupt = 0
                break
            case 0xE001:
                this.reg[7] = data
                this.irqEnable = 1
                this.irqRequest = 0
                break
            default:
                super.cartWrite(addr, data)
                break
        }
    }

    override notifyscanline(scanline: number): void {
        if (scanline >= 0 && scanline <= 239) {
            if (this.ppu?.renderingOn()) {
                if (this.irqEnable && this.irqRequest === 0) {
                    if (scanline === 0) {
                        if (this.irqCounter !== 0) {
                            this.irqCounter--
                        }
                    }
                    if (this.irqCounter-- === 0) {
                        this.irqRequest = 0xFF
                        this.irqCounter = this.irqLatch
                        this.cpu!.interrupt++
                    }
                }
            }
        }
    }

    setBankCPU() {
        const prom8kSize = this.getPROM8KSize()
        if (this.reg[0] & 0x40) {
            this.setPROM32KBank4(prom8kSize - 2, this.prg1, this.prg0, prom8kSize - 1)
        }
        else {
            this.setPROM32KBank4(this.prg0, this.prg1, prom8kSize - 2, prom8kSize - 1)
        }
    }

    setBankPPU() {
        if (this.getVROM1KSize()) {
            if (this.reg[0] & 0x80) {
                this.setBanPPUSub(4, this.chr01 + 0)
                this.setBanPPUSub(5, this.chr01 + 1)
                this.setBanPPUSub(6, this.chr23 + 0)
                this.setBanPPUSub(7, this.chr23 + 1)
                this.setBanPPUSub(0, this.chr4)
                this.setBanPPUSub(1, this.chr5)
                this.setBanPPUSub(2, this.chr6)
                this.setBanPPUSub(3, this.chr7)
            }
            else {
                this.setBanPPUSub(0, this.chr01 + 0)
                this.setBanPPUSub(1, this.chr01 + 1)
                this.setBanPPUSub(2, this.chr23 + 0)
                this.setBanPPUSub(3, this.chr23 + 1)
                this.setBanPPUSub(4, this.chr4)
                this.setBanPPUSub(5, this.chr5)
                this.setBanPPUSub(6, this.chr6)
                this.setBanPPUSub(7, this.chr7)

            }
        }
        else if (this.reg[0] & 0x80) {
            this.setCRAM1KBank(4, this.chr01 + 0 & 7)
            this.setCRAM1KBank(5, this.chr01 + 1 & 7)
            this.setCRAM1KBank(6, this.chr23 + 0 & 7)
            this.setCRAM1KBank(7, this.chr23 + 1 & 7)
            this.setCRAM1KBank(0, this.chr4 & 7)
            this.setCRAM1KBank(1, this.chr5 & 7)
            this.setCRAM1KBank(2, this.chr6 & 7)
            this.setCRAM1KBank(3, this.chr7 & 7)
        }
        else {
            this.setCRAM1KBank(0, this.chr01 + 0 & 7)
            this.setCRAM1KBank(1, this.chr01 + 1 & 7)
            this.setCRAM1KBank(2, this.chr23 + 0 & 7)
            this.setCRAM1KBank(3, this.chr23 + 1 & 7)
            this.setCRAM1KBank(4, this.chr4 & 7)
            this.setCRAM1KBank(5, this.chr5 & 7)
            this.setCRAM1KBank(6, this.chr6 & 7)
            this.setCRAM1KBank(7, this.chr7 & 7)
        }
    }

    setBanPPUSub(bank: number, page: number) {
        if (this.patch === 0 && (page === 8 || page === 9)) {
            this.setCRAM1KBank(bank, page & 7)
        }
        else if (this.patch === 1 && page >= 128) {
            this.setCRAM1KBank(bank, page & 7)
        }
        else {
            this.setCRAM1KBank(bank, page)
        }
    }
}
