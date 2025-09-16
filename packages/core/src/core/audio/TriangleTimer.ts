import { Timer } from './Timer'

// 三角波定时器
export class TriangleTimer extends Timer {
    private divider: number = 0
    protected position: number = 0
    private static readonly periodadd: number = 1
    
    // 三角波序列
    private static readonly triangle = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    ]

    constructor() {
        super()
        this.period = 0
        this.position = 0
    }

    public clock(cycles: number = 1): void {
        if (this.period === 0) {
            return
        }
        this.divider += cycles
        
        // 计算经过的周期数
        const totalPeriod = this.period + TriangleTimer.periodadd
        let periods = Math.floor((this.divider + totalPeriod) / totalPeriod)
        if (periods < 0) {
            periods = 0
        }
        
        this.position = this.position + periods & 0x1F // 32个位置
        this.divider -= totalPeriod * periods
    }

    public getval(): number {
        return this.period === 0 ? 7 : TriangleTimer.triangle[this.position]
    }

    public reset(): void {

        // 三角波没有重置方式
    }

    public setperiod(newperiod: number): void {
        this.period = newperiod
        if (this.period === 0) {
            this.position = 7
        }
    }

    public setduty(_duty: number[] | number): void {
        throw new Error('Triangle counter has no duty setting.')
    }
}
