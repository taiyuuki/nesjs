
import { Mapper } from '../Mapper'

/**
 * NROM 游戏的速度优化：将所有内容复制到线性映射中
 * 完全不使用 bankswitching 功能
 *
 * 感谢 Stephen Chin - steveonjava@gmail.com
 */
export default class NromMapper extends Mapper {

    public override loadROM(): void {
        super.loadROM()
        
        // 复制整个 rom，这样我们需要做更少的数学运算
        const shiftedprg = new Array(65536).fill(0)
        
        // 将 PRG ROM 复制到 0x8000
        for (let i = 0; i < this.prg.length; i++) {
            shiftedprg[0x8000 + i] = this.prg[i]
        }
        
        if (this.prgsize <= 16384) {

            // 如果是 16k，则将 rom 重复一遍
            for (let i = 0; i < this.prg.length; i++) {
                shiftedprg[0xc000 + i] = this.prg[i]
            }
        }
        
        this.prg = shiftedprg
    }

    public override cartRead(addr: number): number {
        if (addr >= 0x8000) {
            return this.prg[addr] || 0
        }
        else if (addr >= 0x6000 && this.hasprgram) {
            return this.prgram[addr & 0x1fff]
        }

        return addr >> 8 // open bus
    }

    public override ppuRead(addr: number): number {
        if (addr < 0x2000) {

            // math is hard let's go shopping
            return this.chr[addr]
        }
        else {
            switch (addr & 0xc00) {
                case 0:
                    return this.nt0[addr & 0x3ff]
                case 0x400:
                    return this.nt1[addr & 0x3ff]
                case 0x800:
                    return this.nt2[addr & 0x3ff]
                case 0xc00:
                default:
                    if (addr >= 0x3f00) {
                        addr &= 0x1f
                        if (addr >= 0x10 && (addr & 3) === 0) {
                            addr -= 0x10
                        }

                        return this.ppu?.pal[addr] ?? 0
                    }
                    else {
                        return this.nt3[addr & 0x3ff]
                    }
            }
        }
    }
}
