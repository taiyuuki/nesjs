
import { Utils } from '../../types'
import { Namco163SoundChip } from '../../audio/Namco163SoundChip'
import { Mapper } from '../Mapper'

export default class NamcoMapper extends Mapper {
    private soundAddr = 0
    private autoincrement = false
    private irqenable = false
    private interrupted = false
    private chrramenable0 = false
    private chrramenable1 = false

    private sound = new Namco163SoundChip()
    private hasInitSound = false
    private irqcounter = 0x3fff
    private chrbanks = new Array(8).fill(0)
    private chr_ram = new Array(16384).fill(0)

    override loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    override cartRead(addr: number): number {
        if (addr >= 0x4800 && addr < 0x5000) {

            // Namco163 音频扩展区
            if (!this.hasInitSound && this.cpuram?.apu) {
                this.cpuram.apu.addExpnSound(this.sound)
                this.hasInitSound = true
            }
            const retval = this.sound.read(this.soundAddr)
            if (this.autoincrement) {
                this.soundAddr = this.soundAddr + 1 & 0x7f
            }

            return retval
        }
        else if (addr < 0x5800) {
            this.irqack()

            return this.irqcounter & 0xff
        }
        else if (addr < 0x6000) {
            this.irqack()

            return this.irqcounter >> 8 & 0x7f | (this.irqenable ? 0x80 : 0)
        }
        else if (addr >= 0x8000) {
            return this.prg[this.prg_map[(addr & 0x7fff) >> 10] + (addr & 1023)]
        }
        else if (addr >= 0x6000 && this.hasprgram) {
            return this.prgram[addr & 0x1fff]
        }

        return addr >> 8 // open bus
    }

    override cartWrite(addr: number, data: number): void {
        if (addr < 0x4800 || addr >= 0x6000 && addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        else if (addr <= 0x4fff) {

            // Namco163 音频扩展区
            if (!this.hasInitSound && this.cpuram?.apu) {
                this.cpuram.apu.addExpnSound(this.sound)
                this.hasInitSound = true
            }
            this.sound.write(this.soundAddr, data)
            if (this.autoincrement) {
                this.soundAddr = this.soundAddr + 1 & 0x7f
            }
        }
        else if (addr <= 0x57ff) {
            this.irqcounter &= 0x7f00
            this.irqcounter |= data
            this.irqack()
        }
        else if (addr <= 0x5fff) {
            this.irqcounter &= 0xff
            this.irqcounter |= (data & 0x7f) << 8
            this.irqenable = (data & Utils.BIT7) !== 0
            this.irqack()
        }
        else if (addr <= 0xbfff) {
            const bank = addr >> 11 & 7
            this.setppubank(1, bank, data)
            this.chrbanks[bank] = data
        }
        else if (addr <= 0xc7ff) {

            // nametable select 1
            if (data < 0xe0) {

                this.nt0 = this.chr.slice(data * 1024, (data + 1) * 1024)
            }
            else {

                this.nt0 = (data & Utils.BIT0) === 0 ? this.pput0 : this.pput1
            }
        }
        else if (addr <= 0xc8ff) {

            // nametable select 2
            if (data < 0xe0) {

                this.nt1 = this.chr.slice(data * 1024, (data + 1) * 1024)
            }
            else {

                this.nt1 = (data & Utils.BIT0) === 0 ? this.pput0 : this.pput1
            }
        }
        else if (addr <= 0xd7ff) {

            // nametable select 3
            if (data < 0xe0) {

                this.nt2 = this.chr.slice(data * 1024, (data + 1) * 1024)
            }
            else {

                this.nt2 = (data & Utils.BIT0) === 0 ? this.pput0 : this.pput1
            }
        }
        else if (addr <= 0xdfff) {

            // nametable select 4
            if (data < 0xe0) {

                this.nt3 = this.chr.slice(data * 1024, (data + 1) * 1024)
            }
            else {

                this.nt3 = (data & Utils.BIT0) === 0 ? this.pput0 : this.pput1
            }
        }
        else if (addr <= 0xe7ff) {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 1024 * (i + 8 * (data & 63)) % this.prgsize
            }
        }
        else if (addr <= 0xefff) {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 8] = 1024 * (i + 8 * (data & 63)) % this.prgsize
            }
            this.chrramenable0 = !(data & Utils.BIT6)
            this.chrramenable1 = !(data & Utils.BIT7)
        }
        else if (addr <= 0xf7ff) {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i + 16] = 1024 * (i + 8 * (data & 63)) % this.prgsize
            }
        }
        else if (addr <= 0xffff) {
            this.autoincrement = (data & Utils.BIT7) !== 0
            this.soundAddr = data & 0x7f
        }
    }

    private irqack() {
        if (this.interrupted) {
            --this.cpu!.interrupt
            this.interrupted = false
        }
    }

    override cpucycle(cycles: number): void {
        this.irqcounter += cycles
        if (this.irqcounter > 0x7fff) {
            this.irqcounter = 0x7fff
        }
        if (this.irqcounter === 0x7fff && this.irqenable && !this.interrupted) {
            ++this.cpu!.interrupt
            this.interrupted = true
        }

        // Namco163 音频扩展时钟
        this.sound.clock(cycles)
    }

    protected setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) & this.chrsize - 1
        }
    }

    override ppuRead(addr: number): number {
        if (addr < 0x1000) {
            if (this.chrramenable0 && this.chrbanks[addr >> 10] > 0xe0) {
                return this.chr_ram[this.chr_map[addr >> 10] + (addr & 1023)]
            }
            else {
                return this.chr[this.chr_map[addr >> 10] + (addr & 1023)]
            }
        }
        else if (addr < 0x2000) {
            if (this.chrramenable1 && this.chrbanks[addr >> 10] > 0xe0) {
                return this.chr_ram[this.chr_map[addr >> 10] - (0xe0 << 10) + (addr & 1023)]
            }
            else {
                return this.chr[this.chr_map[addr >> 10] + (addr & 1023)]
            }
        }
        else {
            return super.ppuRead(addr)
        }
    }

    override ppuWrite(addr: number, data: number): void {
        addr &= 0x3fff
        if (addr < 0x1000) {
            if (this.chrramenable0 && this.chrbanks[addr >> 10] > 0xe0) {
                this.chr_ram[this.chr_map[addr >> 10] - (0xe0 << 10) + (addr & 1023)] = data
            }
            else {
                this.chr[this.chr_map[addr >> 10] + (addr & 1023)] = data
            }
        }
        else if (addr < 0x2000) {
            if (this.chrramenable1 && this.chrbanks[addr >> 10] > 0xe0) {
                this.chr_ram[this.chr_map[addr >> 10] - (0xe0 << 10) + (addr & 1023)] = data
            }
            else {
                this.chr[this.chr_map[addr >> 10] + (addr & 1023)] = data
            }
        }
        else {
            super.ppuWrite(addr, data)
        }
    }

    protected override postLoadState(state: any): void {

        // 重新初始化音频芯片实例，确保在读档后有正确的方法
        this.sound = new Namco163SoundChip()
        this.hasInitSound = false
        
        // 如果状态中有音频数据，恢复它
        if (state.sound && typeof state.sound === 'object') {

            // 恢复音频芯片的寄存器状态
            if (state.sound.registers) {

                // 通过写入操作恢复寄存器状态
                for (let i = 0; i < 128; i++) {
                    if (state.sound.registers[i] !== undefined) {
                        this.sound.write(i, state.sound.registers[i])
                    }
                }
            }
        }
    }
}
