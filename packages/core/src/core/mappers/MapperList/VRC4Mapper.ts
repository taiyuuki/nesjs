import type { ROMLoader } from '../../ROMLoader'
import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class VRC4Mapper extends Mapper {
    private static readonly registerMasks = [
        [0x42, 0x84],
        [0x15, 0x2A],
        [0x0A, 0x05],
    ]
    private registerMasks: number[]
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
                this.registerMasks = VRC4Mapper.registerMasks[0]
                break
            case 23:
                this.registerMasks = VRC4Mapper.registerMasks[1]
                break
            case 25:
                this.registerMasks = VRC4Mapper.registerMasks[2]
                break
            default:
                this.registerMasks = VRC4Mapper.registerMasks[0]
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
        const normalizedAddr = addr & 0xf000
            | ((addr & this.registerMasks[1]) === 0 ? 0 : 0x2)
            | ((addr & this.registerMasks[0]) === 0 ? 0 : 0x1)

        if (normalizedAddr >= 0xb000 && normalizedAddr <= 0xe003) {
            const whichreg = normalizedAddr >> 1 & 0x1 | normalizedAddr - 0xb000 >> 11
            const nibble = data & 0xf
            const oldval = this.chrbank[whichreg]

            if ((normalizedAddr & 0x1) === 0) {
                this.chrbank[whichreg] = oldval & 0x1f0 | nibble
            }
            else {

                // Some VRC2/VRC4 boards expose a 9th CHR bank bit via data bit4 on the high-nibble write.
                this.chrbank[whichreg] = oldval & 0x00f | nibble << 4 | (data & 0x10) << 4
            }

            this.setbanks()

            return
        }

        switch (normalizedAddr & 0xf003) {
            case 0x8000:
            case 0x8001:
            case 0x8002:
            case 0x8003:
                this.prgbank0 = data & 0x1f
                break
            case 0x9000:
            case 0x9001:
                if (data === 0xff) {
                    break
                }
                if (this.vrc2mirror) {
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
            case 0x9002:
            case 0x9003:
                this.prgmode = (data & Utils.BIT1) !== 0
                break
            case 0xa000:
            case 0xa001:
            case 0xa002:
            case 0xa003:
                this.prgbank1 = data & 0x1f
                break
            case 0xf000:
                this.irqreload = this.irqreload & 0xf0 | data & 0xf
                break
            case 0xf001:
                this.irqreload = this.irqreload & 0x0f | (data & 0xf) << 4
                break
            case 0xf002:
                this.irqack = (data & Utils.BIT0) !== 0
                this.irqenable = (data & Utils.BIT1) !== 0
                this.irqmode = (data & Utils.BIT2) !== 0
                this.irqcounter = this.irqreload
                this.prescaler = 341
                if (this.firedinterrupt && this.cpu) {
                    --this.cpu.interrupt
                }
                this.firedinterrupt = false
                break
            case 0xf003:
                this.irqenable = this.irqack
                if (this.firedinterrupt && this.cpu) {
                    --this.cpu.interrupt
                }
                this.firedinterrupt = false
                break
        }

        if (normalizedAddr < 0xf000) {
            this.setbanks()
        }
    }

    private setbanks(): void {
        if (this.prgmode) {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = this.prgsize - 16384 + 1024 * i
            }
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 24] = this.prgsize - 8192 + 1024 * i
            }
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 8] = 1024 * (i + 8 * this.prgbank1) % this.prgsize
            }
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 16] = 1024 * (i + 8 * this.prgbank0) % this.prgsize
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

    public cpucycle(cycles: number): void {
        if (this.irqenable) {
            if (this.irqmode) {
                while (cycles-- > 0) {
                    this.scanlinecount()
                }
            }
            else {
                this.prescaler -= cycles * 3
                while (this.prescaler <= 0) {
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
