import type { ROMLoader } from '../../ROMLoader'
import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

export default class Mapper115 extends Mapper {

    // MMC3兼容寄存器  
    private reg = new Array(8).fill(0x00)
    private prg0 = 0
    private prg1 = 1
    private prg0L = 0
    private prg1L = 1
    private chr0 = 0
    private chr1 = 1
    private chr2 = 2
    private chr3 = 3
    private chr4 = 4
    private chr5 = 5
    private chr6 = 6
    private chr7 = 7

    // IRQ寄存器
    private irqEnable = 0
    private irqCounter = 0
    private irqLatch = 0

    // Mapper 115特有寄存器
    private exPrgSwitch = 0x00 // $6000: 扩展PRG开关
    private exChrSwitch = 0x00 // $6001: 扩展CHR开关

    constructor(loader: ROMLoader) {
        super(loader)
    }

    override loadROM(): void {
        super.loadROM()

        // 初始化寄存器
        for (let i = 0; i < 8; i++) {
            this.reg[i] = 0x00
        }

        this.prg0 = this.prg0L = 0
        this.prg1 = this.prg1L = 1

        this.exPrgSwitch = 0
        this.exChrSwitch = 0

        this.setBankCPU()

        if (this.chrsize > 0) {
            this.chr0 = 0
            this.chr1 = 1
            this.chr2 = 2
            this.chr3 = 3
            this.chr4 = 4
            this.chr5 = 5
            this.chr6 = 6
            this.chr7 = 7
            this.setBankPPU()
        }
        else {
            this.chr0 = this.chr2 = this.chr4 = this.chr5 = this.chr6 = this.chr7 = 0
            this.chr1 = this.chr3 = 1
        }

        this.irqEnable = 0 // Disable
        this.irqCounter = 0
        this.irqLatch = 0
    }

    override cartWrite(addr: number, data: number): void {
        if (addr >= 0x6000 && addr <= 0x6002) {
            this.writeLow(addr, data)

            return
        }

        if (addr >= 0x8000 && addr <= 0xFFFF) {
            this.write(addr, data)

            return
        }

        super.cartWrite(addr, data)
    }

    override cartRead(addr: number): number {

        // $6002: 焊盘寄存器(只读，固定返回0)
        if (addr === 0x6002) {
            return 0
        }

        return super.cartRead(addr)
    }

    private writeLow(addr: number, data: number): void {
        switch (addr) {
            case 0x6000:
                this.exPrgSwitch = data
                this.setBankCPU()
                break
            case 0x6001:
                this.exChrSwitch = data & 0x1
                this.setBankPPU()
                break
            case 0x6002:

                // 焊盘寄存器是只读的，忽略写入
                break
        }
    }

    private write(addr: number, data: number): void {
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
                        this.chr0 = data & 0xFE
                        this.chr1 = this.chr0 + 1
                        this.setBankPPU()
                        break
                    case 0x01:
                        this.chr2 = data & 0xFE
                        this.chr3 = this.chr2 + 1
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
                        this.prg0 = this.prg0L = data
                        this.setBankCPU()
                        break
                    case 0x07:
                        this.prg1 = this.prg1L = data
                        this.setBankCPU()
                        break
                }
                break
            case 0xA000:
                this.reg[2] = data
                if (this.scrolltype !== MirrorType.FOUR_SCREEN_MIRROR) {
                    if ((data & 0x01) === 0) {
                        this.setmirroring(MirrorType.V_MIRROR)
                    }
                    else {
                        this.setmirroring(MirrorType.H_MIRROR)
                    }
                }
                break
            case 0xA001:
                this.reg[3] = data
                break
            case 0xC000:
                this.reg[4] = data
                this.irqCounter = data
                this.irqEnable = 0xFF
                break
            case 0xC001:
                this.reg[5] = data
                this.irqLatch = data
                break
            case 0xE000:
                this.reg[6] = data
                this.irqEnable = 0
                if (this.cpu) {
                    this.cpu.interrupt = 0
                }
                break
            case 0xE001:
                this.reg[7] = data
                this.irqEnable = 0xFF
                break
        }
    }

    override notifyscanline(scanline: number): void {
        if (scanline >= 0 && scanline <= 239) {
            if (this.ppu!.renderingOn()) {
                if (this.irqEnable > 0) {
                    if (this.irqCounter === 0) {
                        this.irqCounter = this.irqLatch
                        if (this.cpu) {
                            this.cpu.interrupt++
                        }
                    }
                    else {
                        this.irqCounter--
                    }
                }
            }
        }
    }

    private setBankCPU(): void {
        if ((this.exPrgSwitch & 0x80) > 0) {

            this.prg0 = this.exPrgSwitch << 1 & 0x1e
            this.prg1 = this.prg0 + 1
            this.setPROM32KBank4(this.prg0, this.prg1, this.prg0 + 2, this.prg1 + 2)
        }
        else {

            this.prg0 = this.prg0L
            this.prg1 = this.prg1L
            const prom8kSize = this.prgsize >> 13
            if ((this.reg[0] & 0x40) > 0) {
                this.setPROM32KBank4(prom8kSize - 2, this.prg1, this.prg0, prom8kSize - 1)
            }
            else {
                this.setPROM32KBank4(this.prg0, this.prg1, prom8kSize - 2, prom8kSize - 1)
            }
        }
    }

    private setBankPPU(): void {
        if (this.chrsize > 0) {

            const chrOffset = this.exChrSwitch << 8

            if ((this.reg[0] & 0x80) > 0) {
                this.setVROM8KBank8(
                    chrOffset + this.chr4,
                    chrOffset + this.chr5,
                    chrOffset + this.chr6,
                    chrOffset + this.chr7,
                    chrOffset + this.chr0,
                    chrOffset + this.chr1,
                    chrOffset + this.chr2,
                    chrOffset + this.chr3,
                )
            }
            else {
                this.setVROM8KBank8(
                    chrOffset + this.chr0,
                    chrOffset + this.chr1,
                    chrOffset + this.chr2,
                    chrOffset + this.chr3,
                    chrOffset + this.chr4,
                    chrOffset + this.chr5,
                    chrOffset + this.chr6,
                    chrOffset + this.chr7,
                )
            }
        }
    }

    protected override postLoadState(_state: any): void {

        // 存档加载后重新应用银行映射
        this.setBankCPU()
        this.setBankPPU()
    }
}
