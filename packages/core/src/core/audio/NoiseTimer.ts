import { Utils } from '../types'
import { Timer } from './Timer'

// 噪声定时器
export class NoiseTimer extends Timer {
    private divider: number = 0
    protected position: number = 0
    private values: number[] = NoiseTimer.genvalues(1, 1)
    private prevduty: number = 1
    private static readonly periodadd: number = 0

    constructor() {
        super()
        this.period = 0
    }

    public clock(cycles: number = 1): void {
        this.divider += cycles
        
        // 计算经过的周期数
        const totalPeriod = this.period + NoiseTimer.periodadd
        if (totalPeriod <= 0) {
            return
        }
        
        let periods = Math.floor((this.divider + totalPeriod) / totalPeriod)
        if (periods < 0) {
            periods = 0
        }
        
        this.position = (this.position + periods) % this.values.length
        this.divider -= totalPeriod * periods
    }

    public getval(): number {
        return this.values[this.position] & 1
    }

    public reset(): void {
        this.position = 0
    }

    public setduty(duty: number): void
    public setduty(duty: number[]): void
    public setduty(duty: number[] | number): void {
        if (Array.isArray(duty)) {
            throw new Error('Not supported on noise channel.')
        }
        
        if (duty !== this.prevduty) {
            this.values = NoiseTimer.genvalues(duty, this.values[this.position])
            this.position = 0
        }
        this.prevduty = duty
    }

    public setEnable(_enable: boolean): void {

        // 噪声定时器没有enable状态
    }

    private static genvalues(whichbit: number, seed: number): number[] {
        const length = whichbit === 1 ? 32767 : 93
        const values = new Array(length)
        
        for (let i = 0; i < length; i++) {
            const bit1 = (seed & 1 << whichbit) !== 0
            const bit2 = (seed & Utils.BIT0) !== 0
            const xorResult = bit1 !== bit2
            seed = seed >> 1 
                | (xorResult ? 16384 : 0)
            values[i] = seed
        }
        
        return values
    }
}
