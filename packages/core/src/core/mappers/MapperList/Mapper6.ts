import { Mapper } from '../Mapper'
import type { ROMLoader } from '../../ROMLoader'

export default class Mapper6 extends Mapper {
    private irqEnable: number = 0
    private irqCounter: number = 0

    constructor(loader: ROMLoader) {
        super(loader)
    }

    public reset(): void {

        // 设置PRG银行：32K模式，银行0,1,14,15
        this.setPROM32KBank4(0, 1, 14, 15)

        // 设置CHR银行
        if (this.getVROM1KSize() > 0) {
            this.setVROM8KBank(0)
        }
        else {

            // 使用CHR RAM
            this.setVROM8KBank(0)
        }

        // 初始化IRQ
        this.irqEnable = 0
        this.irqCounter = 0
    }

    /**
     * 卡带写入处理
     * @param addr 地址
     * @param data 数据
     */
    public cartWrite(addr: number, data: number): void {
        if (addr >= 0x4020 && addr < 0x6000) {
            this.writeLow(addr, data)
        }
        else if (addr >= 0x8000) {
            this.write(addr, data)
        }
        else {
            super.cartWrite(addr, data)
        }
    }

    /**
     * 低地址空间写入处理
     * @param addr 地址
     * @param data 数据
     */
    private writeLow(addr: number, data: number): void {
        switch (addr) {
            case 0x42FE:

                // 镜像控制
                if ((data & 0x10) === 0) {
                    this.setVRAMMirror(3) // VRAM_MIRROR4L
                }
                else {
                    this.setVRAMMirror(4) // VRAM_MIRROR4H
                }
                break

            case 0x42FF:

                // 镜像控制
                if ((data & 0x10) === 0) {
                    this.setVRAMMirror(1) // VRAM_VMIRROR
                }
                else {
                    this.setVRAMMirror(0) // VRAM_HMIRROR
                }
                break

            case 0x4501:

                // 禁用IRQ
                this.irqEnable = 0
                if (this.cpu) {
                    this.cpu.interrupt &= ~0x04 // 清除 IRQ_MAPPER
                }
                break

            case 0x4502:

                // IRQ计数器低字节
                this.irqCounter = this.irqCounter & 0xFF00 | data
                break

            case 0x4503:

                // IRQ计数器高字节
                this.irqCounter = this.irqCounter & 0x00FF | data << 8
                this.irqEnable = 0xFF
                if (this.cpu) {
                    this.cpu.interrupt &= ~0x04 // 清除 IRQ_MAPPER
                }
                break

            default:

                // 其他地址按默认处理
                super.cartWrite(addr, data)
                break
        }
    }

    /**
     * 卡带写入处理 ($8000-$FFFF)
     * @param _addr 地址
     * @param data 数据
     */
    private write(_addr: number, data: number): void {

        // 设置PRG银行和CHR RAM银行
        this.setPROM16KBank(4, (data & 0x3C) >> 2)
        
        // 设置CHR RAM银行（如果有CHR RAM）
        if (this.haschrram) {
            const chrBank = data & 0x03
            this.setVROM8KBank(chrBank)
        }
    }

    /**
     * 水平同步处理（每扫描线调用）
     * @param _scanline 扫描线号
     */
    public notifyscanline(_scanline: number): void {
        if (this.irqEnable !== 0) {
            this.irqCounter += 133

            if (this.irqCounter >= 0xFFFF) {
                this.irqCounter = 0
                if (this.cpu) {
                    this.cpu.interrupt |= 0x04 // 设置 IRQ_MAPPER
                }
            }
        }
    }

    /**
     * 后加载状态处理
     * 恢复状态后重新设置银行映射
     */
    protected postLoadState(_state: any): void {

        // IRQ状态已经通过自动序列化恢复
        // 这里可以添加任何需要重新计算或设置的逻辑
        
        // 确保IRQ状态正确
        if (this.irqEnable === 0 && this.cpu) {
            this.cpu.interrupt &= ~0x04 // 清除 IRQ_MAPPER
        }
    }
}
