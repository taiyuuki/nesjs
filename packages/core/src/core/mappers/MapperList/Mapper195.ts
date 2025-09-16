import MMC3Mapper from './MMC3Mapper'

export default class Mapper195 extends MMC3Mapper {

    protected chrRamControl = 0x80 // Power-on value: $80
    protected chrBanksToRam: boolean[] = new Array(8).fill(false)
    
    override loadROM(): void {
        super.loadROM()
        
        // 初始化CHR RAM
        this.haschrram = true
        const originalChrSize = this.chrsize
        
        // 确保有足够的空间用于CHR RAM
        // CHR RAM在CHR ROM之后
        const chrRamSize = 8192 // 8KB CHR RAM
        if (originalChrSize === 0) {

            // 只有CHR RAM
            this.chrsize = chrRamSize
            this.chr = new Array(this.chrsize).fill(0)
        }
        else {

            // 扩展CHR数组以包含RAM
            const newChrSize = originalChrSize + chrRamSize
            const newChr = new Array(newChrSize).fill(0)
            
            // 复制原有CHR ROM数据
            for (let i = 0; i < originalChrSize; i++) {
                newChr[i] = this.chr[i]
            }
            
            this.chr = newChr
            this.chrsize = newChrSize
        }

        // 初始CHR RAM控制状态 (power-on: $80)
        // 默认状态下禁用CHR RAM，使用CHR ROM
        this.chrRamControl = 0xC0 // Bit 7=1, Bit 6=1 -> 强制CHR ROM
        this.updateChrRamMapping()
    }

    override ppuWrite(addr: number, data: number): void {

        // Mapper 195 特殊功能: 通过PPU写入检测CHR RAM控制
        if (addr < 0x2000) {

            // 检查是否是CHR RAM控制写入
            this.detectChrRamControl(addr, data)
        }
        
        // 在检测控制后再调用父类方法，确保使用正确的映射
        super.ppuWrite(addr, data)
    }

    override load1kVromBank(bank1k: number, address: number): void {
        if (this.chrsize === 0) {
            return
        }

        const mapIndex = address >> 10 // address / 1024
        
        // 检查该bank是否应该映射到RAM
        if (this.chrBanksToRam[mapIndex]) {

            // 映射到CHR RAM
            // CHR RAM在CHR ROM之后，获取原始CHR ROM大小
            const originalChrSize = Math.max(0, this.chrsize - 8192)
            const ramStartOffset = originalChrSize
            
            // 在8KB CHR RAM空间内循环
            const ramOffset = bank1k * 1024 % 8192
            this.chr_map[mapIndex] = ramStartOffset + ramOffset
        }
        else {

            // 使用父类的标准映射到CHR ROM
            super.load1kVromBank(bank1k, address)
        }
    }

    /**
     * 检测CHR RAM控制写入
     * 游戏通过向CHR写入特定值来控制RAM/ROM切换
     */
    private detectChrRamControl(addr: number, data: number): void {

        // 根据文档，游戏向CHR banks写入以1KB为倍数的方式来控制
        // 我们需要检测这些特殊的写入模式
        
        // 检查是否是对CHR bank边界的写入
        if ((addr & 0x3FF) === 0) {
            
            // 根据文档，控制字节的格式是：CHRB~[1Z.D L.L.]
            // Bit 7必须为1，Bit 6控制强制ROM模式
            const controlByte = data
            
            // 只有当bit 7设置时才是有效控制
            if ((controlByte & 0x80) !== 0) {
                
                // 如果控制字节改变，更新映射
                if (this.chrRamControl !== controlByte) {
                    this.chrRamControl = controlByte
                    this.updateChrRamMapping()
                }
            }
        }
    }

    /**
     * 根据chrRamControl更新CHR RAM映射
     * 基于NESdev文档的详细说明
     */
    private updateChrRamMapping(): void {
        const control = this.chrRamControl
        
        // Bit 6: If 1, ignore other bits and always enable CHR ROM / disable CHR RAM
        if (control & 0x40) {

            // 强制使用CHR ROM
            this.chrBanksToRam.fill(false)
            this.remapChrBanks()

            return
        }
        
        // Bit 5: Number of banks of CHR RAM, 0=4KiB (4 banks), 1=2KiB (2 banks)
        const is2KB = (control & 0x20) !== 0
        const ramBanks = is2KB ? 2 : 4
        
        // 低5位选择CHR RAM的映射
        const bankSelect = control & 0x1F
        
        // 重置所有bank为ROM
        this.chrBanksToRam.fill(false)
        
        // 根据文档中的具体映射表设置RAM banks
        switch (bankSelect) {
            case 0x00: // $80 = $28-$2B (banks 0-3 for 4KB, banks 0-1 for 2KB)
                for (let i = 0; i < ramBanks; i++) {
                    this.chrBanksToRam[i] = true
                }
                break
                
            case 0x02: // $82 = $00-$03 (banks 0-3 for 4KB, banks 0-1 for 2KB)
                for (let i = 0; i < ramBanks; i++) {
                    this.chrBanksToRam[i] = true
                }
                break
                
            case 0x08: // $88 = $4C-$4F (banks 4-7 for 4KB)
                if (is2KB) {

                    // 2KB模式下映射到不同位置
                    for (let i = 0; i < 2; i++) {
                        this.chrBanksToRam[i] = true
                    }
                }
                else {
                    for (let i = 4; i < 8; i++) {
                        this.chrBanksToRam[i] = true
                    }
                }
                break
                
            case 0x0A: // $8A = $64-$67
                for (let i = 0; i < ramBanks; i++) {
                    this.chrBanksToRam[i] = true
                }
                break
                
            // 根据文档，$CA表示只使用CHR ROM
            case 0x0A | 0x40: // $CA
                // 已经在上面的bit 6检查中处理了
                break
                
            default:

                // 对于其他值，默认不使用RAM
                break
        }
        
        // 重新映射所有CHR banks
        this.remapChrBanks()
    }

    /**
     * 存档状态恢复时的特殊处理
     */
    protected override postLoadState(state: any): void {
        super.postLoadState(state)
        
        // 恢复Mapper 195特有的状态
        if (state.chrRamControl !== undefined) {
            this.chrRamControl = state.chrRamControl
        }
        if (state.chrBanksToRam) {
            this.chrBanksToRam = [...state.chrBanksToRam]
        }
        
        // 重新应用CHR RAM映射
        this.updateChrRamMapping()
    }
}
