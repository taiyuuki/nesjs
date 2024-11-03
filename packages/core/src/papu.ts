import type { NES } from './nes'

class ChannelDM {
    papu: any

    MODE_NORMAL: number = 0
    MODE_LOOP: number = 1
    MODE_IRQ: number = 2

    isEnabled: boolean | null = null
    hasSample: boolean | null = null
    irqGenerated: boolean = false

    playMode: number | null = null
    dmaFrequency: number | null = null
    dmaCounter: number | null = null
    deltaCounter: number | null = null
    playStartAddress: number | null = null
    playAddress: number | null = null
    playLength: number | null = null
    playLengthCounter: number | null = null
    shiftCounter: number | null = null
    reg4012: number | null = null
    reg4013: number | null = null
    sample: number | null = null
    dacLsb: number | null = null
    data: number | null = null

    constructor(papu: any) {
        this.papu = papu
        this.reset()
    }

    clockDmc(): void {
        if (this.hasSample) {
            if ((this.data! & 1) === 0) {
                if (this.deltaCounter! > 0) {
                    this.deltaCounter!--
                }
            }
            else if (this.deltaCounter! < 63) {
                this.deltaCounter!++
            }

            this.sample = this.isEnabled ? (this.deltaCounter! << 1) + this.dacLsb! : 0
            this.data! >>= 1
        }

        this.dmaCounter!--
        if (this.dmaCounter! <= 0) {
            this.hasSample = false
            this.endOfSample()
            this.dmaCounter = 8
        }

        if (this.irqGenerated) {
            this.papu.nes.cpu.requestIrq(this.papu.nes.cpu.IRQ_NORMAL)
        }
    }

    endOfSample(): void {
        if (this.playLengthCounter === 0 && this.playMode === this.MODE_LOOP) {
            this.playAddress = this.playStartAddress!
            this.playLengthCounter = this.playLength!
        }

        if (this.playLengthCounter! > 0) {
            this.nextSample()

            if (this.playLengthCounter === 0) {
                if (this.playMode === this.MODE_IRQ) {
                    this.irqGenerated = true
                }
            }
        }
    }

    nextSample(): void {
        this.data = this.papu.nes.mmap.load(this.playAddress!)
        this.papu.nes.cpu.haltCycles(4)

        this.playLengthCounter!--
        this.playAddress!++
        if (this.playAddress! > 0xffff) {
            this.playAddress = 0x8000
        }

        this.hasSample = true
    }

    writeReg(address: number, value: number): void {
        if (address === 0x4010) {
            if (value >> 6 === 0) {
                this.playMode = this.MODE_NORMAL
            }
            else if ((value >> 6 & 1) === 1) {
                this.playMode = this.MODE_LOOP
            }
            else if (value >> 6 === 2) {
                this.playMode = this.MODE_IRQ
            }

            if ((value & 0x80) === 0) {
                this.irqGenerated = false
            }

            this.dmaFrequency = this.papu.getDmcFrequency(value & 0xf)
        }
        else if (address === 0x4011) {
            this.deltaCounter = value >> 1 & 63
            this.dacLsb = value & 1
            this.sample = (this.deltaCounter! << 1) + this.dacLsb!
        }
        else if (address === 0x4012) {
            this.playStartAddress = value << 6 | 0x0c000
            this.playAddress = this.playStartAddress
            this.reg4012 = value
        }
        else if (address === 0x4013) {
            this.playLength = (value << 4) + 1
            this.playLengthCounter = this.playLength
            this.reg4013 = value
        }
        else if (address === 0x4015) {
            if ((value >> 4 & 1) === 0) {
                this.playLengthCounter = 0
            }
            else {
                this.playAddress = this.playStartAddress!
                this.playLengthCounter = this.playLength!
            }
            this.irqGenerated = false
        }
    }

    setEnabled(value: boolean): void {
        if (!this.isEnabled && value) {
            this.playLengthCounter = this.playLength
        }
        this.isEnabled = value
    }

    getLengthStatus(): number {
        return this.playLengthCounter === 0 || !this.isEnabled ? 0 : 1
    }

    getIrqStatus(): number {
        return this.irqGenerated ? 1 : 0
    }

    reset(): void {
        this.isEnabled = false
        this.irqGenerated = false
        this.playMode = this.MODE_NORMAL
        this.dmaFrequency = 0
        this.dmaCounter = 0
        this.deltaCounter = 0
        this.playStartAddress = 0
        this.playAddress = 0
        this.playLength = 0
        this.playLengthCounter = 0
        this.sample = 0
        this.dacLsb = 0
        this.shiftCounter = 0
        this.reg4012 = 0
        this.reg4013 = 0
        this.data = 0
    }
}

class ChannelNoise {
    papu: any

    isEnabled: boolean | null = null
    envDecayDisable: boolean | null = null
    envDecayLoopEnable: boolean | null = null
    lengthCounterEnable: boolean | null = null
    envReset: boolean | null = null
    shiftNow: boolean | null = null

    lengthCounter: number | null = null
    progTimerCount: number | null = null
    progTimerMax: number | null = null
    envDecayRate: number | null = null
    envDecayCounter: number | null = null
    envVolume: number | null = null
    masterVolume: number | null = null
    shiftReg: number = 1 << 14
    randomBit: number | null = null
    randomMode: number | null = null
    sampleValue: number | null = null
    accValue: number = 0
    accCount: number = 1
    tmp: number | null = null

    constructor(papu: any) {
        this.papu = papu
        this.reset()
    }

    reset(): void {
        this.progTimerCount = 0
        this.progTimerMax = 0
        this.isEnabled = false
        this.lengthCounter = 0
        this.lengthCounterEnable = false
        this.envDecayDisable = false
        this.envDecayLoopEnable = false
        this.shiftNow = false
        this.envDecayRate = 0
        this.envDecayCounter = 0
        this.envVolume = 0
        this.masterVolume = 0
        this.shiftReg = 1
        this.randomBit = 0
        this.randomMode = 0
        this.sampleValue = 0
        this.tmp = 0
    }

    clockLengthCounter(): void {
        if (this.lengthCounterEnable && this.lengthCounter! > 0) {
            this.lengthCounter!--
            if (this.lengthCounter === 0) {
                this.updateSampleValue()
            }
        }
    }

    clockEnvDecay(): void {
        if (this.envReset) {

            // Reset envelope:
            this.envReset = false
            this.envDecayCounter = this.envDecayRate! + 1
            this.envVolume = 0xf
        }
        else if (--this.envDecayCounter! <= 0) {

            // Normal handling:
            this.envDecayCounter = this.envDecayRate! + 1
            if (this.envVolume! > 0) {
                this.envVolume!--
            }
            else {
                this.envVolume = this.envDecayLoopEnable ? 0xf : 0
            }
        }
        
        this.masterVolume = this.envDecayDisable ? this.envDecayRate! : this.envVolume!
        this.updateSampleValue()
    }

    updateSampleValue(): void {
        if (this.lengthCounter && this.isEnabled && this.lengthCounter > 0) {
            this.sampleValue = this.randomBit! * this.masterVolume!
        }
    }

    writeReg(address: number, value: number): void {
        if (address === 0x400c) {

            // Volume/Envelope decay:
            this.envDecayDisable = (value & 0x10) !== 0
            this.envDecayRate = value & 0xf
            this.envDecayLoopEnable = (value & 0x20) !== 0
            this.lengthCounterEnable = (value & 0x20) === 0

            if (this.envDecayDisable) {
                this.masterVolume = this.envDecayRate!
            }
            else {
                this.masterVolume = this.envVolume!
            }
        }
        else if (address === 0x400e) {

            // Programmable timer:
            this.progTimerMax = this.papu.getNoiseWaveLength(value & 0xf)
            this.randomMode = value >> 7
        }
        else if (address === 0x400f) {

            // Length counter
            this.lengthCounter = this.papu.getLengthMax(value & 248)
            this.envReset = true
        }

        // 更新样本值
        this.updateSampleValue()
    }

    setEnabled(value: boolean): void {
        this.isEnabled = value
        if (!value) {
            this.lengthCounter = 0
        }
        this.updateSampleValue()
    }

    getLengthStatus(): number {
        return this.lengthCounter === 0 || !this.isEnabled ? 0 : 1
    }
}

class ChannelSquare {
    papu: any
    dutyLookup: number[]
    impLookup: number[]
    sqr1: boolean
    isEnabled: boolean
    lengthCounterEnable: boolean
    sweepActive: boolean
    envDecayDisable: boolean
    envDecayLoopEnable: boolean
    envReset: boolean
    sweepCarry: boolean
    updateSweepPeriod: boolean

    progTimerCount: number
    progTimerMax: number
    lengthCounter: number
    squareCounter: number
    sweepCounter: number
    sweepCounterMax: number
    sweepMode: number
    sweepShiftAmount: number
    envDecayRate: number
    envDecayCounter: number
    envVolume: number
    masterVolume: number
    dutyMode: number
    sampleValue: number
    vol: number

    constructor(papu: any, square1: boolean) {
        this.papu = papu
        this.dutyLookup = [
            0,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            1,
            1,
            1,
            0,
            0,
            0,
            1,
            0,
            0,
            1,
            1,
            1,
            1,
            1,
        ]
        this.impLookup = [
            1,
            -1,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            0,
            -1,
            0,
            0,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            -1,
            0,
            0,
            0,
            -1,
            0,
            1,
            0,
            0,
            0,
            0,
            0,
        ]

        this.sqr1 = square1
        this.isEnabled = false
        this.lengthCounterEnable = false
        this.sweepActive = false
        this.envDecayDisable = false
        this.envDecayLoopEnable = false
        this.envReset = false
        this.sweepCarry = false
        this.updateSweepPeriod = false

        this.progTimerCount = 0
        this.progTimerMax = 0
        this.lengthCounter = 0
        this.squareCounter = 0
        this.sweepCounter = 0
        this.sweepCounterMax = 0
        this.sweepMode = 0
        this.sweepShiftAmount = 0
        this.envDecayRate = 0
        this.envDecayCounter = 0
        this.envVolume = 0
        this.masterVolume = 0
        this.dutyMode = 0
        this.sampleValue = 0
        this.vol = 0

        this.reset()
    }

    reset(): void {
        this.progTimerCount = this.progTimerMax = this.lengthCounter = this.squareCounter
        = this.sweepCounter = this.sweepCounterMax = this.sweepMode = this.sweepShiftAmount
        = this.envDecayRate = this.envDecayCounter = this.envVolume = this.masterVolume
        = this.dutyMode = this.vol = 0

        this.isEnabled = false
        this.lengthCounterEnable = false
        this.sweepActive = false
        this.sweepCarry = false
        this.envDecayDisable = false
        this.envDecayLoopEnable = false
    }

    clockLengthCounter(): void {
        if (this.lengthCounterEnable && this.lengthCounter > 0) {
            this.lengthCounter--
            if (this.lengthCounter === 0) {
                this.updateSampleValue()
            }
        }
    }

    clockEnvDecay(): void {
        if (this.envReset) {

            // Reset envelope:
            this.envReset = false
            this.envDecayCounter = this.envDecayRate + 1
            this.envVolume = 0xf
        }
        else if (--this.envDecayCounter <= 0) {

            // Normal handling:
            this.envDecayCounter = this.envDecayRate + 1
            this.envVolume = Math.max(0, this.envVolume - 1)
            if (this.envVolume === 0 && !this.envDecayLoopEnable) {
                this.envVolume = 0
            }
        }

        this.masterVolume = this.envDecayDisable ? this.envDecayRate : this.envVolume
        this.updateSampleValue()
    }

    clockSweep(): void {
        if (--this.sweepCounter <= 0) {
            this.sweepCounter = this.sweepCounterMax + 1
            if (this.sweepActive && this.sweepShiftAmount > 0 && this.progTimerMax > 7) {

                // Calculate result from shifter:
                this.sweepCarry = false
                if (this.sweepMode === 0) {
                    this.progTimerMax += this.progTimerMax >> this.sweepShiftAmount
                    if (this.progTimerMax > 4095) {
                        this.progTimerMax = 4095
                        this.sweepCarry = true
                    }
                }
                else {
                    this.progTimerMax -= (this.progTimerMax >> this.sweepShiftAmount) - (this.sqr1 ? 1 : 0)
                }
            }
        }

        if (this.updateSweepPeriod) {
            this.updateSweepPeriod = false
            this.sweepCounter = this.sweepCounterMax + 1
        }
    }

    updateSampleValue(): void {
        if (this.isEnabled && this.lengthCounter > 0 && this.progTimerMax > 7) {
            if (this.sweepMode === 0 && this.progTimerMax + (this.progTimerMax >> this.sweepShiftAmount) > 4095) {
                this.sampleValue = 0
            }
            else {
                this.sampleValue = this.masterVolume * this.dutyLookup[(this.dutyMode << 3) + this.squareCounter]
            }
        }
        else {
            this.sampleValue = 0
        }
    }

    writeReg(address: number, value: number): void {
        const addrAdd = this.sqr1 ? 0 : 4
        if (address === 0x4000 + addrAdd) {

            // Volume/Envelope decay:
            this.envDecayDisable = (value & 0x10) !== 0
            this.envDecayRate = value & 0xf
            this.envDecayLoopEnable = (value & 0x20) !== 0
            this.dutyMode = value >> 6 & 0x3
            this.lengthCounterEnable = (value & 0x20) === 0
            this.masterVolume = this.envDecayDisable ? this.envDecayRate : this.envVolume
            this.updateSampleValue()
        }
        else if (address === 0x4001 + addrAdd) {

            // Sweep:
            this.sweepActive = (value & 0x80) !== 0
            this.sweepCounterMax = value >> 4 & 7
            this.sweepMode = value >> 3 & 1
            this.sweepShiftAmount = value & 7
            this.updateSweepPeriod = true
        }
        else if (address === 0x4002 + addrAdd) {

            // Programmable timer:
            this.progTimerMax = this.progTimerMax & 0x700 | value
        }
        else if (address === 0x4003 + addrAdd) {

            // Programmable timer, length counter
            this.progTimerMax = this.progTimerMax & 0xff | (value & 0x7) << 8
            if (this.isEnabled) {
                this.lengthCounter = this.papu.getLengthMax(value & 0xf8)
            }
            this.envReset = true
        }
    }

    setEnabled(value: boolean): void {
        this.isEnabled = value
        if (!value) {
            this.lengthCounter = 0
        }
        this.updateSampleValue()
    }

    getLengthStatus(): number {
        return this.lengthCounter === 0 || !this.isEnabled ? 0 : 1
    }
}

class ChannelTriangle {
    papu: PAPU

    isEnabled: boolean
    sampleCondition: boolean
    lengthCounterEnable: boolean
    lcHalt: boolean
    lcControl: boolean

    progTimerCount: number
    progTimerMax: number
    triangleCounter: number
    lengthCounter: number
    linearCounter: number
    lcLoadValue: number
    sampleValue: number
    tmp: number

    constructor(papu: PAPU) {
        this.papu = papu
        this.progTimerCount = 0
        this.progTimerMax = 0
        this.triangleCounter = 0
        this.isEnabled = false
        this.sampleCondition = false
        this.lengthCounter = 0
        this.lengthCounterEnable = false
        this.linearCounter = 0
        this.lcLoadValue = 0
        this.lcHalt = true
        this.lcControl = false
        this.tmp = 0
        this.sampleValue = 0xf
    }

    reset(): void {
        this.progTimerCount = 0
        this.progTimerMax = 0
        this.triangleCounter = 0
        this.isEnabled = false
        this.sampleCondition = false
        this.lengthCounter = 0
        this.lengthCounterEnable = false
        this.linearCounter = 0
        this.lcLoadValue = 0
        this.lcHalt = true
        this.lcControl = false
        this.tmp = 0
        this.sampleValue = 0xf
    }

    clockLengthCounter(): void {
        if (this.lengthCounterEnable && this.lengthCounter > 0) {
            this.lengthCounter--
            if (this.lengthCounter === 0) {
                this.updateSampleCondition()
            }
        }
    }

    clockLinearCounter(): void {
        if (this.lcHalt) {

            // Load:
            this.linearCounter = this.lcLoadValue
            this.updateSampleCondition()
        }
        else if (this.linearCounter > 0) {

            // Decrement:
            this.linearCounter--
            this.updateSampleCondition()
        }
        if (!this.lcControl) {

            // Clear halt flag:
            this.lcHalt = false
        }
    }

    getLengthStatus(): number {
        return this.lengthCounter === 0 || !this.isEnabled ? 0 : 1
    }

    readReg(_address: number): number {
        return 0 // Placeholder for actual read logic
    }

    writeReg(address: number, value: number): void {
        if (address === 0x4008) {

            // New values for linear counter:
            this.lcControl = (value & 0x80) !== 0
            this.lcLoadValue = value & 0x7f

            // Length counter enable:
            this.lengthCounterEnable = !this.lcControl
        }
        else if (address === 0x400a) {

            // Programmable timer:
            this.progTimerMax = this.progTimerMax & 0x700 | value
        }
        else if (address === 0x400b) {

            // Programmable timer, length counter
            this.progTimerMax = this.progTimerMax & 0xff | (value & 0x07) << 8
            this.lengthCounter = this.papu.getLengthMax(value & 0xf8)
            this.lcHalt = true
        }

        this.updateSampleCondition()
    }

    clockProgrammableTimer(nCycles: number): void {
        if (this.progTimerMax > 0) {
            this.progTimerCount += nCycles
            while (this.progTimerMax > 0 && this.progTimerCount >= this.progTimerMax) {
                this.progTimerCount -= this.progTimerMax
                if (this.isEnabled && this.lengthCounter > 0 && this.linearCounter > 0) {
                    this.clockTriangleGenerator()
                }
            }
        }
    }

    clockTriangleGenerator(): void {
        this.triangleCounter++
        this.triangleCounter &= 0x1f
    }

    setEnabled(value: boolean): void {
        this.isEnabled = value
        if (!value) {
            this.lengthCounter = 0
        }
        this.updateSampleCondition()
    }

    updateSampleCondition(): void {
        this.sampleCondition
            = this.isEnabled
            && this.progTimerMax > 7
            && this.linearCounter > 0
            && this.lengthCounter > 0
    }
}

const CPU_FREQ_NTSC = 1789772.5 // 1789772.72727272d
// const CPU_FREQ_PAL = 1773447.4;

class PAPU {
    nes: NES
    square1: ChannelSquare
    square2: ChannelSquare
    triangle: ChannelTriangle
    noise: ChannelNoise
    dmc: ChannelDM

    frameIrqCounter: number | null
    frameIrqCounterMax: number
    initCounter: number
    channelEnableValue: number | null

    sampleRate: number

    lengthLookup: number[] | null
    dmcFreqLookup: number[] | null
    noiseWavelengthLookup: number[] | null
    squareTable: number[] | null
    tndTable: number[] | null

    frameIrqEnabled: boolean
    frameIrqActive: boolean | null
    frameClockNow: number | null
    startedPlaying: boolean
    recordOutput: boolean
    initingHardware: boolean

    masterFrameCounter: number | null
    derivedFrameCounter: number | null
    countSequence: number | null
    sampleTimer: number | null
    frameTime: number | null
    sampleTimerMax: number | null
    sampleCount: number | null
    triValue: number

    smpSquare1: number | null
    smpSquare2: number | null
    smpTriangle: number | null
    smpDmc: number | null
    accCount: number | null

    prevSampleL: number
    prevSampleR: number
    smpAccumL: number
    smpAccumR: number

    dacRange: number
    dcValue: number

    masterVolume: number

    stereoPosLSquare1: number | null
    stereoPosLSquare2: number | null
    stereoPosLTriangle: number | null
    stereoPosLNoise: number | null
    stereoPosLDMC: number | null
    stereoPosRSquare1: number | null
    stereoPosRSquare2: number | null
    stereoPosRTriangle: number | null
    stereoPosRNoise: number | null
    stereoPosRDMC: number | null

    extraCycles: number | null

    maxSample: number | null
    minSample: number | null

    panning: number[]

    constructor(nes: NES) {
        this.nes = nes

        this.square1 = new ChannelSquare(this, true)
        this.square2 = new ChannelSquare(this, false)
        this.triangle = new ChannelTriangle(this)
        this.noise = new ChannelNoise(this)
        this.dmc = new ChannelDM(this)

        this.frameIrqCounter = null
        this.frameIrqCounterMax = 4
        this.initCounter = 2048
        this.channelEnableValue = null

        this.sampleRate = 44100

        this.lengthLookup = null
        this.dmcFreqLookup = null
        this.noiseWavelengthLookup = null
        this.squareTable = null
        this.tndTable = null

        this.frameIrqEnabled = false
        this.frameIrqActive = null
        this.frameClockNow = null
        this.startedPlaying = false
        this.recordOutput = false
        this.initingHardware = false

        this.masterFrameCounter = null
        this.derivedFrameCounter = null
        this.countSequence = null
        this.sampleTimer = null
        this.frameTime = null
        this.sampleTimerMax = null
        this.sampleCount = null
        this.triValue = 0

        this.smpSquare1 = null
        this.smpSquare2 = null
        this.smpTriangle = null
        this.smpDmc = null
        this.accCount = null

        this.prevSampleL = 0
        this.prevSampleR = 0
        this.smpAccumL = 0
        this.smpAccumR = 0

        this.dacRange = 0
        this.dcValue = 0

        this.masterVolume = 256

        this.stereoPosLSquare1 = null
        this.stereoPosLSquare2 = null
        this.stereoPosLTriangle = null
        this.stereoPosLNoise = null
        this.stereoPosLDMC = null
        this.stereoPosRSquare1 = null
        this.stereoPosRSquare2 = null
        this.stereoPosRTriangle = null
        this.stereoPosRNoise = null
        this.stereoPosRDMC = null

        this.extraCycles = null

        this.maxSample = null
        this.minSample = null

        this.panning = [80, 170, 100, 150, 128]
        this.setPanning(this.panning)

        this.initLengthLookup()
        this.initDmcFrequencyLookup()
        this.initNoiseWavelengthLookup()
        this.initDACtables()

        for (let i = 0; i < 0x14; i++) {
            if (i === 0x10) {
                this.writeReg(0x4010, 0x10)
            }
            else {
                this.writeReg(0x4000 + i, 0)
            }
        }

        this.reset()
    }

    reset(): void {
        this.sampleRate = this.nes.opts.sampleRate
        this.sampleTimerMax = Math.floor(1024.0 * CPU_FREQ_NTSC * this.nes.opts.preferredFrameRate / (this.sampleRate * 60.0))

        this.frameTime = Math.floor(14915.0 * this.nes.opts.preferredFrameRate / 60.0)

        this.sampleTimer = 0

        this.updateChannelEnable(0)
        this.masterFrameCounter = 0
        this.derivedFrameCounter = 0
        this.countSequence = 0
        this.sampleCount = 0
        this.initCounter = 2048
        this.frameIrqEnabled = false
        this.initingHardware = false

        this.resetCounter()

        this.square1.reset()
        this.square2.reset()
        this.triangle.reset()
        this.noise.reset()
        this.dmc.reset()

        this.accCount = 0
        this.smpSquare1 = 0
        this.smpSquare2 = 0
        this.smpTriangle = 0
        this.smpDmc = 0

        this.frameIrqCounterMax = 4

        this.channelEnableValue = 0xff
        this.startedPlaying = false
        this.prevSampleL = 0
        this.prevSampleR = 0
        this.smpAccumL = 0
        this.smpAccumR = 0

        this.maxSample = -500000
        this.minSample = 500000
    }

    readReg(_address: number): number {
        let tmp = 0
        tmp |= this.square1.getLengthStatus()
        tmp |= this.square2.getLengthStatus() << 1
        tmp |= this.triangle.getLengthStatus() << 2
        tmp |= this.noise.getLengthStatus() << 3
        tmp |= this.dmc.getLengthStatus() << 4
        tmp |= (this.frameIrqActive && this.frameIrqEnabled ? 1 : 0) << 6
        tmp |= this.dmc.getIrqStatus() << 7

        this.frameIrqActive = false
        this.dmc.irqGenerated = false

        return tmp & 0xffff
    }

    writeReg(address: number, value: number): void {
        if (address >= 0x4000 && address < 0x4004) {
            this.square1.writeReg(address, value)
        }
        else if (address >= 0x4004 && address < 0x4008) {
            this.square2.writeReg(address, value)
        }
        else if (address >= 0x4008 && address < 0x400c) {
            this.triangle.writeReg(address, value)
        }
        else if (address >= 0x400c && address <= 0x400f) {
            this.noise.writeReg(address, value)
        }
        else if (address === 0x4010) {
            this.dmc.writeReg(address, value)
        }
        else if (address === 0x4011) {
            this.dmc.writeReg(address, value)
        }
        else if (address === 0x4012) {
            this.dmc.writeReg(address, value)
        }
        else if (address === 0x4013) {
            this.dmc.writeReg(address, value)
        }
        else if (address === 0x4015) {
            this.updateChannelEnable(value)
            if (value !== 0 && this.initCounter > 0) {
                this.initingHardware = true
            }
            this.dmc.writeReg(address, value)
        }
        else if (address === 0x4017) {
            this.countSequence = value >> 7 & 1
            this.masterFrameCounter = 0
            this.frameIrqActive = false

            this.frameIrqEnabled = (value >> 6 & 0x1) === 0

            if (this.countSequence === 0) {
                this.frameIrqCounterMax = 4
                this.derivedFrameCounter = 4
            }
            else {
                this.frameIrqCounterMax = 5
                this.derivedFrameCounter = 0
                this.frameCounterTick()
            }
        }
    }

    resetCounter(): void {
        this.derivedFrameCounter = this.countSequence === 0 ? 4 : 0
    }

    updateChannelEnable(value: number): void {
        this.channelEnableValue = value & 0xffff
        this.square1.setEnabled((value & 1) !== 0)
        this.square2.setEnabled((value & 2) !== 0)
        this.triangle.setEnabled((value & 4) !== 0)
        this.noise.setEnabled((value & 8) !== 0)
        this.dmc.setEnabled((value & 16) !== 0)
    }

    clockFrameCounter(nCycles: number): void {
        if (this.initCounter > 0) {
            if (this.initingHardware) {
                this.initCounter -= nCycles
                if (this.initCounter <= 0) {
                    this.initingHardware = false
                }

                return
            }
        }

        nCycles += this.extraCycles || 0
        const maxCycles = this.sampleTimerMax! - (this.sampleTimer || 0)
        if (nCycles << 10 > maxCycles) {
            this.extraCycles = (nCycles << 10) - maxCycles >> 10
            nCycles -= this.extraCycles
        }
        else {
            this.extraCycles = 0
        }

        // Clock DMC:
        if (this.dmc.isEnabled) {
            this.dmc.shiftCounter! -= nCycles << 3
            while (this.dmc.shiftCounter! <= 0 && this.dmc.dmaFrequency! > 0) {
                this.dmc.shiftCounter! += this.dmc.dmaFrequency!
                this.dmc.clockDmc()
            }
        }

        // Clock Triangle channel Prog timer:
        if (this.triangle.progTimerMax > 0) {
            this.triangle.progTimerCount -= nCycles
            while (this.triangle.progTimerCount <= 0) {
                this.triangle.progTimerCount += this.triangle.progTimerMax + 1
                if (this.triangle.linearCounter > 0 && this.triangle.lengthCounter > 0) {
                    this.triangle.triangleCounter++
                    this.triangle.triangleCounter &= 0x1f

                    if (this.triangle.isEnabled) {
                        if (this.triangle.triangleCounter >= 0x10) {
                            this.triangle.sampleValue = this.triangle.triangleCounter & 0xf
                        }
                        else {
                            this.triangle.sampleValue = 0xf - (this.triangle.triangleCounter & 0xf)
                        }
                        this.triangle.sampleValue <<= 4
                    }
                }
            }
        }

        // Clock Square channel 1 Prog timer:
        this.square1.progTimerCount -= nCycles
        if (this.square1.progTimerCount <= 0) {
            this.square1.progTimerCount += this.square1.progTimerMax + 1 << 1
            this.square1.squareCounter++
            this.square1.squareCounter &= 0x7
            this.square1.updateSampleValue()
        }

        // Clock Square channel 2 Prog timer:
        this.square2.progTimerCount -= nCycles
        if (this.square2.progTimerCount <= 0) {
            this.square2.progTimerCount += this.square2.progTimerMax + 1 << 1
            this.square2.squareCounter++
            this.square2.squareCounter &= 0x7
            this.square2.updateSampleValue()
        }

        // Clock noise channel Prog timer:
        let acc_c = nCycles
        if (this.noise.progTimerCount! - acc_c > 0) {
            this.noise.progTimerCount! -= acc_c
            this.noise.accCount += acc_c
            this.noise.accValue += acc_c * this.noise.sampleValue!
        }
        else {
            while (acc_c-- > 0) {
                if (--this.noise.progTimerCount! <= 0 && this.noise.progTimerMax! > 0) {
                    this.noise.shiftReg <<= 1
                    this.noise.tmp = (this.noise.shiftReg << (this.noise.randomMode === 0 ? 1 : 6) ^ this.noise.shiftReg) & 0x8000
                    if (this.noise.tmp === 0) {
                        this.noise.randomBit = 1
                        this.noise.sampleValue = this.noise.isEnabled && this.noise.lengthCounter! > 0 ? this.noise.masterVolume : 0
                    }
                    else {
                        this.noise.shiftReg |= 0x01
                        this.noise.randomBit = 0
                        this.noise.sampleValue = 0
                    }
                    this.noise.progTimerCount! += this.noise.progTimerMax!
                }
                this.noise.accValue += this.noise.sampleValue!
                this.noise.accCount++
            }
        }

        // Frame IRQ handling:
        if (this.frameIrqEnabled && this.frameIrqActive) {
            this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)
        }

        // Clock frame counter at double CPU speed:
        this.masterFrameCounter! += nCycles << 1 // Non-null assertion for TypeScript

        if (this.masterFrameCounter! >= this.frameTime!) {

            // 240Hz tick:
            this.masterFrameCounter! -= this.frameTime!
            this.frameCounterTick()
        }

        // Accumulate sample value:
        this.accSample(nCycles)

        // Clock sample timer:
        this.sampleTimer! += nCycles << 10
        if (this.sampleTimer! >= this.sampleTimerMax!) {

            // Sample channels:
            this.sample()
            this.sampleTimer! -= this.sampleTimerMax!
        }
    }

    accSample(cycles: number): void {
        if (this.triangle.sampleCondition) {
            this.triValue = Math.floor((this.triangle.progTimerCount << 4) / (this.triangle.progTimerMax + 1))
            if (this.triValue > 16) {
                this.triValue = 16
            }
            if (this.triangle.triangleCounter >= 16) {
                this.triValue = 16 - this.triValue
            }
            this.triValue += this.triangle.sampleValue
        }

        if (cycles === 2) {
            this.smpTriangle! += this.triValue << 1
            this.smpDmc! += this.dmc.sample! << 1
            this.smpSquare1! += this.square1.sampleValue << 1
            this.smpSquare2! += this.square2.sampleValue << 1
            this.accCount! += 2
        }
        else if (cycles === 4) {
            this.smpTriangle! += this.triValue << 2
            this.smpDmc! += this.dmc.sample! << 2
            this.smpSquare1! += this.square1.sampleValue << 2
            this.smpSquare2! += this.square2.sampleValue << 2
            this.accCount! += 4
        }
        else {
            this.smpTriangle! += cycles * this.triValue
            this.smpDmc! += cycles * this.dmc.sample!
            this.smpSquare1! += cycles * this.square1.sampleValue
            this.smpSquare2! += cycles * this.square2.sampleValue
            this.accCount! += cycles
        }
    }

    frameCounterTick(): void {
        this.derivedFrameCounter!++
        if (this.derivedFrameCounter! >= this.frameIrqCounterMax) {
            this.derivedFrameCounter! = 0
        }

        if (this.derivedFrameCounter! === 1 || this.derivedFrameCounter! === 3) {

            // Clock length & sweep:
            this.triangle.clockLengthCounter()
            this.square1.clockLengthCounter()
            this.square2.clockLengthCounter()
            this.noise.clockLengthCounter()
            this.square1.clockSweep()
            this.square2.clockSweep()
        }

        if (this.derivedFrameCounter! >= 0 && this.derivedFrameCounter! < 4) {

            // Clock linear & decay:
            this.square1.clockEnvDecay()
            this.square2.clockEnvDecay()
            this.noise.clockEnvDecay()
            this.triangle.clockLinearCounter()
        }

        if (this.derivedFrameCounter! === 3 && this.countSequence === 0) {

            // Enable IRQ:
            this.frameIrqActive = true
        }
    }

    sample(): void {
        let sq_index: number, 
            tnd_index: number

        if (this.accCount! > 0) {
            this.smpSquare1! <<= 4
            this.smpSquare1 = Math.floor(this.smpSquare1! / this.accCount!)

            this.smpSquare2! <<= 4
            this.smpSquare2 = Math.floor(this.smpSquare2! / this.accCount!)

            this.smpTriangle = Math.floor(this.smpTriangle! / this.accCount!)

            this.smpDmc! <<= 4
            this.smpDmc = Math.floor(this.smpDmc! / this.accCount!)

            this.accCount = 0
        }
        else {
            this.smpSquare1 = this.square1.sampleValue << 4
            this.smpSquare2 = this.square2.sampleValue << 4
            this.smpTriangle = this.triangle.sampleValue
            this.smpDmc = this.dmc.sample! << 4
        }

        const smpNoise = Math.floor((this.noise.accValue << 4) / this.noise.accCount)
        this.noise.accValue = smpNoise >> 4
        this.noise.accCount = 1

        // Stereo sound.
        // Left channel:
        sq_index = this.smpSquare1! * this.stereoPosLSquare1! + this.smpSquare2! * this.stereoPosLSquare2! >> 8
        tnd_index = 3 * this.smpTriangle! * this.stereoPosLTriangle! + (smpNoise << 1) * this.stereoPosLNoise! + this.smpDmc! * this.stereoPosLDMC! >> 8

        if (sq_index >= this.squareTable!.length) {
            sq_index = this.squareTable!.length - 1
        }
        if (tnd_index >= this.tndTable!.length) {
            tnd_index = this.tndTable!.length - 1
        }

        let sampleValueL = this.squareTable![sq_index] + this.tndTable![tnd_index] - this.dcValue

        // Right channel:
        sq_index = this.smpSquare1! * this.stereoPosRSquare1! + this.smpSquare2! * this.stereoPosRSquare2! >> 8
        tnd_index = 3 * this.smpTriangle! * this.stereoPosRTriangle! + (smpNoise << 1) * this.stereoPosRNoise! + this.smpDmc! * this.stereoPosRDMC! >> 8

        if (sq_index >= this.squareTable!.length) {
            sq_index = this.squareTable!.length - 1
        }
        if (tnd_index >= this.tndTable!.length) {
            tnd_index = this.tndTable!.length - 1
        }

        let sampleValueR = this.squareTable![sq_index] + this.tndTable![tnd_index] - this.dcValue

        // Remove DC from left channel:
        const smpDiffL = sampleValueL - this.prevSampleL
        this.prevSampleL += smpDiffL
        this.smpAccumL += smpDiffL - (this.smpAccumL >> 10)
        sampleValueL = this.smpAccumL

        // Remove DC from right channel:
        const smpDiffR = sampleValueR - this.prevSampleR
        this.prevSampleR += smpDiffR
        this.smpAccumR += smpDiffR - (this.smpAccumR >> 10)
        sampleValueR = this.smpAccumR

        // Write:
        if (sampleValueL > (this.maxSample!)) {
            this.maxSample = sampleValueL
        }
        if (sampleValueL < (this.minSample!)) {
            this.minSample = sampleValueL
        }

        if (this.nes.opts.onAudioSample) {
            this.nes.opts.onAudioSample(sampleValueL / 32768, sampleValueR / 32768)
        }

        // Reset sampled values:
        this.smpSquare1 = 0
        this.smpSquare2 = 0
        this.smpTriangle = 0
        this.smpDmc = 0
    }

    getLengthMax(value: number): number {
        return this.lengthLookup![value >> 3]
    }

    getDmcFrequency(value: number): number {
        if (value >= 0 && value < 0x10) {
            return this.dmcFreqLookup![value]
        }

        return 0
    }

    getNoiseWaveLength(value: number): number {
        if (value >= 0 && value < 0x10) {
            return this.noiseWavelengthLookup![value]
        }

        return 0
    }

    setPanning(pos: number[]): void {
        for (let i = 0; i < 5; i++) {
            this.panning[i] = pos[i]
        }
        this.updateStereoPos()
    }

    setMasterVolume(value: number): void {
        if (value < 0) {
            value = 0
        }
        if (value > 256) {
            value = 256
        }
        this.masterVolume = value
        this.updateStereoPos()
    }

    updateStereoPos(): void {
        this.stereoPosLSquare1 = this.panning[0] * this.masterVolume >> 8
        this.stereoPosLSquare2 = this.panning[1] * this.masterVolume >> 8
        this.stereoPosLTriangle = this.panning[2] * this.masterVolume >> 8
        this.stereoPosLNoise = this.panning[3] * this.masterVolume >> 8
        this.stereoPosLDMC = this.panning[4] * this.masterVolume >> 8

        this.stereoPosRSquare1 = this.masterVolume - this.stereoPosLSquare1
        this.stereoPosRSquare2 = this.masterVolume - this.stereoPosLSquare2
        this.stereoPosRTriangle = this.masterVolume - this.stereoPosLTriangle
        this.stereoPosRNoise = this.masterVolume - this.stereoPosLNoise
        this.stereoPosRDMC = this.masterVolume - this.stereoPosLDMC
    }

    initLengthLookup(): void {
        this.lengthLookup = [
            0x0A,
            0xFE,
            0x14,
            0x02,
            0x28,
            0x04,
            0x50,
            0x06,
            0xA0,
            0x08,
            0x3C,
            0x0A,
            0x0E,
            0x0C,
            0x1A,
            0x0E,
            0x0C,
            0x10,
            0x18,
            0x12,
            0x30,
            0x14,
            0x60,
            0x16,
            0xC0,
            0x18,
            0x48,
            0x1A,
            0x10,
            0x1C,
            0x20,
            0x1E,
        ]
    }

    initDmcFrequencyLookup(): void {
        this.dmcFreqLookup = new Array(16)

        this.dmcFreqLookup[0x0] = 0xd60
        this.dmcFreqLookup[0x1] = 0xbe0
        this.dmcFreqLookup[0x2] = 0xaa0
        this.dmcFreqLookup[0x3] = 0xa00
        this.dmcFreqLookup[0x4] = 0x8f0
        this.dmcFreqLookup[0x5] = 0x7f0
        this.dmcFreqLookup[0x6] = 0x710
        this.dmcFreqLookup[0x7] = 0x6b0
        this.dmcFreqLookup[0x8] = 0x5f0
        this.dmcFreqLookup[0x9] = 0x500
        this.dmcFreqLookup[0xa] = 0x470
        this.dmcFreqLookup[0xb] = 0x400
        this.dmcFreqLookup[0xc] = 0x350
        this.dmcFreqLookup[0xd] = 0x2a0
        this.dmcFreqLookup[0xe] = 0x240
        this.dmcFreqLookup[0xf] = 0x1b0
    }

    initNoiseWavelengthLookup(): void {
        this.noiseWavelengthLookup = new Array(16)

        this.noiseWavelengthLookup[0x0] = 0x004
        this.noiseWavelengthLookup[0x1] = 0x008
        this.noiseWavelengthLookup[0x2] = 0x010
        this.noiseWavelengthLookup[0x3] = 0x020
        this.noiseWavelengthLookup[0x4] = 0x040
        this.noiseWavelengthLookup[0x5] = 0x060
        this.noiseWavelengthLookup[0x6] = 0x080
        this.noiseWavelengthLookup[0x7] = 0x0a0
        this.noiseWavelengthLookup[0x8] = 0x0ca
        this.noiseWavelengthLookup[0x9] = 0x0fe
        this.noiseWavelengthLookup[0xa] = 0x17c
        this.noiseWavelengthLookup[0xb] = 0x1fc
        this.noiseWavelengthLookup[0xc] = 0x2fa
        this.noiseWavelengthLookup[0xd] = 0x3f8
        this.noiseWavelengthLookup[0xe] = 0x7f2
        this.noiseWavelengthLookup[0xf] = 0xfe4
    }

    initDACtables(): void {
        let value: number, 
            ival: number

        this.squareTable = new Array(32 * 16)
        this.tndTable = new Array(204 * 16)

        for (let i = 0; i < 32 * 16; i++) {
            value = 95.52 / (8128.0 / (i / 16.0) + 100.0)
            value *= 0.98411
            value *= 50000.0
            ival = Math.floor(value)
            this.squareTable[i] = ival
        }

        for (let i = 0; i < 204 * 16; i++) {
            value = 163.67 / (24329.0 / (i / 16.0) + 100.0)
            value *= 0.98411
            value *= 50000.0
            ival = Math.floor(value)
            this.tndTable[i] = ival
        }

        this.dacRange = Math.max(...this.squareTable) + Math.max(...this.tndTable)
        this.dcValue = this.dacRange / 2
    }
}

export { PAPU }
