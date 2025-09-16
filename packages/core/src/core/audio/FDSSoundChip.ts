import type { ExpansionSoundChip } from '../interfaces'

export class FDSSoundChip implements ExpansionSoundChip {

    // IO使能
    private regEnable = true

    // 波表RAM（6位宽）
    private wavetable = new Array<number>(64).fill(0)
    private waveAddr = 0
    private waveOut = 0
    private waveAccum = 0
    private waveWriteEnable = false

    // 包络
    private volEnvDirection = false
    private volEnvDisable = false
    private modEnvDirection = false
    private modEnvDisable = false
    private volEnvSpeed = 0
    private modEnvSpeed = 0
    private envClockMultiplier = 0xe8
    private pitch = 0

    // 调制
    private modDisable = false
    private modCtr = 0
    private modFreq = 0
    private modAccum = 0
    private modTable = new Array<number>(64).fill(0)
    private modTableAddr = 0
    private masterVol = 0
    private volGain = 0
    private modGain = 0

    // lowpass
    private lpaccum = 0
    private modout = 0

    private BothEnvDisable = false
    private haltWaveAndReset = false

    private modEnvAccum = 0
    private volEnvAccum = 0

    public clock(cycles: number) {
        for (let i = 0; i < cycles; ++i) {
            this.runUnits()
        }
    }

    private runUnits() {
        if (this.pitch + this.modout > 0 && !this.haltWaveAndReset) {
            this.waveAccum += this.pitch + this.modout
            if ((this.waveAccum & 0xffff) !== this.waveAccum) {
                this.waveAccum &= 0xffff
                this.waveAddr = this.waveAddr + 1 & 63
            }
        }
        if (this.modFreq > 0 && !this.modDisable) {
            this.modAccum += this.modFreq
            if ((this.modAccum & 0xffff) !== this.modAccum) {
                this.modAccum &= 0xffff
                this.calculateModulator()
            }
        }
        else if (this.modDisable) {
            this.modAccum = 0
            this.modout = 0
        }
        if (!this.haltWaveAndReset && !this.BothEnvDisable && this.envClockMultiplier !== 0) {
            this.calculateEnvelopes()
        }
        if (!this.waveWriteEnable) {
            this.waveOut = this.wavetable[this.waveAddr]
        }
        const tmp = this.volGain > 32 ? 32 : this.volGain
        let out = this.waveOut * tmp
        switch (this.masterVol) {
            case 1:
                out *= 5
                break
            case 2:
                out *= 4
                break
            case 3:
                out *= 3
                break
            case 0:
            default:
                out *= 8
                break
        }
        out += this.lpaccum
        this.lpaccum -= out >> 6
    }

    private calculateModulator() {
        switch (this.modTable[this.modTableAddr]) {
            case 1:
                this.modCtr += 1
                break
            case 2:
                this.modCtr += 2
                break
            case 3:
                this.modCtr += 4
                break
            case 4:
                this.modCtr = 0
                break
            case 5:
                this.modCtr -= 4
                break
            case 6:
                this.modCtr -= 2
                break
            case 7:
                this.modCtr -= 1
                break
            case 0:
            default:
                this.modCtr += 0
                break
        }
        this.modTableAddr = this.modTableAddr + 1 & 63
        this.modCtr = this.modCtr << 25 >> 25
        let temp = this.modCtr * this.modGain
        let remainder = temp & 0xF
        temp >>= 4
        if (remainder > 0 && (temp & 0x80) === 0) {
            if (this.modCtr < 0) {
                temp -= 1
            }
            else {
                temp += 2
            }
        }
        if (temp >= 192) {
            temp -= 256
        }
        else if (temp < -64) {
            temp += 256
        }
        temp = this.pitch * temp
        remainder = temp & 0x3F
        temp >>= 6
        if (remainder >= 32) {
            temp += 1
        }
        this.modout = temp
    }

    private calculateEnvelopes() {
        if (!this.modEnvDisable) {
            ++this.modEnvAccum
            if (this.modEnvAccum > 8 * this.envClockMultiplier * (this.modEnvSpeed + 1)) {
                this.modEnvAccum = 0
                if (this.modEnvDirection) {
                    if (this.modGain < 32) {
                        ++this.modGain
                    }
                }
                else if (this.modGain > 0) {
                    --this.modGain
                }
            }
        }
        if (!this.volEnvDisable) {
            ++this.volEnvAccum
            if (this.volEnvAccum > 8 * this.envClockMultiplier * (this.volEnvSpeed + 1)) {
                this.volEnvAccum = 0
                if (this.volEnvDirection) {
                    if (this.volGain < 32) {
                        ++this.volGain
                    }
                }
                else if (this.volGain > 0) {
                    --this.volGain
                }
            }
        }
    }

    public write(register: number, data: number) {
        if (register === 0x4023) {
            this.regEnable = (data & 1) !== 0
        }
        if (this.regEnable) {
            if (register >= 0x4040 && register <= 0x407f) {
                if (this.waveWriteEnable) {
                    this.wavetable[register - 0x4040 & 63] = data & 63
                }
            }
            else if (register === 0x4080) {
                this.volEnvDisable = (data & 0x80) !== 0
                this.volEnvDirection = (data & 0x40) !== 0
                if (this.volEnvDisable) {
                    this.volGain = data & 63
                }
                this.volEnvSpeed = data & 63
                this.volEnvAccum = 0
            }
            else if (register === 0x4082) {
                this.pitch &= 0xf00
                this.pitch |= data & 0xff
            }
            else if (register === 0x4083) {
                this.pitch &= 0xff
                this.pitch |= (data & 0xf) << 8
                this.haltWaveAndReset = (data & 0x80) !== 0
                if (this.haltWaveAndReset) {
                    this.waveAccum = 0
                    this.waveAddr = 0
                }
                this.BothEnvDisable = (data & 0x40) !== 0
            }
            else if (register === 0x4084) {
                this.modEnvDisable = (data & 0x80) !== 0
                this.modEnvDirection = (data & 0x40) !== 0
                if (this.modEnvDisable) {
                    this.modGain = data & 0x3f
                }
                this.modEnvSpeed = data & 0x3f
                this.modAccum = 0
                this.modEnvAccum = 0
            }
            else if (register === 0x4085) {
                this.modCtr = (data & 0x7f) << 25 >> 25
            }
            else if (register === 0x4086) {
                this.modFreq &= 0xf00
                this.modFreq |= data & 0xff
            }
            else if (register === 0x4087) {
                this.modFreq &= 0xff
                this.modFreq |= (data & 0xf) << 8
                this.modDisable = (data & 0x80) !== 0
            }
            else if (register === 0x4088) {
                if (this.modDisable) {
                    for (let i = 0; i < 2; ++i) {
                        this.modTable[this.modTableAddr] = data & 7
                        this.modTableAddr = this.modTableAddr + 1 & 63
                    }
                }
                this.modAccum = 0
            }
            else if (register === 0x4089) {
                this.masterVol = data & 3
                this.waveWriteEnable = (data & 0x80) !== 0
            }
            else if (register === 0x408A) {
                this.envClockMultiplier = data
            }
        }
    }

    public read(register: number): number {
        if (register >= 0x4040 && register < 0x4080) {
            return this.wavetable[register - 0x4040] | 0x40
        }
        else if (register === 0x4090) {
            return this.volGain
        }
        else if (register === 0x4092) {
            return this.modGain
        }
        else {
            return 0x40
        }
    }

    public getval(): number {
        return this.lpaccum
    }
}
