import type { ExpansionSoundChip } from '../interfaces'
import { Utils } from '../types'

export enum EnvState {
    CUTOFF,
    ATTACK,
    DECAY,
    RELEASE,
}

function tri(x: number): number {
    x %= 2 * Math.PI
    if (x < Math.PI / 2) {
        return x / Math.PI
    }
    else if (x < 3 * Math.PI / 2) {
        return 1 - x / Math.PI
    }
    else {
        return x / Math.PI - 2
    }
}

function genVibTbl(): number[] {
    const l = 1789773 / 6
    const f = 6.4
    const depth = 10
    const tbl = new Array(Math.ceil(l / f))
    for (let x = 0; x < tbl.length; ++x) {
        tbl[x] = depth * tri(2 * Math.PI * f * x / l)
    }

    return tbl
}

function genAMTbl(): number[] {
    const l = 1789773 / 6
    const f = 3.7
    const depth = 128
    const tbl = new Array(Math.ceil(l / f))
    for (let x = 0; x < tbl.length; ++x) {
        tbl[x] = Math.floor(depth * tri(2 * Math.PI * f * x / l) + depth)
    }

    return tbl
}

function genLogSinTbl(): number[] {
    const tbl = new Array(256)
    for (let i = 0; i < tbl.length; ++i) {
        tbl[i] = Math.round(-Math.log(Math.sin((i + 0.5) * Math.PI / 256 / 2)) / Math.log(2) * 256)
    }

    return tbl
}

function genExpTbl(): number[] {
    const tbl = new Array(256)
    for (let i = 0; i < tbl.length; ++i) {
        tbl[i] = Math.round((Math.pow(2, i / 256) - 1) * 1024)
    }

    return tbl
}

const LOGSIN = genLogSinTbl()
const EXP = genExpTbl()
const AM = genAMTbl()
const VIBRATO = genVibTbl()
const MULTIPLIER = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 12, 12, 15, 15]
const KEYSCALE = [0, 1536, 2048, 2368, 2560, 2752, 2880, 3008, 3072, 3200, 3264, 3328, 3392, 3456, 3520, 3584]

const ATTACKVAL = [0, 0, 0, 0,
    98, 120, 146, 171,
    195, 216, 293, 341,
    390, 471, 602, 683,
    780, 964, 1168, 1366,
    1560, 1927, 2315, 2731,
    3075, 3855, 4682, 5461,
    6242, 8035, 9364, 10921,
    12480, 15423, 18727, 21856,
    24960, 30847, 37413, 43713,
    51130, 61580, 74991, 87425,
    99841, 123161, 149319, 173949,
    200870, 241044, 281218, 312464,
    337461, 401739, 496266, 562435,
    602609, 766957, 937392, 1205218,
    8388607, 8388607, 8388607, 8388607,
    8388607, 8388607, 8388607, 8388607,
    8388607, 8388607, 8388607, 8388607,
    8388607, 8388607, 8388607, 8388607]
const DECAYVAL = [0, 0, 0, 0,
    8, 10, 12, 14,
    16, 20, 24, 28,
    32, 40, 48, 56,
    65, 77, 96, 112,
    129, 161, 193, 224,
    258, 321, 386, 449,
    516, 643, 771, 898,
    1032, 1285, 1542, 1796,
    2064, 2570, 3084, 3591,
    4211, 5268, 6167, 7183,
    8255, 10282, 12407, 14360,
    16510, 20552, 24668, 28745,
    33020, 41154, 49336, 57391,
    66169, 82308, 98673, 114783,
    132859, 132859, 132859, 132859,
    132859, 132859, 132859, 132859,
    132859, 132859, 132859, 132859,
    132859, 132859, 132859, 132859]

const ZEROVOL = 8388608
const MAXVOL = 0

export class VRC7SoundChip implements ExpansionSoundChip {
    private modenv_state: EnvState[] = Array(6).fill(EnvState.CUTOFF)
    private carenv_state: EnvState[] = Array(6).fill(EnvState.CUTOFF)
    private vol: number[] = Array(6).fill(511)
    private freq: number[] = Array(6).fill(0)
    private octave: number[] = Array(6).fill(0)
    private instrument: number[] = Array(6).fill(0)
    private mod: number[] = Array(6).fill(0)
    private oldmodout: number[] = Array(6).fill(0)
    private out: number[] = Array(6).fill(0)
    private key: boolean[] = Array(6).fill(false)
    private chSust: boolean[] = Array(6).fill(false)
    private fmctr = 0
    private amctr = 0
    private phase: number[] = Array(6).fill(0)
    private usertone: number[] = Array(8).fill(0)
    private modenv_vol: number[] = Array(6).fill(511)
    private carenv_vol: number[] = Array(6).fill(511)
    private instdata: number[][] = [
        this.usertone,
        [0x03, 0x21, 0x05, 0x06, 0xE8, 0x81, 0x42, 0x27], // Bell
        [0x13, 0x41, 0x14, 0x0D, 0xD8, 0xF6, 0x23, 0x12], // Guitar
        [0x11, 0x11, 0x08, 0x08, 0xFA, 0xB2, 0x20, 0x12], // Wurlitzer
        [0x31, 0x61, 0x0c, 0x07, 0xA8, 0x64, 0x61, 0x27], // Flute
        [0x32, 0x21, 0x1E, 0x06, 0xE1, 0x76, 0x01, 0x28], // Clarinet
        [0x02, 0x01, 0x06, 0x00, 0xA3, 0xE2, 0xF4, 0xF4], // Synth
        [0x21, 0x61, 0x1D, 0x07, 0x82, 0x81, 0x11, 0x07], // Trumpet
        [0x23, 0x21, 0x22, 0x17, 0xA2, 0x72, 0x01, 0x17], // Organ
        [0x35, 0x11, 0x25, 0x00, 0x40, 0x73, 0x72, 0x01], // Bells
        [0xB5, 0x01, 0x0F, 0x0F, 0xA8, 0xA5, 0x51, 0x02], // Vibes
        [0x17, 0xC1, 0x24, 0x07, 0xF8, 0xF8, 0x22, 0x12], // Vibraphone
        [0x71, 0x23, 0x11, 0x06, 0x65, 0x74, 0x18, 0x16], // Tutti
        [0x01, 0x02, 0xD3, 0x05, 0xC9, 0x95, 0x03, 0x02], // Fretless
        [0x61, 0x63, 0x0C, 0x00, 0x94, 0xC0, 0x33, 0xF6], // Synth Bass
        [0x21, 0x72, 0x0D, 0x00, 0xC1, 0xD5, 0x56, 0x06], // Sweep
    ]
    private ch = 0
    private lpaccum = 0
    private lpaccum2 = 0
    private s = 1

    public write(register: number, data: number): void {
        switch (register) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                this.usertone[register & 7] = data
                break
            case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15:
                const n = register - 0x10
                this.freq[n] = this.freq[n] & 0xf00 | data
                break
            case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: case 0x25:
                const m = register - 0x20
                this.octave[m] = data >> 1 & 7
                this.freq[m] = this.freq[m] & 0xff | (data & 1) << 8
                if ((data & Utils.BIT4) !== 0 && !this.key[m]) {
                    this.carenv_state[m] = EnvState.CUTOFF
                    this.modenv_state[m] = EnvState.CUTOFF
                }
                this.key[m] = (data & Utils.BIT4) !== 0
                this.chSust[m] = (data & Utils.BIT5) !== 0
                break
            case 0x30: case 0x31: case 0x32: case 0x33: case 0x34: case 0x35:
                const j = register - 0x30
                this.vol[j] = data & 0xf
                this.instrument[j] = data >> 4 & 0xf
                break
            default:

                // Unknown register
        }
    }

    public clock(cycle: number): void {
        for (let i = 0; i < cycle; ++i) {
            this.ch = (this.ch + 1) % 36
            if (this.ch < 6) {
                this.operate()
            }
        }
    }

    private operate(): void {
        this.fmctr = (this.fmctr + 1) % VIBRATO.length
        this.amctr = (this.amctr + 1) % AM.length
        this.phase[this.ch] += 1 / 512 * (this.freq[this.ch] << this.octave[this.ch])
        this.phase[this.ch] %= 1024
        const inst = this.instdata[this.instrument[this.ch]]
        const modEnvelope = this.setEnvelope(inst, this.modenv_state, this.modenv_vol, this.ch, false) << 2
        const carEnvelope = this.setEnvelope(inst, this.carenv_state, this.carenv_vol, this.ch, true) << 2
        let keyscale = KEYSCALE[this.freq[this.ch] >> 5] - 512 * (7 - this.octave[this.ch])
        if (keyscale < 0) keyscale = 0
        let modks = inst[2] >> 6
        modks = modks === 0 ? 0 : keyscale >> 3 - modks
        let carks = inst[3] >> 6
        carks = carks === 0 ? 0 : keyscale >> 3 - carks
        const fb = ~inst[3] & 7
        const modVibrato = (inst[0] & Utils.BIT6) === 0 ? 0 : VIBRATO[this.fmctr] * (1 << this.octave[this.ch])
        const modFreqMultiplier = MULTIPLIER[inst[0] & 0xf]
        const modFeedback = fb === 7 ? 0 : this.mod[this.ch] + this.oldmodout[this.ch] >> 2 + fb
        const mod_f = modFeedback + (modVibrato + modFreqMultiplier * this.phase[this.ch])
        const modVol = (inst[2] & 0x3f) * 32
        const modAM = (inst[0] & Utils.BIT7) === 0 ? 0 : AM[this.amctr]
        const modRectify = (inst[3] & Utils.BIT3) !== 0
        this.mod[this.ch] = this.operator(mod_f, modVol + modEnvelope + modks + modAM, modRectify) << 2
        this.oldmodout[this.ch] = this.mod[this.ch]
        const carVibrato = (inst[1] & Utils.BIT6) === 0 ? 0 : VIBRATO[this.fmctr] * (this.freq[this.ch] << this.octave[this.ch]) / 512
        const carFreqMultiplier = MULTIPLIER[inst[1] & 0xf]
        const carFeedback = this.mod[this.ch] + this.oldmodout[this.ch] >> 1
        const car_f = carFeedback + (carVibrato + carFreqMultiplier * this.phase[this.ch])
        const carVol = this.vol[this.ch] * 128
        const carAM = (inst[1] & Utils.BIT7) === 0 ? 0 : AM[this.amctr]
        const carRectify = (inst[3] & Utils.BIT4) !== 0
        this.out[this.ch] = this.operator(car_f, carVol + carEnvelope + carks + carAM, carRectify) << 2
        this.outputSample(this.ch)
    }

    private operator(phase: number, gain: number, rectify: boolean): number {
        return this.exp(this.logsin(phase, rectify) + gain)
    }

    private exp(val: number): number {
        if (val > Utils.BIT13 - 1) val = Utils.BIT13 - 1
        const mantissa = EXP[-val & 0xff]
        const exponent = -val >> 8

        return (mantissa + 1024 >> -exponent) * this.s
    }

    private logsin(x: number, rectify: boolean): number {
        switch (x >> 8 & 3) {
            case 0:
                this.s = 1

                return LOGSIN[x & 0xff]
            case 1:
                this.s = 1

                return LOGSIN[255 - (x & 0xff)]
            case 2:
                this.s = rectify ? 0 : -1

                return LOGSIN[x & 0xff]
            case 3:
            default:
                this.s = rectify ? 0 : -1

                return LOGSIN[255 - (x & 0xff)]
        }
    }

    private outputSample(ch: number): void {
        let sample = this.out[ch] * 24
        sample += this.lpaccum
        this.lpaccum -= sample >> 2
        let j = this.lpaccum
        j += this.lpaccum2
        this.lpaccum2 -= j >> 2
    }

    public getval(): number {
        return this.lpaccum2
    }

    private setEnvelope(
        instrument: number[],
        state: EnvState[],
        vol: number[],
        ch: number,
        isCarrier: boolean,
    ): number {
        const keyscaleRate = (instrument[isCarrier ? 1 : 0] & Utils.BIT4) !== 0
        const ksrShift = keyscaleRate ? (this.octave[ch] << 1) + (this.freq[ch] >> 8) : this.octave[ch] >> 1
        switch (state[ch]) {

            case EnvState.ATTACK:
                if (vol[ch] > MAXVOL + 8) {
                    vol[ch] -= ATTACKVAL[(instrument[isCarrier ? 5 : 4] >> 4) * 4 + ksrShift]
                }
                else {
                    state[ch] = EnvState.DECAY
                }
                if (!this.key[ch]) {
                    state[ch] = EnvState.RELEASE
                }
                break
            case EnvState.DECAY:
                if (vol[ch] < (instrument[isCarrier ? 7 : 6] >> 4) * 524288) {
                    vol[ch] += DECAYVAL[(instrument[isCarrier ? 5 : 4] & 0xf) * 4 + ksrShift]
                }
                else {
                    state[ch] = EnvState.RELEASE
                }
                if (!this.key[ch]) {
                    state[ch] = EnvState.RELEASE
                }
                break
            case EnvState.RELEASE:
                const d5 = (instrument[isCarrier ? 1 : 0] & Utils.BIT5) !== 0
                const SUS = this.chSust[ch]
                if (this.key[ch]) {
                    if (d5) {

                        // sustained tone
                    }
                    else {
                        vol[ch] += DECAYVAL[(instrument[isCarrier ? 7 : 6] & 0xf) * 4 + ksrShift]
                    }
                }
                else if (d5) {
                    if (SUS) {
                        vol[ch] += DECAYVAL[5 * 4 + ksrShift]
                    }
                    else {
                        vol[ch] += DECAYVAL[(instrument[isCarrier ? 7 : 6] & 0xf) * 4 + ksrShift]
                    }
                }
                else if (SUS) {
                    vol[ch] += DECAYVAL[5 * 4 + ksrShift]
                }
                else {
                    vol[ch] += DECAYVAL[7 * 4 + ksrShift]
                }
                break
            case EnvState.CUTOFF:
            default:
                if (vol[ch] < ZEROVOL) {
                    vol[ch] += 16384
                }
                else {
                    vol[ch] = ZEROVOL
                    if (this.key[ch]) {
                        state[ch] = EnvState.ATTACK
                        this.phase[ch] = 0
                    }
                }
                break
        }
        if (vol[ch] < MAXVOL) vol[ch] = MAXVOL
        if (vol[ch] > ZEROVOL) vol[ch] = ZEROVOL
        if (state[ch] === EnvState.ATTACK) {
            const output = 8388608 - Math.floor(8388608 * Math.log(8388608 - vol[ch]) / Math.log(8388608))

            return output >> 14
        }

        return vol[ch] >> 14
    }
}
