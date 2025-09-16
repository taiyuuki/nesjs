import { Mapper } from '../Mapper'

export default class VRC3Mapper extends Mapper {
    private irqctr = 0
    private irqreload = 0
    private irqmode = false
    private irqenable = false
    private irqackenable = false
    private interrupted = false

    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 1; i <= 16; ++i) {
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
        switch (addr >> 12) {
            case 0x8:
                this.irqreload = this.irqreload & 0xFFF0 | data & 0xF
                break
            case 0x9:
                this.irqreload = this.irqreload & 0xFF0F | (data & 0xF) << 4
                break
            case 0xA:
                this.irqreload = this.irqreload & 0xF0FF | (data & 0xF) << 8
                break
            case 0xB:
                this.irqreload = this.irqreload & 0x0FFF | (data & 0xF) << 12
                break
            case 0xC:
                this.irqmode = (data & 0x4) !== 0
                this.irqackenable = (data & 0x1) !== 0
                this.irqenable = (data & 0x2) !== 0
                if (this.irqenable) {
                    if (this.irqmode) {
                        this.irqctr &= 0xFF00
                        this.irqctr |= this.irqreload & 0xFF
                    }
                    else {
                        this.irqctr = this.irqreload
                    }
                    if (this.interrupted) {
                        --this.cpu!.interrupt
                        this.interrupted = false
                    }
                }
                break
            case 0xD:
                this.irqenable = this.irqackenable
                if (this.interrupted) {
                    --this.cpu!.interrupt
                    this.interrupted = false
                }
                break
            case 0xF:
                for (let i = 0; i < 16; ++i) {
                    this.prg_map[i] = 1024 * (i + 16 * (data & 0xF)) & this.prgsize - 1
                }
                break
        }
    }

    public cpucycle(cycles: number): void {
        if (this.irqenable) {
            if (this.irqmode) {
                let temp = this.irqctr
                this.irqctr &= 0xFF00
                if (temp >= 0xFF) {
                    this.irqctr = this.irqreload
                    this.irqctr |= this.irqreload & 0xFF
                    if (!this.interrupted) {
                        ++this.cpu!.interrupt
                        this.interrupted = true
                    }
                }
                else {
                    temp += cycles
                    this.irqctr |= temp
                }
            }
            else if (this.irqctr >= 0xFFFF) {
                this.irqctr = this.irqreload
                if (!this.interrupted) {
                    ++this.cpu!.interrupt
                    this.interrupted = true
                }
            }
            else {
                this.irqctr += cycles
            }
        }
    }
}
