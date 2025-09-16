import type { Mapper } from './mappers/Mapper'
import type { PPU } from './PPU'
import type { APU } from './APU'

/**
 * CPU RAM 管理器
 * 处理 NES 内存映射和读写操作
 */
export class CPURAM {
    private readonly wram: number[] = new Array(2048).fill(0xff)
    public mapper!: Mapper
    public apu?: APU // 真正的 APU 引用
    public ppu?: PPU // 真正的 PPU 引用
    private _lastControllerRead?: number
    private _lastControllerWrite?: number

    constructor(mapper: Mapper) {
        this.mapper = mapper
    }

    /**
     * 设置 PPU 引用
     * @param ppu PPU 实例
     */
    public setPPU(ppu: PPU): void {
        this.ppu = ppu
    }

    /**
     * 设置 APU 引用
     * @param apu APU 实例
     */
    public setAPU(apu: APU): void {
        this.apu = apu
    }

    public read(addr: number): number {

        if (addr <= 0x1fff) {
            return this.wram[addr & 0x7FF]
        }
        
        if (addr <= 0x3fff) {
            
            // PPU 寄存器 (0x2000-0x3FFF, 每8字节镜像)
            return this.ppu ? this.ppu.read(addr & 7) : 0
        }
        
        if (addr >= 0x4000 && addr <= 0x4017) {
            
            // APU 和其他 I/O 寄存器 (0x4000-0x4017)
            return this.apu ? this.apu.read(addr - 0x4000) : 0x40 // 返回 open bus 值
        }
        
        if (addr > 0x4017) {
            return this.mapper.cartRead(addr)
        }
        
        return 0x40 // open bus
    }

    public write(addr: number, data: number): void {
        if (addr <= 0x1fff) {
            this.wram[addr & 0x7FF] = data & 0xff
        }
        else if (addr <= 0x3fff) {
            
            // PPU 寄存器写入
            if (this.ppu) {
                this.ppu.write(addr & 7, data)
            }
        }
        else if (addr >= 0x4000 && addr <= 0x4017 && this.apu) {
            
            // APU 和其他 I/O 寄存器写入（需要转换为偏移量）
            this.apu.write(addr - 0x4000, data)
        }
        else if (addr > 0x4017) {
            this.mapper.cartWrite(addr, data)
        }
    }

    /**
     * 获取CPU RAM的副本（用于存档）
     */
    public getRAM(): number[] {
        return [...this.wram]
    }

    /**
     * 设置CPU RAM状态（用于加载存档）
     */
    public setRAM(ram: number[]): void {
        if (ram.length !== 2048) {
            throw new Error('RAM data must be exactly 2048 bytes')
        }
        this.wram.splice(0, 2048, ...ram)
    }
}
