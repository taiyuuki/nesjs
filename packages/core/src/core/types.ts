
// 枚举类型定义
export enum MirrorType {
    H_MIRROR = 'H_MIRROR',
    V_MIRROR = 'V_MIRROR', 
    SS_MIRROR0 = 'SS_MIRROR0',
    SS_MIRROR1 = 'SS_MIRROR1',
    FOUR_SCREEN_MIRROR = 'FOUR_SCREEN_MIRROR',
}

export enum TVType {
    NTSC = 'NTSC',
    PAL = 'PAL',
    DENDY = 'DENDY',
}

// 异常类
export class BadMapperException extends Error {
    public e: string

    constructor(message: string) {
        super(message)
        this.e = message
        this.name = 'BadMapperException'
    }
}

// 工具类常量
export class Utils {
    public static readonly BIT0 = 1
    public static readonly BIT1 = 2
    public static readonly BIT2 = 4
    public static readonly BIT3 = 8
    public static readonly BIT4 = 16
    public static readonly BIT5 = 32
    public static readonly BIT6 = 64
    public static readonly BIT7 = 128
    public static readonly BIT8 = 256
    public static readonly BIT9 = 512
    public static readonly BIT10 = 1024
    public static readonly BIT11 = 2048
    public static readonly BIT12 = 4096
    public static readonly BIT13 = 8192
    public static readonly BIT14 = 16384
    public static readonly BIT15 = 32768

    public static setbit(num: number, bitnum: number, state: boolean): number {
        return state ? num | 1 << bitnum : num & ~(1 << bitnum)
    }

    public static hex(num: number): string {
        let s = num.toString(16).toUpperCase()
        if ((s.length & 1) === 1) {
            s = `0${s}`
        }

        return s
    }

    public static reverseByte(nibble: number): number {

        // 分治交换技巧：4位->2位->1位
        let b = nibble & 0xff
        b = (b & 0xF0) >> 4 | (b & 0x0F) << 4 // 交换高低4位
        b = (b & 0xCC) >> 2 | (b & 0x33) << 2 // 交换每对2位
        b = (b & 0xAA) >> 1 | (b & 0x55) << 1 // 交换相邻位

        return b
    }
}
