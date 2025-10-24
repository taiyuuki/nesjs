import { Mapper } from '../Mapper'
import { MirrorType } from '../../types'

/**
 * Mapper 30 - UNROM 512
 * 
 * UNROM 512 是一个由 RetroUSB 制作的离散逻辑板，作为 UNROM 的扩展
 * 支持最多 512KB PRG ROM、可切换的 CHR RAM、可选的mapper控制单屏nametable
 * 
 * 特点:
 * - PRG ROM: 256K 或 512K
 * - PRG ROM 窗口: 16K + 16K 固定 ($C000)
 * - CHR RAM: 8K, 16K 或 32K (可切换)
 * - Nametable 镜像: H, V, 1屏, 或 4屏
 * - Bus conflicts: 根据 submapper
 * 
 * Submappers:
 * - 0: 原始定义，Battery bit 指示是否有 bus conflicts
 * - 1: 无 bus conflicts
 * - 2: 有 bus conflicts
 * - 3: 无 bus conflicts，mapper控制的水平/垂直nametable
 * - 4: 无 bus conflicts，额外的LED控制寄存器
 * 
 * Banks:
 * - CPU $8000-$BFFF: 16KB 可切换 PRG ROM
 * - CPU $C000-$FFFF: 16KB 固定到最后 16KB PRG ROM
 * - PPU $0000-$1FFF: 8KB 可切换 CHR RAM
 * - PPU $2000-$3FFF: Nametables (根据配置)
 */
export default class Mapper30 extends Mapper {

    // 当前寄存器值
    private reg: number = 0

    // PRG bank (低5位)
    private prgBank: number = 0

    // CHR bank (位5-6)
    private chrBank: number = 0

    // Nametable 配置 (位7)
    private ntConfig: number = 0

    // 是否有 bus conflicts
    private hasBusConflicts: boolean = false

    // 是否为4屏模式
    private fourScreen: boolean = false

    // 是否为单屏模式
    private oneScreen: boolean = false

    // Flash ROM 相关 (submapper 0, 1, 4)
    private flashEnabled: boolean = false

    public override loadROM(): void {
        super.loadROM()

        // 根据 submapper 设置 bus conflicts
        if (this.submapper === 2) {

            // Submapper 2: 明确有 bus conflicts
            this.hasBusConflicts = true
        }
        else if (this.submapper === 1 || this.submapper === 3 || this.submapper === 4) {

            // Submapper 1, 3, 4: 明确无 bus conflicts
            this.hasBusConflicts = false
        }
        else {

            // Submapper 0: Battery bit 指示 (savesram 为 true 表示无 bus conflicts)
            this.hasBusConflicts = !this.savesram
        }

        // Flash ROM 支持 (submapper 0, 1, 4 且有 battery)
        this.flashEnabled = (this.submapper === 0 || this.submapper === 1 || this.submapper === 4) && this.savesram

        // 检查nametable配置
        // 对于 submapper 3，忽略header的镜像位，由mapper控制
        if (this.submapper === 3) {

            // Submapper 3 动态控制 H/V 镜像
            // 初始设置为水平镜像
            this.setmirroring(MirrorType.H_MIRROR)
        }
        else {

            // 其他submapper使用header的镜像设置
            this.fourScreen = this.scrolltype === MirrorType.FOUR_SCREEN_MIRROR
            this.oneScreen = this.scrolltype === MirrorType.SS_MIRROR0 || this.scrolltype === MirrorType.SS_MIRROR1
        }

        // 确保有32KB CHR RAM
        if (this.haschrram && this.chrsize < 32768) {
            const newChr = new Array(32768).fill(0)
            newChr.splice(0, this.chr.length, ...this.chr)
            this.chr = newChr
            this.chrsize = 32768
        }

        // 初始化 bank 映射
        this.updateBanks()
    }

    public override reset(): void {
        this.reg = 0
        this.prgBank = 0
        this.chrBank = 0
        this.ntConfig = 0
        this.updateBanks()
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr >= 0x8000 && addr <= 0xFFFF) {

            // Flash ROM 区域 ($8000-$BFFF with bit 14=0)
            if (this.flashEnabled && addr >= 0x8000 && addr < 0xC000) {

                // Flash ROM 操作
                // 注意: 完整的 flash 操作需要特定的命令序列
                // 这里简化处理，实际使用中可能需要更复杂的状态机
                this.handleFlashWrite(addr, data)

                return
            }

            // 主寄存器写入
            let writeData = data

            // 处理 bus conflicts
            if (this.hasBusConflicts && addr >= 0xC000) {

                // 读取当前地址的值并与写入值进行AND操作
                const currentValue = this.cartRead(addr)
                writeData = data & currentValue
            }

            this.reg = writeData
            this.prgBank = writeData & 0x1F
            this.chrBank = writeData >> 5 & 0x03
            this.ntConfig = writeData >> 7 & 0x01

            // 更新 banks
            this.updateBanks()

            // Submapper 3: 动态镜像切换
            if (this.submapper === 3) {
                if (this.ntConfig === 0) {

                    // 垂直排列/水平镜像
                    this.setmirroring(MirrorType.V_MIRROR)
                }
                else {

                    // 水平排列/垂直镜像
                    this.setmirroring(MirrorType.H_MIRROR)
                }
            }

            // 单屏模式切换
            else if (this.oneScreen) {
                if (this.ntConfig === 0) {

                    // Lower bank
                    this.setmirroring(MirrorType.SS_MIRROR0)
                }
                else {

                    // Upper bank
                    this.setmirroring(MirrorType.SS_MIRROR1)
                }
            }

            // Submapper 4: LED 控制
            if (this.submapper === 4 && addr >= 0x8000 && addr < 0xC000) {

                // LED 控制寄存器
                // 位0-7: LED 状态 (0=亮, 1=暗)
                // 这里不实现实际的LED显示，只记录状态
            }
        }
        else {
            super.cartWrite(addr, data)
        }
    }

    /**
     * 处理 Flash ROM 写入
     */
    private handleFlashWrite(_addr: number, _data: number): void {

        // Flash ROM 写入需要特定的命令序列
        // 实际实现需要状态机来处理以下序列:
        //
        // 擦除 4KB Flash 扇区:
        // $C000:$01, $9555:$AA
        // $C000:$00, $AAAA:$55
        // $C000:$01, $9555:$80
        // $C000:$01, $9555:$AA
        // $C000:$00, $AAAA:$55
        // $C000:BANK, ADDR:$30
        //
        // 写入字节:
        // $C000:$01, $9555:$AA
        // $C000:$00, $AAAA:$55
        // $C000:$01, $9555:$A0
        // $C000:BANK, ADDR:DATA

        // 简化实现: 这里不完全实现 flash 状态机
        // 实际游戏中，flash 写入通常由游戏代码在 RAM 中执行
        // 模拟器可以直接将数据写入 PRG ROM（如果允许）
    }

    /**
     * 更新 PRG 和 CHR bank 映射
     */
    private updateBanks(): void {

        // PRG Bank 切换
        // $8000-$BFFF: 16KB 可切换
        this.setPROM16KBank(4, this.prgBank)

        // $C000-$FFFF: 16KB 固定到最后一个bank
        const lastBank = (this.prgsize >> 14) - 1
        this.setPROM16KBank(6, lastBank)

        // CHR Bank 切换
        // 如果有CHR RAM，切换8KB bank
        if (this.haschrram) {
            this.setVROM8KBank(this.chrBank)
        }
    }

    /**
     * 恢复状态后的处理
     */
    protected override postLoadState(_state: any): void {

        // 恢复 bank 映射
        this.updateBanks()

        // 恢复镜像设置
        if (this.submapper === 3) {
            if (this.ntConfig === 0) {
                this.setmirroring(MirrorType.V_MIRROR)
            }
            else {
                this.setmirroring(MirrorType.H_MIRROR)
            }
        }
        else if (this.oneScreen) {
            if (this.ntConfig === 0) {
                this.setmirroring(MirrorType.SS_MIRROR0)
            }
            else {
                this.setmirroring(MirrorType.SS_MIRROR1)
            }
        }
    }
}
