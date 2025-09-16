
import MMC3Mapper from './MMC3Mapper'

// Mapper074: Waixing MMC3 clone with 2KB CHR-RAM at banks 8/9
// 参考 https://www.nesdev.org/wiki/INES_Mapper_074
export default class Mapper74 extends MMC3Mapper {

    // CHR-RAM: 2KB，映射到bank 8/9 (每个bank 1KB)
    private chrRam: Uint8Array = new Uint8Array(0x800)

    override ppuRead(addr: number): number {

        // 检查A12变化（继承自MMC3）
        this.checkA12(addr)
        
        // 首先调用父类的标准CHR读取
        const chrData = super.ppuRead(addr)
        
        // 计算逻辑bank
        const bank = Math.floor(addr / 1024)
        const offset = addr % 1024
        
        // 检查当前bank是否被MMC3映射为bank 8或9
        // 需要检查chr_map中的实际映射值
        const mappedChrAddr = this.chr_map[bank]
        const logicalBank = Math.floor(mappedChrAddr / 1024)
        
        // 如果MMC3将此位置映射为逻辑bank 8或9，则使用CHR-RAM
        if (logicalBank === 8 || logicalBank === 9) {
            return this.chrRam[(logicalBank - 8) * 1024 + offset]
        }
        
        // 否则返回标准CHR-ROM数据
        return chrData
    }

    override ppuWrite(addr: number, data: number): void {

        // 检查A12变化
        this.checkA12(addr)
        
        const bank = Math.floor(addr / 1024)
        const offset = addr % 1024
        
        // 检查当前bank是否被MMC3映射为bank 8或9
        const mappedChrAddr = this.chr_map[bank]
        const logicalBank = Math.floor(mappedChrAddr / 1024)
        
        // 如果MMC3将此位置映射为逻辑bank 8或9，则写入CHR-RAM
        if (logicalBank === 8 || logicalBank === 9) {
            this.chrRam[(logicalBank - 8) * 1024 + offset] = data

            return
        }
        
        super.ppuWrite(addr, data)
    }

    protected override postLoadState(_state: any): void {
        this.setbank6()
        this.remapChrBanks()
    }
}
