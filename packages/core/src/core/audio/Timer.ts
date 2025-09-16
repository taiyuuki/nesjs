// 音频定时器基类
export abstract class Timer {
    protected period: number = 0
    protected position: number = 0

    constructor() {}

    abstract clock(cycles?: number): void
    abstract getval(): number
    abstract reset(): void

    public setperiod(period: number): void {
        this.period = period
    }

    public getperiod(): number {
        return this.period
    }

    public setduty(duty: number[]): void
    public setduty(duty: number): void
    public setduty(_duty: number[] | number): void {

        // 默认实现 - 子类需要重写
    }
}

