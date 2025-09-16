import MMC3Mapper from './MMC3Mapper'

export default class Mapper118 extends MMC3Mapper {

    override loadROM(): void {
        super.loadROM()
        
        // 初始化nametable映射
        this.updateNametableMapping()
    }

    override executeCommand(cmd: number, arg: number): void {

        // 调用父类的标准MMC3 CHR bank切换
        super.executeCommand(cmd, arg)
        
        // Mapper118的特殊功能：CHR bank切换同时控制nametable映射
        this.updateNametableMapping()
    }

    /**
     * 根据CHR bank配置更新nametable映射
     * CHR A17直接连接到CIRAM A10，实现特殊的mirroring控制
     */
    private updateNametableMapping(): void {

        // 获取当前的CHR配置状态
        const chrConfig = this.chrconfig
        
        if (chrConfig) {

            // CHR配置为1：4KB在$1000-$1FFF, 1KB在$0000-$0FFF
            // 使用commands 2-5 (1KB banks) 来控制nametable映射
            this.updateNametableMappingFromChrBanks([
                this.chrreg[2], // NT $2000-$23FF
                this.chrreg[3], // NT $2400-$27FF  
                this.chrreg[4], // NT $2800-$2BFF
                this.chrreg[5], // NT $2C00-$2FFF
            ])
        }
        else {

            // CHR配置为0：4KB在$0000-$0FFF, 1KB在$1000-$1FFF
            // 使用commands 0-1 (2KB banks) 来控制nametable映射
            this.updateNametableMappingFromChrBanks([
                this.chrreg[0], // NT $2000-$27FF (2KB)
                this.chrreg[0], // NT $2000-$27FF (same as above)
                this.chrreg[1], // NT $2800-$2FFF (2KB)
                this.chrreg[1], // NT $2800-$2FFF (same as above)
            ])
        }
    }

    /**
     * 根据CHR bank值更新nametable映射
     * 使用CHR bank的bit 7作为nametable选择位
     */
    private updateNametableMappingFromChrBanks(chrBanks: number[]): void {

        // 每个CHR bank的bit 7控制对应的nametable映射
        // bit 7 = 0: 使用第一个nametable
        // bit 7 = 1: 使用第二个nametable
        
        const nt0Selected = (chrBanks[0] & 0x80) === 0 ? 0 : 1
        const nt1Selected = (chrBanks[1] & 0x80) === 0 ? 0 : 1  
        const nt2Selected = (chrBanks[2] & 0x80) === 0 ? 0 : 1
        const nt3Selected = (chrBanks[3] & 0x80) === 0 ? 0 : 1

        // 设置nametable指针
        this.nt0 = nt0Selected === 0 ? this.pput0 : this.pput1
        this.nt1 = nt1Selected === 0 ? this.pput0 : this.pput1
        this.nt2 = nt2Selected === 0 ? this.pput0 : this.pput1
        this.nt3 = nt3Selected === 0 ? this.pput0 : this.pput1
    }

    override cartWrite(addr: number, data: number): void {

        // 处理标准MMC3寄存器
        super.cartWrite(addr, data)
        
        // Mapper118特殊处理：$A000寄存器被bypassed
        // 镜像完全由CHR bank控制，忽略$A000的mirroring位
    }

    /**
     * 存档状态恢复时的特殊处理
     */
    protected override postLoadState(state: any): void {
        super.postLoadState(state)
        
        // 重新应用nametable映射
        this.updateNametableMapping()
    }
}
