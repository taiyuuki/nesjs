import { Timer } from './Timer'

// 方波定时器
export class SquareTimer extends Timer {
    protected position: number = 0
    private divider: number = 0
    private values: number[]
    private readonly periodadd: number

    constructor(private ctrlen: number, periodadd = 0) {
        super()
        this.periodadd = periodadd
        this.values = new Array(ctrlen)
        this.setduty(Math.floor(ctrlen / 2))
    }

    public clock(cycles: number = 1): void {
        if (this.period < 8) {
            return
        }
        this.divider += cycles
        
        // 计算经过的周期数
        const totalPeriod = this.period + this.periodadd
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
        return this.values[this.position]
    }

    public reset(): void {
        this.position = 0
    }

    public setduty(duty: number[]): void
    public setduty(duty: number): void
    public setduty(duty: number[] | number): void {
        if (Array.isArray(duty)) {
            this.values = [...duty]
        } 
        else {
            for (let i = 0; i < this.values.length; i++) {
                this.values[i] = i < duty ? 1 : 0
            }
        }
    }
}
