
import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

/**
 * MMC1 Mapper 实现
 * 支持多种银行切换模式和镜像设置
 * 用于许多任天堂官方游戏，如塞尔达传说、银河战士等
 */
export default class MMC1Mapper extends Mapper {
    
    // MMC1寄存器
    private mmc1shift: number = 0
    private mmc1latch: number = 0 
    private mmc1ctrl: number = 0xc
    private mmc1chr0: number = 0
    private mmc1chr1: number = 0
    private mmc1prg: number = 0
    
    // SOROM 支持 (大于256KB ROM)
    private soromlatch: boolean = false
    
    // Bill and Ted 修复相关
    private cpucycleprev: number = 0
    private framecountprev: number = 0

    public override loadROM(): void {
        super.loadROM()
        
        // 初始化 PRG 银行映射 (32KB 线性映射)
        for (let i = 0; i < 32; i++) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        
        // 初始化 CHR 银行映射 (8KB 线性映射)
        for (let i = 0; i < 8; i++) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
        
        this.setbanks()
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        
        // Bill and Ted 修复 - 防止连续两次写入被识别
        // 如果 CPU 时钟和帧计数都与上次相同，则忽略写入
        if (this.cpu && this.cpuram?.apu?.nes?.frameCount !== undefined) {
            if (this.cpu.clocks === this.cpucycleprev
                && this.cpuram.apu.nes.frameCount === this.framecountprev) {
                return
            }
            this.framecountprev = this.cpuram.apu.nes.frameCount
            this.cpucycleprev = this.cpu.clocks
        }
        
        // 检查复位位 (bit 7)
        if ((data & Utils.BIT7) !== 0) {

            // 复位移位寄存器
            this.mmc1shift = 0
            this.mmc1latch = 0
            this.mmc1ctrl |= 0xc // 设置默认模式
            this.setbanks()

            return
        }
        
        // 移位操作：将 bit 0 移入寄存器
        this.mmc1shift = (this.mmc1shift >> 1) + ((data & 1) << 4)
        this.mmc1latch++
        
        // 需要5次写入才能完成一个命令
        if (this.mmc1latch < 5) {
            return
        }
        
        // 根据地址范围确定要写入的寄存器
        if (addr >= 0x8000 && addr <= 0x9fff) {

            // Control register (0x8000-0x9FFF)
            this.mmc1ctrl = this.mmc1shift & 0x1f
            
            // 设置镜像模式
            let mirtype: MirrorType
            switch (this.mmc1ctrl & 3) {
                case 0:
                    mirtype = MirrorType.SS_MIRROR0
                    break
                case 1:
                    mirtype = MirrorType.SS_MIRROR1
                    break
                case 2:
                    mirtype = MirrorType.V_MIRROR
                    break
                default:
                    mirtype = MirrorType.H_MIRROR
                    break
            }
            this.setmirroring(mirtype)
            
        }
        else if (addr >= 0xa000 && addr <= 0xbfff) {

            // CHR bank 0 (0xA000-0xBFFF)
            this.mmc1chr0 = this.mmc1shift & 0x1f
            
            if (this.prgsize > 262144) {

                // SOROM 支持：使用 CHR 的高位来切换 PRG ROM 的前 256KB 或后 256KB
                this.mmc1chr0 &= 0xf
                this.soromlatch = (this.mmc1shift & Utils.BIT4) !== 0
            }
            
        }
        else if (addr >= 0xc000 && addr <= 0xdfff) {

            // CHR bank 1 (0xC000-0xDFFF)
            this.mmc1chr1 = this.mmc1shift & 0x1f
            
            if (this.prgsize > 262144) {
                this.mmc1chr1 &= 0xf
            }
            
        }
        else if (addr >= 0xe000 && addr <= 0xffff) {

            // PRG bank (0xE000-0xFFFF)
            this.mmc1prg = this.mmc1shift & 0xf
        }
        
        // 更新银行映射
        this.setbanks()
        
        // 重置移位寄存器
        this.mmc1latch = 0
        this.mmc1shift = 0
    }

    /**
     * 根据当前控制寄存器设置银行映射
     */
    private setbanks(): void {

        // CHR 银行设置
        if ((this.mmc1ctrl & Utils.BIT4) === 0) {

            // 8KB CHR 银行模式
            for (let i = 0; i < 8; i++) {
                this.chr_map[i] = 1024 * (i + 8 * (this.mmc1chr0 >> 1)) % this.chrsize
            }
        }
        else {

            // 4KB CHR 银行模式
            for (let i = 0; i < 4; i++) {
                this.chr_map[i] = 1024 * (i + 4 * this.mmc1chr0) % this.chrsize
            }
            for (let i = 0; i < 4; i++) {
                this.chr_map[i + 4] = 1024 * (i + 4 * this.mmc1chr1) % this.chrsize
            }
        }
        
        // PRG 银行设置
        if ((this.mmc1ctrl & Utils.BIT3) === 0) {

            // 32KB 切换模式
            // 忽略低位银行位
            for (let i = 0; i < 32; i++) {
                this.prg_map[i] = (1024 * i + 32768 * (this.mmc1prg >> 1)) % this.prgsize
            }
            
        }
        else if ((this.mmc1ctrl & Utils.BIT2) === 0) {

            // 固定第一个银行，16KB 切换第二个银行
            for (let i = 0; i < 16; i++) {
                this.prg_map[i] = 1024 * i
            }
            for (let i = 0; i < 16; i++) {
                this.prg_map[i + 16] = (1024 * i + 16384 * this.mmc1prg) % this.prgsize
            }
            
        }
        else {

            // 固定最后一个银行，切换第一个银行
            for (let i = 0; i < 16; i++) {
                this.prg_map[i] = (1024 * i + 16384 * this.mmc1prg) % this.prgsize
            }
            for (let i = 1; i <= 16; i++) {
                this.prg_map[32 - i] = this.prgsize - 1024 * i
                if (this.prg_map[32 - i] > 262144) {
                    this.prg_map[32 - i] -= 262144
                }
            }
        }
        
        // SOROM 支持：如果 ROM 大于 256KB 且 SOROM latch 开启
        if (this.soromlatch && this.prgsize > 262144) {

            // 给所有 PRG 银行号加上 256KB
            for (let i = 0; i < this.prg_map.length; i++) {
                this.prg_map[i] += 262144
            }
        }
    }

}
