
import { VRC7SoundChip } from '../../audio/VRC7SoundChip'
import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class VRC7Mapper extends Mapper {
    private prgbank0 = 0
    private prgbank1 = 0
    private prgbank2 = 0
    private chrbank = [0, 0, 0, 0, 0, 0, 0, 0]
    private irqmode = false
    private irqenable = false
    private irqack = false
    private firedinterrupt = false
    private irqreload = 0
    private irqcounter = 22
    private regaddr = 0
    private sndchip = new VRC7SoundChip()
    private hasInitSound = false
    private prescaler = 341

    public loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = (this.prgsize - 1024 * i) % this.prgsize
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
        const bit0 = (addr & Utils.BIT4) !== 0 || (addr & Utils.BIT3) !== 0
        const bit1 = (addr & Utils.BIT5) !== 0
        switch (addr >> 12) {
            case 0x8:
                if (bit0) {
                    this.prgbank1 = data
                }
                else {
                    this.prgbank0 = data
                }
                this.setbanks()
                break
            case 0x9:
                if (!bit0 && !bit1) {
                    this.prgbank2 = data
                    this.setbanks()
                }
                else if (bit0 && bit1) {
                    if (!this.hasInitSound) {
                        this.cpuram?.apu?.addExpnSound(this.sndchip)
                        this.hasInitSound = true
                    }
                    this.sndchip.write(this.regaddr, data)
                }
                else {
                    this.regaddr = data
                }
                break
            case 0xa:
                this.chrbank[bit0 ? 1 : 0] = data
                this.setbanks()
                break
            case 0xb:
                this.chrbank[(bit0 ? 1 : 0) + 2] = data
                this.setbanks()
                break
            case 0xc:
                this.chrbank[(bit0 ? 1 : 0) + 4] = data
                this.setbanks()
                break
            case 0xd:
                this.chrbank[(bit0 ? 1 : 0) + 6] = data
                this.setbanks()
                break
            case 0xe:
                if (bit0) {
                    this.irqreload = data
                }
                else {
                    switch (data & 3) {
                        case 0:
                            this.setmirroring(MirrorType.V_MIRROR)
                            break
                        case 1:
                            this.setmirroring(MirrorType.H_MIRROR)
                            break
                        case 2:
                            this.setmirroring(MirrorType.SS_MIRROR0)
                            break
                        case 3:
                            this.setmirroring(MirrorType.SS_MIRROR1)
                            break
                    }
                }
                break
            case 0xf:
                if (bit0) {
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
    }

    private setbanks(): void {
        for (let i = 1; i <= 8; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i] = 1024 * (i + 8 * this.prgbank0) % this.prgsize
        }
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i + 8] = 1024 * (i + 8 * this.prgbank1) % this.prgsize
        }
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i + 16] = 1024 * (i + 8 * this.prgbank2) % this.prgsize
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

    public scanlinecount(): void {
        if (this.irqenable) {
            if (this.irqcounter === 255) {
                this.irqcounter = this.irqreload
                if (!this.firedinterrupt) {
                    ++this.cpu!.interrupt
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
        this.sndchip = new VRC7SoundChip()
        this.hasInitSound = false
        
        // 如果状态中有音频数据，恢复它
        if (state.sndchip && typeof state.sndchip === 'object') {

            // 恢复音频芯片的寄存器状态
            if (state.sndchip.registers) {

                // 通过写入操作恢复寄存器状态
                const registers = state.sndchip.registers
                for (let i = 0; i < registers.length; i++) {
                    if (registers[i] !== undefined) {
                        this.sndchip.write(i, registers[i])
                    }
                }
            }
        }
    }
}
