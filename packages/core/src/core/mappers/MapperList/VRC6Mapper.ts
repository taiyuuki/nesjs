
import { MirrorType, Utils } from '../../types'
import { VRC6SoundChip } from '../../audio/VRC6SoundChip'
import type { ROMLoader } from '../../ROMLoader'
import { Mapper } from '../Mapper'

export default class VRC6Mapper extends Mapper {
    private static readonly registerselectbits = [
        [0, 1],
        [1, 0],
    ]
    private registers: number[]
    private prgbank0 = 0
    private prgbank1 = 0
    private chrbank = new Array(8).fill(0)
    private irqmode = false
    private irqenable = false
    private irqack = false
    private firedinterrupt = false
    private irqreload = 0
    private irqcounter = 22
    private prescaler = 341
    private sndchip: VRC6SoundChip
    private hasInitSound = false

    constructor(loader: ROMLoader) {
        super(loader) 
        this.sndchip = new VRC6SoundChip()
        switch (loader.mappertype) {
            case 24:
                this.registers = VRC6Mapper.registerselectbits[0]
                break
            case 26:
            default:
                this.registers = VRC6Mapper.registerselectbits[1]
                break
        }
    }

    public loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        const bit0 = !!(addr & 1 << this.registers[0])
        const bit1 = !!(addr & 1 << this.registers[1])
        switch (addr >> 12) {
            case 0x8:
                this.prgbank0 = data
                this.setbanks()
                break
            case 0x9:
            case 0xa:
                this.sndchip.write((addr & 0xf000) + (bit1 ? 2 : 0) + (bit0 ? 1 : 0), data)
                break
            case 0xc:
                this.prgbank1 = data
                this.setbanks()
                break
            case 0xb:
                if (bit0 && bit1) {
                    switch (data >> 2 & 3) {
                        case 0: this.setmirroring(MirrorType.V_MIRROR); break
                        case 1: this.setmirroring(MirrorType.H_MIRROR); break
                        case 2: this.setmirroring(MirrorType.SS_MIRROR0); break
                        case 3: this.setmirroring(MirrorType.SS_MIRROR1); break
                    }
                }
                else {
                    this.sndchip.write((addr & 0xf000) + (bit1 ? 2 : 0) + (bit0 ? 1 : 0), data)
                }
                break
            case 0xd:
                this.chrbank[(bit1 ? 2 : 0) + (bit0 ? 1 : 0)] = data
                this.setbanks()
                break
            case 0xe:
                this.chrbank[(bit1 ? 2 : 0) + (bit0 ? 1 : 0) + 4] = data
                this.setbanks()
                break
            case 0xf:
                if (bit1) {
                    if (!bit0) {
                        this.irqenable = this.irqack
                        if (this.firedinterrupt) {
                            if (this.cpu) --this.cpu.interrupt
                        }
                        this.firedinterrupt = false
                    }
                }
                else if (bit0) {
                    this.irqack = !!(data & Utils.BIT0)
                    this.irqenable = !!(data & Utils.BIT1)
                    this.irqmode = !!(data & Utils.BIT2)
                    if (this.irqenable) {
                        this.irqcounter = this.irqreload
                        this.prescaler = 341
                    }
                    if (this.firedinterrupt) {
                        if (this.cpu) --this.cpu.interrupt
                    }
                    this.firedinterrupt = false
                }
                else {
                    this.irqreload = data
                }
                break
        }
    }

    private setbanks(): void {
        for (let i = 1; i <= 8; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * (i + 16 * this.prgbank0) % this.prgsize
        }
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i + 16] = 1024 * (i + 8 * this.prgbank1) % this.prgsize
        }
        for (let i = 0; i < 8; ++i) {
            this.setppubank(1, i, this.chrbank[i])
        }
    }

    private setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }

    public cpucycle(): void {
        if (this.irqenable) {
            if (this.irqmode) {
                this.scanlinecount()
            }
            else {
                this.prescaler -= 3
                if (this.prescaler <= 0) {
                    this.prescaler += 341
                    this.scanlinecount()
                }
            }
        }
    }

    private scanlinecount(): void {
        if (!this.hasInitSound) {

            // APU 初始化后才添加扩展音频
            this.cpuram?.apu?.addExpnSound(this.sndchip)
            this.hasInitSound = true
        }
        if (this.irqenable) {
            if (this.irqcounter === 255) {
                this.irqcounter = this.irqreload
                if (!this.firedinterrupt) {
                    if (this.cpu) ++this.cpu.interrupt
                }
                this.firedinterrupt = true
            }
            else {
                ++this.irqcounter
            }
        }
    }

    protected override postLoadState(state: any): void {

        // 重新初始化音频芯片实例，确保在读档后有正确的方法
        this.sndchip = new VRC6SoundChip()
        this.hasInitSound = false
        
        // 如果状态中有音频数据，恢复它
        if (state.sndchip && typeof state.sndchip === 'object') {

            // 恢复音频芯片的寄存器状态
            if (state.sndchip.registers) {

                // 通过写入操作恢复寄存器状态
                const registers = state.sndchip.registers
                for (let addr = 0x9000; addr <= 0xb003; addr++) {
                    const regIndex = addr - 0x9000
                    if (registers[regIndex] !== undefined) {
                        this.sndchip.write(addr, registers[regIndex])
                    }
                }
            }
        }
    }
}
