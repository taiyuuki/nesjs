import { Mapper } from '../Mapper'
import { MirrorType } from '@/core/types'

export default class Mapper249 extends Mapper {
    private reg: number[] = new Array(8).fill(0)
    private irqEnable: number = 0
    private irqCounter: number = 0
    private irqLatch: number = 0
    private irqRequest: number = 0
    private spdata: number = 0

    override loadROM(): void {
        super.loadROM()

        // 初始化寄存器
        for (let i = 0; i < 8; i++) {
            this.reg[i] = 0x00
        }

        // 设置PRG银行：前两个8K银行可切换，后两个固定为最后两个银行
        this.setPROM32KBank4(0, 1, this.getPROM8KSize() - 2, this.getPROM8KSize() - 1)

        // 设置CHR银行
        this.setVROM8KBank(0)

        this.irqEnable = 0 // Disable
        this.irqCounter = 0
        this.irqLatch = 0
        this.irqRequest = 0

        this.spdata = 0
    }

    /**
     * 低地址空间写入处理 ($5000-$7FFF)
     * @param addr 地址
     * @param data 数据
     */
    public cartWrite(addr: number, data: number): void {
        if (addr === 0x5000) {
            switch (data) {
                case 0x00:
                    this.spdata = 0
                    break
                case 0x02:
                    this.spdata = 1
                    break
            }
        }
        else if (addr >= 0x6000 && addr < 0x8000) {

            // SRAM 写入
            this.prgram[addr & 0x1FFF] = data
        }
        else if (addr >= 0x8000) {
            this.write(addr, data)
        }
        else {
            super.cartWrite(addr, data)
        }
    }

    /**
     * 位重排函数 - 当 spdata = 1 时对数据进行特殊的位重排
     * @param data 原始数据
     * @returns 重排后的数据
     */
    private bitRemap(data: number): number {
        if (this.spdata !== 1) {
            return data
        }

        const m0 = data & 0x01
        const m1 = (data & 0x02) >> 1
        const m2 = (data & 0x04) >> 2
        const m3 = (data & 0x08) >> 3
        const m4 = (data & 0x10) >> 4
        const m5 = (data & 0x20) >> 5
        const m6 = (data & 0x40) >> 6
        const m7 = (data & 0x80) >> 7

        return m5 << 7 | m4 << 6 | m2 << 5 | m6 << 4 | m7 << 3 | m3 << 2 | m1 << 1 | m0
    }

    /**
     * PRG 位重排函数 - PRG 银行有不同的重排逻辑
     * @param data 原始数据
     * @returns 重排后的数据
     */
    private prgBitRemap(data: number): number {
        if (this.spdata !== 1) {
            return data
        }

        if (data < 0x20) {
            const m0 = data & 0x01
            const m1 = (data & 0x02) >> 1
            const m2 = (data & 0x04) >> 2
            const m3 = (data & 0x08) >> 3
            const m4 = (data & 0x10) >> 4

            return m2 << 4 | m1 << 3 | m3 << 2 | m4 << 1 | m0
        }
        else {
            return this.bitRemap(data - 0x20)
        }
    }

    /**
     * 主写入处理函数
     * @param addr 地址
     * @param data 数据
     */
    private write(addr: number, data: number): void {
        switch (addr & 0xFF01) {
            case 0x8000:
            case 0x8800:
                this.reg[0] = data
                break

            case 0x8001:
            case 0x8801:
                switch (this.reg[0] & 0x07) {
                    case 0x00:

                        // CHR 2K 银行 0
                        data = this.bitRemap(data)
                        this.setVROM1KBank(0, data & 0xFE)
                        this.setVROM1KBank(1, data | 0x01)
                        break

                    case 0x01:

                        // CHR 2K 银行 1
                        data = this.bitRemap(data)
                        this.setVROM1KBank(2, data & 0xFE)
                        this.setVROM1KBank(3, data | 0x01)
                        break

                    case 0x02:

                        // CHR 1K 银行 4
                        data = this.bitRemap(data)
                        this.setVROM1KBank(4, data)
                        break

                    case 0x03:

                        // CHR 1K 银行 5
                        data = this.bitRemap(data)
                        this.setVROM1KBank(5, data)
                        break

                    case 0x04:

                        // CHR 1K 银行 6
                        data = this.bitRemap(data)
                        this.setVROM1KBank(6, data)
                        break

                    case 0x05:

                        // CHR 1K 银行 7
                        data = this.bitRemap(data)
                        this.setVROM1KBank(7, data)
                        break

                    case 0x06:

                        // PRG 8K 银行 0
                        data = this.prgBitRemap(data)
                        this.setPROM8KBank(4, data)
                        break

                    case 0x07:

                        // PRG 8K 银行 1
                        data = this.prgBitRemap(data)
                        this.setPROM8KBank(5, data)
                        break
                }
                break

            case 0xA000:
            case 0xA800:
                this.reg[2] = data

                // 镜像控制
                if ((data & 0x01) === 0) {
                    this.setmirroring(MirrorType.V_MIRROR) // VRAM_VMIRROR
                }
                else {
                    this.setmirroring(MirrorType.H_MIRROR) // VRAM_HMIRROR
                }
                break

            case 0xA001:
            case 0xA801:
                this.reg[3] = data
                break

            case 0xC000:
            case 0xC800:
                this.reg[4] = data
                this.irqCounter = data
                this.irqRequest = 0
                if (this.cpu) {
                    this.cpu.interrupt &= ~0x04 // 清除 IRQ_MAPPER
                }
                break

            case 0xC001:
            case 0xC801:
                this.reg[5] = data
                this.irqLatch = data
                this.irqRequest = 0
                if (this.cpu) {
                    this.cpu.interrupt &= ~0x04 // 清除 IRQ_MAPPER
                }
                break

            case 0xE000:
            case 0xE800:
                this.reg[6] = data
                this.irqEnable = 0
                this.irqRequest = 0
                if (this.cpu) {
                    this.cpu.interrupt &= ~0x04 // 清除 IRQ_MAPPER
                }
                break

            case 0xE001:
            case 0xE801:
                this.reg[7] = data
                this.irqEnable = 1
                this.irqRequest = 0
                if (this.cpu) {
                    this.cpu.interrupt &= ~0x04 // 清除 IRQ_MAPPER
                }
                break
        }
    }

    /**
     * 扫描线同步处理 - MMC3 样式的 IRQ
     * @param scanline 扫描线号
     */
    public notifyscanline(scanline: number): void {
        if (scanline >= 0 && scanline <= 239) {
            if (this.ppu?.renderingOn()) {
                if (this.irqEnable !== 0 && this.irqRequest === 0) {
                    if (scanline === 0) {
                        if (this.irqCounter !== 0) {
                            this.irqCounter--
                        }
                    }

                    this.irqCounter--
                    if (this.irqCounter < 0) {
                        this.irqRequest = 0xFF
                        this.irqCounter = this.irqLatch
                        if (this.cpu) {
                            this.cpu.interrupt |= 0x04 // 设置 IRQ_MAPPER
                        }
                    }
                }
            }
        }
    }

    /**
     * 后加载状态处理
     * @param _state 状态数据
     */
    protected postLoadState(_state: any): void {

        // 重新应用银行设置
        // 这里可以根据需要重新设置银行映射
        
        // 确保IRQ状态正确
        if (this.irqEnable === 0 && this.cpu) {
            this.cpu.interrupt &= ~0x04
        }
    }
}
