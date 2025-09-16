import { Mapper } from '../Mapper'

/**
 * UNROM Mapper (Mapper 2)
 * 
 * 特点:
 * - 16KB 可切换的 PRG ROM bank (CPU $8000-$BFFF)
 * - 16KB 固定的 PRG ROM bank (CPU $C000-$FFFF，映射到最后一个bank)
 * - 8KB CHR RAM
 * - 水平或垂直镜像
 * 
 * Bank 切换:
 * - $8000-$FFFF: 写入任意位置切换 PRG bank (使用数据的低4位)
 */
export default class UnromMapper extends Mapper {
    private bank: number = 0

    public override loadROM(): void {
        super.loadROM()

        // 可移动的bank，初始为bank 0
        for (let i = 0; i < 16; i++) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }

        // 固定bank - 映射到最后一个bank
        for (let i = 1; i <= 16; i++) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }

        // CHR映射 (通常是CHR RAM)
        for (let i = 0; i < 8; i++) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)
            
            return
        }

        // 切换PRG bank (使用数据的低4位)
        this.bank = data & 0xf

        // 重新映射PRG bank (第一个bank可切换，第二个bank映射到最后一个bank)
        for (let i = 0; i < 16; i++) {
            this.prg_map[i] = 1024 * (i + 16 * this.bank) & this.prgsize - 1
        }
    }

    /**
     * UNROM 存档恢复后的特殊处理
     */
    protected override postLoadState(_state: any): void {

        // 恢复bank映射
        if (this.bank !== undefined) {

            // 重新映射PRG bank
            for (let i = 0; i < 16; i++) {
                this.prg_map[i] = 1024 * (i + 16 * this.bank) & this.prgsize - 1
            }
        }
    }
}
