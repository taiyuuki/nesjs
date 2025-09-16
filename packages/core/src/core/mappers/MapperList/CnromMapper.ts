import { Mapper } from '../Mapper'

export default class CnromMapper extends Mapper {

    override loadROM(): void {
        super.loadROM()
        
        // 初始化 PRG 银行映射 (32KB 线性映射)
        for (let i = 0; i < 32; i++) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }

        // 初始化 CHR 银行映射 (8KB 线性映射)
        for (let i = 0; i < 8; i++) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        
        for (let i = 0; i < 8; i++) {
            this.chr_map[i] = 1024 * (i + (data & 0xFF)) & this.chrsize - 1
        }
    }
}
