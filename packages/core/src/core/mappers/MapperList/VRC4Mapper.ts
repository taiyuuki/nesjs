import type { ROMLoader } from '../../ROMLoader'
import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class VRC4Mapper extends Mapper {
    private static readonly registerselectbits = [
        [[1, 2], [6, 7]],
        [[2, 3], [0, 1]],
        [[3, 2], [1, 0]],
    ]
    private registers: number[][]
    private prgbank0 = 0
    private prgbank1 = 0
    private chrbank = new Array(8).fill(0)
    private prgmode = false
    private irqmode = false
    private irqenable = false
    private irqack = false
    private firedinterrupt = false
    private irqreload = 0
    private irqcounter = 22
    private vrc2mirror = false
    private prescaler = 341

    constructor(loader: ROMLoader) {

        super(loader) // 你需要传入 loader
        switch (loader.mappertype) {
            case 21:
                this.registers = VRC4Mapper.registerselectbits[0]
                break
            case 23:
                this.registers = VRC4Mapper.registerselectbits[1]
                break
            case 25:
                this.registers = VRC4Mapper.registerselectbits[2]
                break
            default:
                this.registers = VRC4Mapper.registerselectbits[0]
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

        // CRC 检测 Konami Wai Wai World on VRC2
        const crc = this.crc
        this.vrc2mirror
            = crc === 0xB790FF4C
                || crc === 0x2D953C3D
                || crc === 0x64818FC5
                || crc === 0x1E12AF8A
                || crc === 0x3480F7DB
    }

    public cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        const bit0 = (addr & 1 << this.registers[0][0]) !== 0 || (addr & 1 << this.registers[1][0]) !== 0
        const bit1 = (addr & 1 << this.registers[0][1]) !== 0 || (addr & 1 << this.registers[1][1]) !== 0
        switch (addr >> 12) {
            case 0x8:
                this.prgbank0 = data & 0x1f
                break
            case 0x9:
                if (bit1) {
                    this.prgmode = (data & Utils.BIT1) !== 0
                }
                else if (this.vrc2mirror) {
                    switch (data & 1) {
                        case 0: this.setmirroring(MirrorType.V_MIRROR); break
                        case 1: this.setmirroring(MirrorType.H_MIRROR); break
                    }
                }
                else {
                    switch (data & 3) {
                        case 0: this.setmirroring(MirrorType.V_MIRROR); break
                        case 1: this.setmirroring(MirrorType.H_MIRROR); break
                        case 2: this.setmirroring(MirrorType.SS_MIRROR0); break
                        case 3: this.setmirroring(MirrorType.SS_MIRROR1); break
                    }
                }
                break
            case 0xa:
                this.prgbank1 = data & 0x1f
                break
            case 0xb:
            case 0xc:
            case 0xd:
            case 0xe: {
                data &= 0xf
                const whichreg = (addr - 0xb000 >> 11) + (bit1 ? 1 : 0)
                let oldval = this.chrbank[whichreg]
                if (bit0) {
                    oldval = oldval & 0xf | data << 4
                }
                else {
                    oldval = oldval & 0xf0 | data
                }
                this.chrbank[whichreg] = oldval
                break
            }
            case 0xf:
                if (!bit1) {
                    if (bit0) {
                        this.irqreload = this.irqreload & 0xf | (data & 0xf) << 4
                    }
                    else {
                        this.irqreload = this.irqreload & 0xf0 | data & 0xf
                    }
                }
                else if (bit0) {
                    this.irqenable = this.irqack
                    if (this.firedinterrupt) {
                        --this.cpu!.interrupt
                    }
                    this.firedinterrupt = false
                }
                else {
                    this.irqack = (data & Utils.BIT0) !== 0
                    this.irqenable = (data & Utils.BIT1) !== 0
                    this.irqmode = (data & Utils.BIT2) !== 0
                    if (this.irqenable) {
                        this.irqcounter = this.irqreload
                        this.prescaler = 341
                    }
                    if (this.firedinterrupt) {
                        --this.cpu!.interrupt
                    }
                    this.firedinterrupt = false
                }
                break
        }
        if (addr < 0xf000) {
            this.setbanks()
        }
    }

    private setbanks(): void {
        if (this.prgmode) {
            for (let i = 1; i <= 8; ++i) {
                this.prg_map[8 - i] = this.prgsize - 1024 * i
            }
            for (let i = 1; i <= 8; ++i) {
                this.prg_map[32 - i] = this.prgsize - 1024 * i
            }
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 8] = 1024 * (i + 8 * this.prgbank0) % this.prgsize
            }
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 16] = 1024 * (i + 8 * this.prgbank1) % this.prgsize
            }
        }
        else {
            for (let i = 1; i <= 16; ++i) {
                this.prg_map[32 - i] = this.prgsize - 1024 * i
            }
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 1024 * (i + 8 * this.prgbank0) % this.prgsize
            }
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 8] = 1024 * (i + 8 * this.prgbank1) % this.prgsize
            }
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
}
