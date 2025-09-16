
import type { CPU } from './CPU'
import type { CPURAM } from './CPURAM'
import type { NES } from './NES'
import { TVType, Utils } from './types'
import type { AudioOutputInterface, ExpansionSoundChip } from './interfaces'
import type { Timer } from './audio/Timer'
import { SquareTimer } from './audio/SquareTimer'
import { TriangleTimer } from './audio/TriangleTimer'
import { NoiseTimer } from './audio/NoiseTimer'
import { compressArrayIfPossible, decompressArray } from './utils'

// 默认音频输出接口（静音）
class DefaultAudioOutput implements AudioOutputInterface {
    flushFrame() {}

    outputSample(_sample: number) {}
}

export class APU {
    private readonly timers: Timer[] = [
        new SquareTimer(8, 2), 
        new SquareTimer(8, 2),
        new TriangleTimer(), 
        new NoiseTimer(),
    ]
    private cyclespersample: number = 0
    public sprdmaCount: number = 0
    private apucycle: number = 0
    private remainder: number = 0
    private noiseperiod: Uint16Array = new Uint16Array(16)
    private accum: number = 0
    private readonly expnSound: ExpansionSoundChip[] = []
    private soundFiltering: boolean = true
    private static readonly TNDLOOKUP: Uint16Array = APU.initTndLookup()
    private static readonly SQUARELOOKUP: Uint16Array = APU.initSquareLookup()
    private framectrreload: number = 0
    private framectrdiv: number = 7456
    private dckiller: number = -6392 // 移除开机噪音
    private lpaccum: number = 0
    private apuintflag: boolean = true
    private statusdmcint: boolean = false
    private statusframeint: boolean = false
    private framectr: number = 0
    private ctrmode: number = 4
    private readonly lenCtrEnable: Uint8Array = new Uint8Array([1, 1, 1, 1])
    private readonly volume: Uint8Array = new Uint8Array(4)
    
    // DMC 实例变量
    private dmcperiods: Uint16Array = new Uint16Array(16)
    private dmcrate: number = 0x36
    private dmcpos: number = 0
    private dmcshiftregister: number = 0
    private dmcbuffer: number = 0
    private dmcvalue: number = 0
    private dmcsamplelength: number = 1
    private dmcsamplesleft: number = 0
    private dmcstartaddr: number = 0xc000
    private dmcaddr: number = 0xc000
    private dmcbitsleft: number = 8
    private dmcsilence: boolean = true
    private dmcirq: boolean = false
    private dmcloop: boolean = false
    private dmcBufferEmpty: boolean = true
    
    // 长度计数器实例变量
    private readonly lengthctr: Uint8Array = new Uint8Array(4)
    private static readonly lenctrload: Uint8Array = new Uint8Array([
        10, 254, 20, 2, 40, 4, 80, 6,
        160, 8, 60, 10, 14, 12, 26, 14,
        12, 16, 24, 18, 48, 20, 96, 22,
        192, 24, 72, 26, 16, 28, 32, 30,
    ])
    private readonly lenctrHalt: Uint8Array = new Uint8Array([1, 1, 1, 1])
    
    // 线性计数器实例变量
    private linearctr: number = 0
    private linctrreload: number = 0
    private linctrflag: boolean = false
    
    // 包络单元实例变量
    private readonly envelopeValue: Uint8Array = new Uint8Array([15, 15, 15, 15])
    private readonly envelopeCounter: Uint8Array = new Uint8Array([0, 0, 0, 0])
    private readonly envelopePos: Uint8Array = new Uint8Array([0, 0, 0, 0])
    private readonly envConstVolume: Uint8Array = new Uint8Array([1, 1, 1, 1]) 
    private readonly envelopeStartFlag: Uint8Array = new Uint8Array([0, 0, 0, 0]) 
    
    // 扫频单元实例变量
    private readonly sweepenable: Uint8Array = new Uint8Array([0, 0]) 
    private readonly sweepnegate: Uint8Array = new Uint8Array([0, 0]) 
    private readonly sweepsilence: Uint8Array = new Uint8Array([0, 0])
    private readonly sweepreload: Uint8Array = new Uint8Array([0, 0])
    private readonly sweepperiod: Uint8Array = new Uint8Array([15, 15])
    private readonly sweepshift: Uint8Array = new Uint8Array([0, 0])
    private readonly sweeppos: Uint8Array = new Uint8Array([0, 0])
    
    private cyclesperframe: number = 0
    private ai: AudioOutputInterface = new DefaultAudioOutput()

    // Duty cycle 查找表
    private static readonly DUTYLOOKUP: number[][] = [
        [0, 1, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 0, 0, 0],
        [1, 0, 0, 1, 1, 1, 1, 1],
    ]

    constructor(
        public samplerate: number,
        private cpu: CPU, // CPU接口
        private cpuram: CPURAM, // CPURAM接口
        public nes: NES, // NES接口
    ) {
        this.setParameters()
    }

    private static initTndLookup(): Uint16Array {
        const lookup = new Uint16Array(203)
        for (let i = 0; i < lookup.length; ++i) {
            if (i === 0) {
                lookup[i] = 0
            } 
            else {
                lookup[i] = Math.floor(163.67 / (24329.0 / i + 100) * 49151)
            }
        }

        return lookup
    }

    private static initSquareLookup(): Uint16Array {
        const lookup = new Uint16Array(31)
        for (let i = 0; i < lookup.length; ++i) {
            if (i === 0) {
                lookup[i] = 0
            } 
            else {
                lookup[i] = Math.floor(95.52 / (8128.0 / i + 100) * 49151)
            }
        }

        return lookup
    }

    public setParameters(): void {
        this.soundFiltering = true // 默认开启音频过滤
        const tvtype = this.cpuram.mapper.getTVType()

        // 根据TV制式设置参数
        switch (tvtype) {

            case TVType.DENDY:
                this.dmcperiods.set([428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54])
                this.noiseperiod.set([4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068])
                this.framectrreload = 7456
                this.cyclespersample = 1773448.0 / this.samplerate
                this.cyclesperframe = 35469
                break

            case TVType.PAL:
                this.cyclespersample = 1662607.0 / this.samplerate
                this.dmcperiods.set([398, 354, 316, 298, 276, 236, 210, 198, 176, 148, 132, 118, 98, 78, 66, 50])
                this.noiseperiod.set([4, 8, 14, 30, 60, 88, 118, 148, 188, 236, 354, 472, 708, 944, 1890, 3778])
                this.framectrreload = 8312
                this.cyclesperframe = 33252
                break
            case TVType.NTSC:
            default:
                this.dmcperiods.set([428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54])
                this.noiseperiod.set([4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068])
                this.framectrreload = 7456
                this.cyclespersample = 1789773.0 / this.samplerate
                this.cyclesperframe = 29781
                break
        }
    }

    public setAudioInterface(ai: AudioOutputInterface): void {
        this.ai = ai
    }

    public read(addr: number): number {
        this.updateto(Math.floor(this.cpu.clocks))
        
        switch (addr) {
            case 0x15:

                // 返回通道状态
                const returnval = (this.lengthctr[0] > 0 ? 1 : 0)
                    | (this.lengthctr[1] > 0 ? 2 : 0)
                    | (this.lengthctr[2] > 0 ? 4 : 0)
                    | (this.lengthctr[3] > 0 ? 8 : 0)
                    | (this.dmcsamplesleft > 0 ? 16 : 0)
                    | (this.statusframeint ? 64 : 0)
                    | (this.statusdmcint ? 128 : 0)

                if (this.statusframeint) {
                    --this.cpu.interrupt
                    this.statusframeint = false
                }

                return returnval

            case 0x16:

                return this.nes.getController1().getbyte()

            case 0x17:

                return this.nes.getController2().getbyte()

            default:
                return 0x40 // open bus
        }
    }

    public addExpnSound(chip: ExpansionSoundChip): void {
        this.expnSound.push(chip)
    }

    public write(reg: number, data: number): void {
        this.updateto(Math.floor(this.cpu.clocks - 1))

        switch (reg) {
            case 0x0:

                // 脉冲1通道设置
                this.lenctrHalt[0] = data & Utils.BIT5 ? 1 : 0
                this.timers[0].setduty(APU.DUTYLOOKUP[data >> 6])
                this.envConstVolume[0] = data & Utils.BIT4 ? 1 : 0
                this.envelopeValue[0] = data & 15
                break

            case 0x1:

                // 脉冲1扫频设置
                this.sweepenable[0] = data & Utils.BIT7 ? 1 : 0
                this.sweepperiod[0] = data >> 4 & 7
                this.sweepnegate[0] = data & Utils.BIT3 ? 1 : 0
                this.sweepshift[0] = data & 7
                this.sweepreload[0] = 1
                break

            case 0x2:

                // 脉冲1定时器低位
                this.timers[0].setperiod((this.timers[0].getperiod() & 0xfe00) + (data << 1))
                break

            case 0x3:

                // 长度计数器加载，定时器1高位
                if (this.lenCtrEnable[0]) {
                    this.lengthctr[0] = APU.lenctrload[data >> 3]
                }
                this.timers[0].setperiod((this.timers[0].getperiod() & 0x1ff) + ((data & 7) << 9))
                this.timers[0].reset()
                this.envelopeStartFlag[0] = 1
                break

            case 0x4:

                // 脉冲2通道设置
                this.lenctrHalt[1] = data & Utils.BIT5 ? 1 : 0
                this.timers[1].setduty(APU.DUTYLOOKUP[data >> 6])
                this.envConstVolume[1] = data & Utils.BIT4 ? 1 : 0
                this.envelopeValue[1] = data & 15
                break

            case 0x5:

                // 脉冲2扫频设置
                this.sweepenable[1] = data & Utils.BIT7 ? 1 : 0
                this.sweepperiod[1] = data >> 4 & 7
                this.sweepnegate[1] = data & Utils.BIT3 ? 1 : 0
                this.sweepshift[1] = data & 7
                this.sweepreload[1] = 1
                break

            case 0x6:

                // 脉冲2定时器低位
                this.timers[1].setperiod((this.timers[1].getperiod() & 0xfe00) + (data << 1))
                break

            case 0x7:
                if (this.lenCtrEnable[1]) {
                    this.lengthctr[1] = APU.lenctrload[data >> 3]
                }
                this.timers[1].setperiod((this.timers[1].getperiod() & 0x1ff) + ((data & 7) << 9))
                this.timers[1].reset()
                this.envelopeStartFlag[1] = 1
                break

            case 0x8:

                // 三角波线性计数器加载
                this.linctrreload = data & 0x7f
                this.lenctrHalt[2] = data & Utils.BIT7 ? 1 : 0
                break

            case 0x9:
                break

            case 0xA:

                // 三角波定时器低位
                this.timers[2].setperiod((this.timers[2].getperiod() & 0xff00) + data)
                break

            case 0xB:

                // 三角波长度计数器加载和定时器高位
                if (this.lenCtrEnable[2]) {
                    this.lengthctr[2] = APU.lenctrload[data >> 3]
                }
                this.timers[2].setperiod((this.timers[2].getperiod() & 0xff) + ((data & 7) << 8))
                this.linctrflag = true
                break

            case 0xC:

                // 噪声通道设置
                this.lenctrHalt[3] = data & Utils.BIT5 ? 1 : 0
                this.envConstVolume[3] = data & Utils.BIT4 ? 1 : 0
                this.envelopeValue[3] = data & 0xf
                break

            case 0xD:
                break

            case 0xE:
                this.timers[3].setduty((data & Utils.BIT7) === 0 ? 1 : 6)
                this.timers[3].setperiod(this.noiseperiod[data & 15])
                break

            case 0xF:

                // 噪声长度计数器加载，包络重启
                if (this.lenCtrEnable[3]) {
                    this.lengthctr[3] = APU.lenctrload[data >> 3]
                }
                this.envelopeStartFlag[3] = 1
                break

            case 0x10:
                this.dmcirq = (data & Utils.BIT7) !== 0
                this.dmcloop = (data & Utils.BIT6) !== 0
                this.dmcrate = this.dmcperiods[data & 0xf]
                if (!this.dmcirq && this.statusdmcint) {
                    --this.cpu.interrupt
                    this.statusdmcint = false
                }
                break

            case 0x11:
                this.dmcvalue = data & 0x7f
                break

            case 0x12:
                this.dmcstartaddr = (data << 6) + 0xc000
                break

            case 0x13:
                this.dmcsamplelength = (data << 4) + 1
                break

            case 0x14:

                // Sprite DMA
                for (let i = 0; i < 256; ++i) {
                    this.cpuram.write(0x2004, this.cpuram.read((data << 8) + i))
                }
                this.sprdmaCount = 2
                break

            case 0x15:

                // 状态寄存器
                for (let i = 0; i < 4; ++i) {
                    this.lenCtrEnable[i] = data & 1 << i ? 1 : 0
                    if (!this.lenCtrEnable[i]) {
                        this.lengthctr[i] = 0
                    }
                }
                if ((data & Utils.BIT4) === 0) {
                    this.dmcsamplesleft = 0
                    this.dmcsilence = true
                }
                else if (this.dmcsamplesleft === 0) {
                    this.restartdmc()
                }
                if (this.statusdmcint) {
                    --this.cpu.interrupt
                    this.statusdmcint = false
                }
                break

            case 0x16:

                // 控制器锁存
                const latchValue = (data & Utils.BIT0) !== 0
                this.nes.getController1().output(latchValue)
                this.nes.getController2().output(latchValue)
                break

            case 0x17:
                this.ctrmode = (data & Utils.BIT7) === 0 ? 4 : 5
                this.apuintflag = (data & Utils.BIT6) !== 0
                this.framectr = 0
                this.framectrdiv = this.framectrreload + 8
                if (this.apuintflag && this.statusframeint) {
                    this.statusframeint = false
                    --this.cpu.interrupt
                }
                if (this.ctrmode === 5) {
                    this.setenvelope()
                    this.setlinctr()
                    this.setlength()
                    this.setsweep()
                }
                break

            default:
                break
        }
    }

    public updateto(cpucycle: number): void {
        if (this.soundFiltering) {

            // 线性采样代码
            while (this.apucycle < cpucycle) {
                ++this.remainder
                this.clockdmc()
                if (--this.framectrdiv <= 0) {
                    this.framectrdiv = this.framectrreload
                    this.clockframecounter()
                }
                this.timers[0].clock()
                this.timers[1].clock()
                if (this.lengthctr[2] > 0 && this.linearctr > 0) {
                    this.timers[2].clock()
                }
                this.timers[3].clock()
                if (this.expnSound.length > 0) {
                    for (const c of this.expnSound) {
                        c.clock(1)
                    }
                }
                this.accum += this.getOutputLevel()

                if (this.apucycle % this.cyclespersample < 1) {
                    const sample = this.lowpassFilter(this.highpassFilter(Math.floor(this.accum / this.remainder)))

                    this.ai.outputSample(sample)
                    
                    this.remainder = 0
                    this.accum = 0
                }
                ++this.apucycle
            }
        }
        else {

            // 点采样代码
            while (this.apucycle < cpucycle) {
                ++this.remainder
                this.clockdmc()
                if (--this.framectrdiv <= 0) {
                    this.framectrdiv = this.framectrreload
                    this.clockframecounter()
                }
                if (this.apucycle % this.cyclespersample < 1) {
                    this.timers[0].clock(this.remainder)
                    this.timers[1].clock(this.remainder)
                    if (this.lengthctr[2] > 0 && this.linearctr > 0) {
                        this.timers[2].clock(this.remainder)
                    }
                    this.timers[3].clock(this.remainder)
                    const mixvol = this.getOutputLevel()
                    if (this.expnSound.length > 0) {
                        for (const c of this.expnSound) {
                            c.clock(this.remainder)
                        }
                    }
                    this.remainder = 0
                    const sample = this.lowpassFilter(this.highpassFilter(mixvol))
                  
                    this.ai.outputSample(sample)
                    
                }
                ++this.apucycle
            }
        }
    }

    private getOutputLevel(): number {
        const square1 = this.volume[0] * this.timers[0].getval()
        const square2 = this.volume[1] * this.timers[1].getval()
        const squareIndex = Math.min(square1 + square2, APU.SQUARELOOKUP.length - 1)
        
        const triangle = 3 * this.timers[2].getval()
        const noise = 2 * this.volume[3] * this.timers[3].getval()
        const tndIndex = Math.min(triangle + noise + this.dmcvalue, APU.TNDLOOKUP.length - 1)
        
        let vol = APU.SQUARELOOKUP[squareIndex]
        vol += APU.TNDLOOKUP[tndIndex]
        
        if (this.expnSound.length > 0) {
            vol *= 0.8
            for (const c of this.expnSound) {
                vol += c.getval()
            }
        }

        return vol
    }

    private highpassFilter(sample: number): number {

        // 用于消除信号中的直流分量
        sample -= this.dckiller
        this.dckiller += sample >> 8 // 实际的高通部分
        this.dckiller += sample > 0 ? 1 : -1 // 保证信号衰减到零

        return sample
    }

    private lowpassFilter(sample: number): number {
        return this.lpaccum += 0.5 * (sample - this.lpaccum) // y = y + a * (x - y)
    }

    public finishframe(): void {
        this.updateto(this.cyclesperframe)
        this.apucycle = 0
        this.ai.flushFrame()
    }

    private clockframecounter(): void {
        if (this.ctrmode === 4 || this.ctrmode === 5 && this.framectr !== 3) {
            this.setenvelope()
            this.setlinctr()
        }
        if (this.ctrmode === 4 && (this.framectr === 1 || this.framectr === 3)
            || this.ctrmode === 5 && (this.framectr === 1 || this.framectr === 4)) {
            this.setlength()
            this.setsweep()
        }
        if (!this.apuintflag && this.framectr === 3 && this.ctrmode === 4 && !this.statusframeint) {
            ++this.cpu.interrupt
            this.statusframeint = true
        }
        ++this.framectr
        this.framectr %= this.ctrmode
        this.setvolumes()
    }

    private setvolumes(): void {
        this.volume[0] = this.lengthctr[0] <= 0 || this.sweepsilence[0] ? 0 
            : this.envConstVolume[0] ? this.envelopeValue[0] : this.envelopeCounter[0]
        this.volume[1] = this.lengthctr[1] <= 0 || this.sweepsilence[1] ? 0 
            : this.envConstVolume[1] ? this.envelopeValue[1] : this.envelopeCounter[1]
        this.volume[3] = this.lengthctr[3] <= 0 ? 0 
            : this.envConstVolume[3] ? this.envelopeValue[3] : this.envelopeCounter[3]
    }

    private clockdmc(): void {
        if (this.dmcBufferEmpty && this.dmcsamplesleft > 0) {
            this.dmcfillbuffer()
        }
        this.dmcpos = (this.dmcpos + 1) % this.dmcrate
        if (this.dmcpos === 0) {
            if (this.dmcbitsleft <= 0) {
                this.dmcbitsleft = 8
                if (this.dmcBufferEmpty) {
                    this.dmcsilence = true
                }
                else {
                    this.dmcsilence = false
                    this.dmcshiftregister = this.dmcbuffer
                    this.dmcBufferEmpty = true
                }
            }
            if (!this.dmcsilence) {
                this.dmcvalue += (this.dmcshiftregister & Utils.BIT0) === 0 ? -2 : 2

                // DMC输出寄存器不会回绕
                if (this.dmcvalue > 0x7f) {
                    this.dmcvalue = 0x7f
                }
                if (this.dmcvalue < 0) {
                    this.dmcvalue = 0
                }
                this.dmcshiftregister >>= 1
                --this.dmcbitsleft
            }
        }
    }

    private dmcfillbuffer(): void {
        if (this.dmcsamplesleft > 0) {
            this.dmcbuffer = this.cpuram.read(this.dmcaddr++)
            this.dmcBufferEmpty = false
            this.cpu.stealcycles(4)
            if (this.dmcaddr > 0xffff) {
                this.dmcaddr = 0x8000
            }
            --this.dmcsamplesleft
            if (this.dmcsamplesleft === 0) {
                if (this.dmcloop) {
                    this.restartdmc()
                }
                else if (this.dmcirq && !this.statusdmcint) {
                    ++this.cpu.interrupt
                    this.statusdmcint = true
                }
            }
        }
        else {
            this.dmcsilence = true
        }
    }

    private restartdmc(): void {
        this.dmcaddr = this.dmcstartaddr
        this.dmcsamplesleft = this.dmcsamplelength
        this.dmcsilence = false
    }

    private setlength(): void {
        for (let i = 0; i < 4; ++i) {
            if (!this.lenctrHalt[i] && this.lengthctr[i] > 0) {
                --this.lengthctr[i]
                if (this.lengthctr[i] === 0) {
                    this.setvolumes()
                }
            }
        }
    }

    private setlinctr(): void {
        if (this.linctrflag) {
            this.linearctr = this.linctrreload
        }
        else if (this.linearctr > 0) {
            --this.linearctr
        }
        if (this.lenctrHalt[2] === 0) {
            this.linctrflag = false
        }
    }

    private setenvelope(): void {
        for (let i = 0; i < 4; ++i) {
            if (this.envelopeStartFlag[i]) {
                this.envelopeStartFlag[i] = 0
                this.envelopePos[i] = this.envelopeValue[i] + 1
                this.envelopeCounter[i] = 15
            }
            else {
                --this.envelopePos[i]
            }
            if (this.envelopePos[i] <= 0) {
                this.envelopePos[i] = this.envelopeValue[i] + 1
                if (this.envelopeCounter[i] > 0) {
                    --this.envelopeCounter[i]
                }
                else if (this.lenctrHalt[i] && this.envelopeCounter[i] <= 0) {
                    this.envelopeCounter[i] = 15
                }
            }
        }
    }

    private setsweep(): void {
        for (let i = 0; i < 2; ++i) {
            this.sweepsilence[i] = 0
            if (this.sweepreload[i]) {
                this.sweepreload[i] = 0
                this.sweeppos[i] = this.sweepperiod[i]
            }
            ++this.sweeppos[i]
            const rawperiod = this.timers[i].getperiod() >> 1
            let shiftedperiod = rawperiod >> this.sweepshift[i]
            if (this.sweepnegate[i]) {

                // 对周期取反，第二通道时加1
                shiftedperiod = -shiftedperiod + i
            }
            shiftedperiod += rawperiod
            if (rawperiod < 8 || shiftedperiod > 0x7ff) {

                // 静音通道
                this.sweepsilence[i] = 1
            }
            else if (this.sweepenable[i] && this.sweepshift[i] !== 0 && this.lengthctr[i] > 0
                && this.sweeppos[i] > this.sweepperiod[i]) {
                this.sweeppos[i] = 0
                this.timers[i].setperiod(shiftedperiod << 1)
            }
        }
    }

    /**
     * 获取APU状态用于存档（带压缩）
     */
    public getAPUState(): any {
        return {
            
            // 帧计数器状态
            framectr: this.framectr,
            framectrdiv: this.framectrdiv,
            ctrmode: this.ctrmode,
            apuintflag: this.apuintflag,
            statusframeint: this.statusframeint,
            statusdmcint: this.statusdmcint,
            
            // 长度计数器（直接压缩类型化数组）
            lengthctr: compressArrayIfPossible(this.lengthctr),
            lenctrHalt: compressArrayIfPossible(this.lenctrHalt),
            lenCtrEnable: compressArrayIfPossible(this.lenCtrEnable),
            
            // 线性计数器 (三角波)
            linearctr: this.linearctr,
            linctrreload: this.linctrreload,
            linctrflag: this.linctrflag,
            
            // 包络单元（直接压缩类型化数组）
            envelopeValue: compressArrayIfPossible(this.envelopeValue),
            envelopeCounter: compressArrayIfPossible(this.envelopeCounter),
            envelopePos: compressArrayIfPossible(this.envelopePos),
            envConstVolume: compressArrayIfPossible(this.envConstVolume),
            envelopeStartFlag: compressArrayIfPossible(this.envelopeStartFlag),
            
            // 扫频单元（直接压缩类型化数组）
            sweepenable: compressArrayIfPossible(this.sweepenable),
            sweepnegate: compressArrayIfPossible(this.sweepnegate),
            sweepsilence: compressArrayIfPossible(this.sweepsilence),
            sweepreload: compressArrayIfPossible(this.sweepreload),
            sweepperiod: compressArrayIfPossible(this.sweepperiod),
            sweepshift: compressArrayIfPossible(this.sweepshift),
            sweeppos: compressArrayIfPossible(this.sweeppos),
            
            // 音量（直接压缩类型化数组）
            volume: compressArrayIfPossible(this.volume),
            
            // DMC状态
            dmcrate: this.dmcrate,
            dmcpos: this.dmcpos,
            dmcshiftregister: this.dmcshiftregister,
            dmcbuffer: this.dmcbuffer,
            dmcvalue: this.dmcvalue,
            dmcsamplelength: this.dmcsamplelength,
            dmcsamplesleft: this.dmcsamplesleft,
            dmcstartaddr: this.dmcstartaddr,
            dmcaddr: this.dmcaddr,
            dmcbitsleft: this.dmcbitsleft,
            dmcsilence: this.dmcsilence,
            dmcirq: this.dmcirq,
            dmcloop: this.dmcloop,
            dmcBufferEmpty: this.dmcBufferEmpty,
            
            // 定时器状态（仅保存基本属性）
            timers: this.timers.map(timer => ({
                period: timer.getperiod(),
                val: timer.getval(),
            })),
            
            // APU周期状态
            apucycle: this.apucycle,
            remainder: this.remainder,
            accum: this.accum,
        }
    }

    /**
     * 设置APU状态用于读档（带解压缩，简化版）
     */
    public setAPUState(state: any): void {
        if (!state) return

        // 恢复帧计数器状态
        this.framectr = state.framectr ?? this.framectr
        this.framectrdiv = state.framectrdiv ?? this.framectrdiv
        this.ctrmode = state.ctrmode ?? this.ctrmode
        this.apuintflag = state.apuintflag ?? this.apuintflag
        this.statusframeint = state.statusframeint ?? this.statusframeint
        this.statusdmcint = state.statusdmcint ?? this.statusdmcint
        
        // 恢复长度计数器（支持解压缩）
        if (state.lengthctr) {
            const lengthctrData = decompressArray(state.lengthctr)
            if (Array.isArray(lengthctrData)) {
                this.lengthctr.set(lengthctrData.slice(0, this.lengthctr.length))
            }
        }
        if (state.lenctrHalt) {
            const lenctrHaltData = decompressArray(state.lenctrHalt)
            if (Array.isArray(lenctrHaltData)) {
                this.lenctrHalt.set(lenctrHaltData.slice(0, this.lenctrHalt.length))
            }
        }
        if (state.lenCtrEnable) {
            const lenCtrEnableData = decompressArray(state.lenCtrEnable)
            if (Array.isArray(lenCtrEnableData)) {
                this.lenCtrEnable.set(lenCtrEnableData.slice(0, this.lenCtrEnable.length))
            }
        }
        
        // 恢复线性计数器
        this.linearctr = state.linearctr ?? this.linearctr
        this.linctrreload = state.linctrreload ?? this.linctrreload
        this.linctrflag = state.linctrflag ?? this.linctrflag
        
        // 恢复包络单元（支持解压缩）
        this.restoreTypedArray(state.envelopeValue, this.envelopeValue)
        this.restoreTypedArray(state.envelopeCounter, this.envelopeCounter)
        this.restoreTypedArray(state.envelopePos, this.envelopePos)
        this.restoreTypedArray(state.envConstVolume, this.envConstVolume)
        this.restoreTypedArray(state.envelopeStartFlag, this.envelopeStartFlag)
        
        // 恢复扫频单元（支持解压缩）
        this.restoreTypedArray(state.sweepenable, this.sweepenable)
        this.restoreTypedArray(state.sweepnegate, this.sweepnegate)
        this.restoreTypedArray(state.sweepsilence, this.sweepsilence)
        this.restoreTypedArray(state.sweepreload, this.sweepreload)
        this.restoreTypedArray(state.sweepperiod, this.sweepperiod)
        this.restoreTypedArray(state.sweepshift, this.sweepshift)
        this.restoreTypedArray(state.sweeppos, this.sweeppos)
        
        // 恢复音量（支持解压缩）
        this.restoreTypedArray(state.volume, this.volume)
        
        // 恢复DMC状态
        this.dmcrate = state.dmcrate ?? this.dmcrate
        this.dmcpos = state.dmcpos ?? this.dmcpos
        this.dmcshiftregister = state.dmcshiftregister ?? this.dmcshiftregister
        this.dmcbuffer = state.dmcbuffer ?? this.dmcbuffer
        this.dmcvalue = state.dmcvalue ?? this.dmcvalue
        this.dmcsamplelength = state.dmcsamplelength ?? this.dmcsamplelength
        this.dmcsamplesleft = state.dmcsamplesleft ?? this.dmcsamplesleft
        this.dmcstartaddr = state.dmcstartaddr ?? this.dmcstartaddr
        this.dmcaddr = state.dmcaddr ?? this.dmcaddr
        this.dmcbitsleft = state.dmcbitsleft ?? this.dmcbitsleft
        this.dmcsilence = state.dmcsilence ?? this.dmcsilence
        this.dmcirq = state.dmcirq ?? this.dmcirq
        this.dmcloop = state.dmcloop ?? this.dmcloop
        this.dmcBufferEmpty = state.dmcBufferEmpty ?? this.dmcBufferEmpty
        
        // 恢复定时器状态
        if (state.timers && Array.isArray(state.timers)) {
            for (let i = 0; i < Math.min(state.timers.length, this.timers.length); i++) {
                const timerState = state.timers[i]
                if (timerState?.period !== undefined) {
                    this.timers[i].setperiod(timerState.period)
                    this.timers[i].reset()
                }
            }
        }
        
        // 恢复APU周期状态
        this.apucycle = state.apucycle ?? this.apucycle
        this.remainder = state.remainder ?? this.remainder
        this.accum = state.accum ?? this.accum
    }

    /**
     * 辅助方法：恢复类型化数组数据（带解压缩支持）
     */
    private restoreTypedArray(sourceData: any, targetArray: Uint8Array): void {
        if (sourceData) {
            const decompressedData = decompressArray(sourceData)
            if (Array.isArray(decompressedData)) {
                targetArray.set(decompressedData.slice(0, targetArray.length))
            }
        }
    }
}
