import { MMC5SoundChip } from '../../audio/MMC5SoundChip'
import { Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class MMC5Mapper extends Mapper {
    exram = new Uint8Array(1024)
    exramMode = 0
    chrMode = 0
    prgMode = 0
    wramWrite1 = 0
    wramWrite2 = 0
    multiplier1 = 0
    multiplier2 = 0
    prgpage = 0
    chrOr = 0
    wrambank = 0
    scanctrEnable = false
    irqPend = false
    chrregsA = new Array<number>(8).fill(0)
    chrregsB = new Array<number>(4).fill(0)
    prgregs = new Uint8Array(4)
    chrmapB = new Array<number>(4).fill(0)
    romHere = [false, false, false]
    scanctrLine = 0
    irqCounter = 20
    fillnt = new Array<number>(1024).fill(0)
    soundchip?: MMC5SoundChip
    inFrame = false
    prgram = new Uint8Array(65536)
    fetchcount = 0
    exlatch = 0
    lastfetch = 0
    prevfetch = 0
    prevprevfetch = 0
    spritemode = false
    cachedChrBank = 0

    /**
     * MMC5 存档恢复后的特殊处理
     */
    protected override postLoadState(state: any): void {

        // MMC5 恢复状态后需要重新设置银行映射
        this.setupPRG()
        this.setupCHR()
        
        // 重新初始化音频芯片实例，确保在读档后有正确的方法
        if (state.soundchip) {
            this.soundchip = new MMC5SoundChip()
            if (this.cpuram?.apu) {
                this.cpuram.apu.addExpnSound(this.soundchip)
            }
            
            // 如果状态中有音频数据，恢复它
            if (state.soundchip.registers) {

                // 通过写入操作恢复寄存器状态
                for (let i = 0; i < 16; i++) {
                    if (state.soundchip.registers[i] !== undefined) {
                        this.soundchip.write(i, state.soundchip.registers[i])
                    }
                }
            }
        }
        
        // 恢复镜像设置（如果存档中包含镜像数据）
        if (state.lastNtSetup !== undefined) {
            this.setMirroring(state.lastNtSetup, this.exram)
        }
    }

    /**
     * 重写getMapperState以提供MMC5特定的优化
     */
    override getMapperState(): any {
        const state = super.getMapperState()
        
        // 记录当前的nametable设置以便正确恢复
        // 这比在基类中保存完整的镜像配置更高效
        state.lastNtSetup = this.getCurrentNtSetup()
        
        return state
    }

    /**
     * 获取当前的nametable设置值
     */
    private getCurrentNtSetup(): number {
        let setup = 0
        
        // 分析每个nametable的当前配置
        setup |= this.getNtType(this.nt0)
        setup |= this.getNtType(this.nt1) << 2
        setup |= this.getNtType(this.nt2) << 4
        setup |= this.getNtType(this.nt3) << 6
        
        return setup
    }

    /**
     * 判断nametable的类型
     */
    private getNtType(nt: number[]): number {
        if (nt === this.pput0) return 0
        if (nt === this.pput1) return 1
        if (nt === this.fillnt) return 3

        // 扩展RAM的情况
        return 2
    }

    override loadROM(): void {
        super.loadROM()

        // MMC5 支持最多 256KB CHR (64个4KB banks)
        // 如果CHR ROM很小,扩展为CHR RAM
        if (this.chrsize < 262144) {
            this.haschrram = true
            const newChrSize = 262144 // 256KB
            const newChr = new Array(newChrSize).fill(0)

            for (let i = 0; i < this.chr.length; i++) {
                newChr[i] = this.chr[i]
            }

            this.chr = newChr
            this.chrsize = newChrSize
        }
        
        this.prgregs[3] = this.prgsize / 8192 - 1
        this.prgregs[2] = this.prgsize / 8192 - 1
        this.prgregs[1] = this.prgsize / 8192 - 1
        this.prgregs[0] = this.prgsize / 8192 - 1
        this.prgMode = 3
        this.setupPRG()
        
        for (let i = 0; i < 4; ++i) {
            this.chrmapB[i] = 1024 * i % this.chrsize
        }
        this.setupCHR()
        this.prgram = new Uint8Array(65536)
    }

    override cartWrite(addr: number, data: number): void {
        if (addr < 0x5c00) {
            switch (addr) {
                case 0x5000: case 0x5001: case 0x5002: case 0x5003:
                case 0x5004: case 0x5005: case 0x5006: case 0x5007:
                case 0x5010: case 0x5011: case 0x5015:
                    if (!this.soundchip) {
                        this.soundchip = new MMC5SoundChip()
                        this.cpuram?.apu?.addExpnSound(this.soundchip)
                    }
                    this.soundchip.write(addr - 0x5000, data)
                    break
                case 0x5100:
                    this.prgMode = data & 3
                    this.setupPRG()
                    break
                case 0x5101:
                    this.chrMode = data & 3
                    this.setupCHR()
                    break
                case 0x5102:
                    this.wramWrite1 = data
                    break
                case 0x5103:
                    this.wramWrite2 = data
                    break
                case 0x5104:
                    this.exramMode = data & 3
                    break
                case 0x5105:
                    this.setMirroring(data, this.exram)
                    break
                case 0x5106:
                    this.fillnt.fill(data, 0, 32 * 30)
                    break
                case 0x5107:
                    this.fillnt.fill((data & 0x3) + ((data & 3) << 2) + ((data & 3) << 4) + ((data & 3) << 6), 32 * 30)
                    break
                case 0x5113:
                    this.wrambank = data & 7
                    break
                case 0x5114:
                    this.prgregs[0] = data & 0x7f
                    this.romHere[0] = !!(data & Utils.BIT7)
                    this.setupPRG()
                    break
                case 0x5115:
                    this.prgregs[1] = data & 0x7f
                    this.romHere[1] = !!(data & Utils.BIT7)
                    this.setupPRG()
                    break
                case 0x5116:
                    this.prgregs[2] = data & 0x7f
                    this.romHere[2] = !!(data & Utils.BIT7)
                    this.setupPRG()
                    break
                case 0x5117:
                    this.prgregs[3] = data & 0x7f
                    this.setupPRG()
                    break
                case 0x5120: case 0x5121: case 0x5122: case 0x5123:
                case 0x5124: case 0x5125: case 0x5126: case 0x5127:
                    this.chrregsA[addr - 0x5120] = data | this.chrOr
                    this.setupCHR()
                    break
                case 0x5128: case 0x5129: case 0x512a: case 0x512b:
                    this.chrregsB[addr - 0x5128] = data | this.chrOr
                    this.setupCHR()
                    break
                case 0x5130:
                    this.chrOr = (data & 3) << 8
                    break
                case 0x5200:
                    if (data & Utils.BIT7) {
                        console.warn('Split screen mode not supported yet')
                    }
                    break
                case 0x5203:
                    this.scanctrLine = data
                    break
                case 0x5204:
                    this.scanctrEnable = !!(data & Utils.BIT7)
                    break
                case 0x5205:
                    this.multiplier1 = data
                    break
                case 0x5206:
                    this.multiplier2 = data
                    break
                default:
                    break
            }
        }
        else if (addr < 0x6000) {
            this.exram[addr - 0x5c00] = data
        }
        else if (addr < 0x8000) {
            const wramaddr = this.wrambank * 8192 + (addr - 0x6000)
            this.prgram[wramaddr] = data
        }
        else if (addr < 0xA000 && !this.romHere[0] && this.prgMode === 3) {
            this.prgram[(this.prgregs[0] & 7) * 8192 + (addr - 0x8000)] = data
        }
        else if (addr < 0xC000 && !this.romHere[1]) {
            const subaddr = this.prgMode === 3 ? 0xA000 : 0x8000
            const prgbank = this.prgMode === 3 ? this.prgregs[1] & 7 : (this.prgregs[1] & 7) >> 1
            const ramaddr = prgbank * (this.prgMode === 3 ? 8192 : 16384) + (addr - subaddr)
            this.prgram[ramaddr] = data
        }
        else if (addr < 0xE000 && !this.romHere[2]) {
            this.prgram[(this.prgregs[2] & 7) * 8192 + (addr - 0xc000)] = data
        }
    }

    override cartRead(addr: number): number {
        if (!this.ppu?.renderingOn() || this.ppu.scanline > 241) {
            this.inFrame = false
        }
        if (addr >= 0x8000) {
            if (this.prgMode === 0
                || this.prgMode === 1 && (addr >= 0xc000 || this.romHere[1])
                || this.prgMode === 2 && (addr >= 0xe000 || addr >= 0xc000 && this.romHere[2] || this.romHere[1])
                || this.prgMode === 3 && (addr >= 0xe000 || addr >= 0xc000 && this.romHere[2] || addr >= 0xa000 && this.romHere[1] || this.romHere[0])) {
                return this.prg[this.prg_map[(addr & 0x7fff) >> 10] + (addr & 1023)]
            }
            else {
                return 0xffff
            }
        }
        else if (addr >= 0x6000) {
            const ramaddr = this.wrambank * 8192 + (addr - 0x6000)

            return this.prgram[ramaddr]
        }
        else if (addr >= 0x5c00) {
            return this.exram[addr - 0x5c00]
        }
        else {
            switch (addr) {
                case 0x5015:
                    return this.soundchip ? this.soundchip.status() : addr >> 8
                case 0x5204:
                    const stat = (this.irqPend ? 0x80 : 0) + (this.inFrame ? 0x40 : 0)
                    if (this.irqPend) {
                        this.irqPend = false
                        --this.cpu!.interrupt
                    }

                    return stat
                case 0x5205:
                    return this.multiplier1 * this.multiplier2 & 0xff
                case 0x5206:
                    return this.multiplier1 * this.multiplier2 >> 8 & 0xff
                default:
                    return addr >> 8
            }
        }
    }

    setupPRG() {
        switch (this.prgMode) {
            case 1:
                this.setcpubank(16, 16, (this.prgregs[3] & 0x7f) >> 1)
                this.setcpubank(16, 0, (this.prgregs[1] & 0x7f) >> 1)
                break
            case 2:
                this.setcpubank(8, 24, this.prgregs[3] & 0x7f)
                this.setcpubank(8, 16, this.prgregs[2] & 0x7f)
                this.setcpubank(8, 8, this.prgregs[1] & 0x7f | 1)
                this.setcpubank(8, 0, this.prgregs[1] & 0x7e)
                break
            case 3:
                this.setcpubank(8, 24, this.prgregs[3] & 0x7f)
                this.setcpubank(8, 16, this.prgregs[2] & 0x7f)
                this.setcpubank(8, 8, this.prgregs[1] & 0x7f)
                this.setcpubank(8, 0, this.prgregs[0] & 0x7f)
                break
            case 0:
            default:
                this.setcpubank(32, 0, (this.prgregs[3] & 0x7f) >> 2)
                break
        }
    }

    setupCHR() {
        switch (this.chrMode) {
            case 1:
                this.setppubank(4, 4, this.chrregsA[7])
                this.setppubank(4, 0, this.chrregsA[3])
                this.setppubankB(4, 0, this.chrregsB[3])
                break
            case 2:
                this.setppubank(2, 6, this.chrregsA[7])
                this.setppubank(2, 4, this.chrregsA[5])
                this.setppubank(2, 2, this.chrregsA[3])
                this.setppubank(2, 0, this.chrregsA[1])
                this.setppubankB(2, 2, this.chrregsB[3])
                this.setppubankB(2, 0, this.chrregsB[1])
                break
            case 3:
                this.setppubank(1, 7, this.chrregsA[7])
                this.setppubank(1, 6, this.chrregsA[6])
                this.setppubank(1, 5, this.chrregsA[5])
                this.setppubank(1, 4, this.chrregsA[4])
                this.setppubank(1, 3, this.chrregsA[3])
                this.setppubank(1, 2, this.chrregsA[2])
                this.setppubank(1, 1, this.chrregsA[1])
                this.setppubank(1, 0, this.chrregsA[0])
                this.setppubankB(1, 3, this.chrregsB[3])
                this.setppubankB(1, 2, this.chrregsB[2])
                this.setppubankB(1, 1, this.chrregsB[1])
                this.setppubankB(1, 0, this.chrregsB[0])
                break
            case 0:
            default:
                this.setppubank(8, 0, this.chrregsA[7])
                this.setppubankB(4, 0, this.chrregsB[3])
                break
        }
    }

    setppubank(banksize: number, bankpos: number, banknum: number) {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }

    setppubankB(banksize: number, bankpos: number, banknum: number) {
        for (let i = 0; i < banksize; ++i) {
            this.chrmapB[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }

    setcpubank(banksize: number, bankpos: number, banknum: number) {
        for (let i = 0; i < banksize; ++i) {
            this.prg_map[i + bankpos] = 1024 * (banknum * banksize + i) & this.prgsize - 1
        }
    }

    override ppuWrite(addr: number, data: number): void {
        addr &= 0x3fff
        if (addr < 0x2000 && this.haschrram) {
            const chrIndex = this.chr_map[addr >> 10] + (addr & 1023)
            this.chr[chrIndex] = data
        }
        else {
            super.ppuWrite(addr, data)
        }
    }

    override ppuRead(addr: number): number {
        if (addr < 0x2000) {
            if (++this.fetchcount === 3) {
                this.spritemode = true
            }
            if (this.spritemode) {
                return this.chr[this.chr_map[addr >> 10] + (addr & 1023)]
            }
            else {
                if (this.exramMode === 1) {
                    if (this.exlatch === 2 || this.exlatch === 3) {
                        let chrBank: number

                        if (this.exlatch === 2) {
                            const exAttr = this.exram[this.lastfetch]
                            const chrBankLow = exAttr & 0x3f
                            const chrBankHigh = (this.chrOr & 0x300) >> 2
                            chrBank = chrBankLow | chrBankHigh
                            this.cachedChrBank = chrBank
                        }
                        else {
                            chrBank = this.cachedChrBank
                        }

                        const chrAddr = chrBank * 4096 + (addr & 0xfff)
                        const result = this.chr[chrAddr % this.chr.length]
                        this.exlatch = this.exlatch === 2 ? 3 : 0

                        return result
                    }
                }

                if (this.haschrram) {
                    return this.chr[this.chr_map[addr >> 10] + (addr & 1023)]
                }
                else {
                    return this.chr[this.chrmapB[addr >> 10 & 3] + (addr & 1023)]
                }
            }
        }
        else {
            if (this.prevfetch === this.prevprevfetch && this.prevprevfetch === addr) {
                this.incScanline()
                this.exlatch = 0
            }
            this.prevprevfetch = this.prevfetch
            this.prevfetch = addr
            this.spritemode = false
            this.fetchcount = 0
            if (this.exramMode === 1) {
                if (this.exlatch === 0) {
                    ++this.exlatch
                    this.lastfetch = addr & 0x3ff
                }
                else if (this.exlatch === 1) {
                    ++this.exlatch
                    const theone = this.exram[this.lastfetch]

                    const attrBits = (theone & 0xc0) >> 6

                    return attrBits | attrBits << 2 | attrBits << 4 | attrBits << 6
                }
            }

            return super.ppuRead(addr)
        }
    }

    incScanline() {
        if (this.inFrame) {
            if (this.irqCounter++ === this.scanctrLine) {
                this.irqPend = true
            }
            if (this.irqPend && this.scanctrEnable) {
                ++this.cpu!.interrupt
            }
        }
        else {
            this.inFrame = true
            this.irqCounter = 0
            if (this.irqPend) {
                this.irqPend = false
                --this.cpu!.interrupt
            }
        }
    }

    setMirroring(ntsetup: number, exram: Uint8Array) {
        
        // 设置 nametable 0
        switch (ntsetup & 3) {
            case 0:
                this.nt0 = this.pput0
                break
            case 1:
                this.nt0 = this.pput1
                break
            case 2:
                this.nt0 = exram as any
                break
            case 3:
                this.nt0 = this.fillnt
                break
            default:
                this.nt0 = this.pput0
                break
        }
        
        ntsetup >>= 2

        // 设置 nametable 1
        switch (ntsetup & 3) {
            case 0:
                this.nt1 = this.pput0
                break
            case 1:
                this.nt1 = this.pput1
                break
            case 2:
                this.nt1 = exram as any
                break
            case 3:
                this.nt1 = this.fillnt
                break
            default:
                this.nt1 = this.pput0
                break
        }
        
        ntsetup >>= 2

        // 设置 nametable 2
        switch (ntsetup & 3) {
            case 0:
                this.nt2 = this.pput0
                break
            case 1:
                this.nt2 = this.pput1
                break
            case 2:
                this.nt2 = exram as any
                break
            case 3:
                this.nt2 = this.fillnt
                break
            default:
                this.nt2 = this.pput0
                break
        }
        
        ntsetup >>= 2

        // 设置 nametable 3
        switch (ntsetup & 3) {
            case 0:
                this.nt3 = this.pput0
                break
            case 1:
                this.nt3 = this.pput1
                break
            case 2:
                this.nt3 = exram as any
                break
            case 3:
                this.nt3 = this.fillnt
                break
            default:
                this.nt3 = this.pput0
                break
        }
    }
    
}
