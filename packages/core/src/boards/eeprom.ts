class ArrayRef<T> {
    constructor(public buffer: T[], public offset: number = 0) {}

    get(index: number): T {
        return this.buffer[this.offset + index]
    }

    set(index: number, value: T): void {
        this.buffer[this.offset + index] = value
    }
}

// X24C01 状态枚举
const X24C01_STATE = {
    IDLE: 0, // Idle
    ADDRESS: 1, // Address set
    READ: 2, // Read
    WRITE: 3, // Write
    ACK: 4, // Acknowledge
    ACK_WAIT: 5, // Acknowledge wait
}

class X24C01 {
    now_state: number = X24C01_STATE.IDLE
    next_state: number = X24C01_STATE.IDLE
    bitcnt: number = 0
    addr: number = 0
    data: number = 0
    sda: number = 0xFF
    scl_old: number = 0
    sda_old: number = 0
    pEEPDATA: ArrayRef<number> | null = null

    constructor() {}

    reset(ptr: ArrayRef<number>): void {
        this.now_state = X24C01_STATE.IDLE
        this.next_state = X24C01_STATE.IDLE
        this.addr = 0
        this.data = 0
        this.sda = 0xFF
        this.scl_old = 0
        this.sda_old = 0
        this.pEEPDATA = ptr
    }

    write(scl_in: number, sda_in: number): void {
        const scl_rise = ~this.scl_old & scl_in & 0xFF
        const scl_fall = this.scl_old & ~scl_in & 0xFF
        const sda_rise = ~this.sda_old & sda_in & 0xFF
        const sda_fall = this.sda_old & ~sda_in & 0xFF

        const scl_old_temp = this.scl_old

        // const sda_old_temp = this.sda_old

        this.scl_old = scl_in
        this.sda_old = sda_in

        // Start condition
        if (scl_old_temp !== 0 && sda_fall !== 0) {
            this.now_state = X24C01_STATE.ADDRESS
            this.bitcnt = 0
            this.addr = 0
            this.sda = 0xFF

            return
        }

        // Stop condition
        if (scl_old_temp !== 0 && sda_rise !== 0) {
            this.now_state = X24C01_STATE.IDLE
            this.sda = 0xFF

            return
        }

        // SCL上升沿处理
        if (scl_rise !== 0) {
            switch (this.now_state) {
                case X24C01_STATE.ADDRESS:
                    if (this.bitcnt < 7) {
                        this.addr = this.addr & ~(1 << this.bitcnt) | (sda_in === 0 ? 0 : 1) << this.bitcnt
                    }
                    else {
                        this.next_state = sda_in === 0 ? X24C01_STATE.WRITE : X24C01_STATE.READ
                        this.data = this.pEEPDATA!.get(this.addr & 0x7F)
                    }
                    this.bitcnt++
                    break
                case X24C01_STATE.ACK:
                    this.sda = 0 // ACK
                    break
                case X24C01_STATE.READ:
                    if (this.bitcnt < 8) {
                        this.sda = (this.data & 1 << this.bitcnt) === 0 ? 0 : 1
                    }
                    this.bitcnt++
                    break
                case X24C01_STATE.WRITE:
                    if (this.bitcnt < 8) {
                        this.data = this.data & ~(1 << this.bitcnt) | (sda_in === 0 ? 0 : 1) << this.bitcnt
                    }
                    this.bitcnt++
                    break
                case X24C01_STATE.ACK_WAIT:
                    if (sda_in === 0) this.next_state = X24C01_STATE.IDLE
                    break
            }
        }

        // SCL下降沿处理
        if (scl_fall !== 0) {
            switch (this.now_state) {
                case X24C01_STATE.ADDRESS:
                    if (this.bitcnt >= 8) {
                        this.now_state = X24C01_STATE.ACK
                        this.sda = 0xFF
                    }
                    break
                case X24C01_STATE.ACK:
                    this.now_state = this.next_state
                    this.bitcnt = 0
                    this.sda = 0xFF
                    break
                case X24C01_STATE.READ:
                    if (this.bitcnt >= 8) {
                        this.now_state = X24C01_STATE.ACK_WAIT
                        this.addr = this.addr + 1 & 0x7F
                    }
                    break
                case X24C01_STATE.WRITE:
                    if (this.bitcnt >= 8) {
                        this.now_state = X24C01_STATE.ACK
                        this.next_state = X24C01_STATE.IDLE
                        this.pEEPDATA!.set(this.addr & 0x7F, this.data)
                        this.addr = this.addr + 1 & 0x7F
                    }
                    break
            }
        }
    }

    read(): number {
        return this.sda
    }

    // 模拟指针操作，用数组存储状态
    load(buffer: number[]): void {
        this.now_state = buffer[0]
        this.next_state = buffer[1]
        this.bitcnt = buffer[2]
        this.addr = buffer[3]
        this.data = buffer[4]
        this.sda = buffer[5]
        this.scl_old = buffer[6]
        this.sda_old = buffer[7]
    }

    save(): number[] {
        return [
            this.now_state,
            this.next_state,
            this.bitcnt,
            this.addr,
            this.data,
            this.sda,
            this.scl_old,
            this.sda_old,
        ]
    }
}

class X24C02 {
    public static readonly X24C02_IDLE = 0 // 空闲
    public static readonly X24C02_DEVADDR = 1 // 设备地址已设置
    public static readonly X24C02_ADDRESS = 2 // 地址已设置
    public static readonly X24C02_READ = 3 // 读取
    public static readonly X24C02_WRITE = 4 // 写入
    public static readonly X24C02_ACK = 5 // 应答
    public static readonly X24C02_NAK = 6 // 不应答
    public static readonly X24C02_ACK_WAIT = 7 // 应答等待

    private now_state: number
    private next_state: number
    private bitcnt: number
    private addr: number
    private data: number
    private rw: number
    private sda: number
    private scl_old: number
    private sda_old: number

    private pEEPDATA: Uint8Array | null

    constructor() {
        this.now_state = X24C02.X24C02_IDLE
        this.next_state = X24C02.X24C02_IDLE
        this.bitcnt = 0
        this.addr = 0
        this.data = 0
        this.rw = 0
        this.sda = 0xFF
        this.scl_old = 0
        this.sda_old = 0

        this.pEEPDATA = null
    }

    public reset(ptr: Uint8Array | null): void {
        this.now_state = X24C02.X24C02_IDLE
        this.next_state = X24C02.X24C02_IDLE
        this.addr = 0
        this.data = 0
        this.rw = 0
        this.sda = 0xFF
        this.scl_old = 0
        this.sda_old = 0

        this.pEEPDATA = ptr
    }

    public write(scl_in: number, sda_in: number): void {

        // 时钟线
        const scl_rise = ~this.scl_old & scl_in
        const scl_fall = this.scl_old & ~scl_in

        // 数据线
        const sda_rise = ~this.sda_old & sda_in
        const sda_fall = this.sda_old & ~sda_in

        const scl_old_temp = this.scl_old

        // const sda_old_temp = this.sda_old

        this.scl_old = scl_in
        this.sda_old = sda_in

        // 起始条件？
        if (scl_old_temp !== 0 && sda_fall !== 0) {
            this.now_state = X24C02.X24C02_DEVADDR
            this.bitcnt = 0
            this.sda = 0xFF

            return
        }

        // 停止条件？
        if (scl_old_temp !== 0 && sda_rise !== 0) {
            this.now_state = X24C02.X24C02_IDLE
            this.sda = 0xFF

            return
        }

        // SCL ____---- 上升沿
        if (scl_rise !== 0) {
            switch (this.now_state) {
                case X24C02.X24C02_DEVADDR:
                    if (this.bitcnt < 8) {
                        this.data = this.data & ~(1 << 7 - this.bitcnt) | (sda_in === 0 ? 0 : 1) << 7 - this.bitcnt
                    }
                    this.bitcnt++
                    break
                case X24C02.X24C02_ADDRESS:
                    if (this.bitcnt < 8) {
                        this.addr = this.addr & ~(1 << 7 - this.bitcnt) | (sda_in === 0 ? 0 : 1) << 7 - this.bitcnt
                    }
                    this.bitcnt++
                    break
                case X24C02.X24C02_READ:
                    if (this.bitcnt < 8) {
                        this.sda = (this.data & 1 << 7 - this.bitcnt) === 0 ? 0 : 1
                    }
                    this.bitcnt++
                    break
                case X24C02.X24C02_WRITE:
                    if (this.bitcnt < 8) {
                        this.data = this.data & ~(1 << 7 - this.bitcnt) | (sda_in === 0 ? 0 : 1) << 7 - this.bitcnt
                    }
                    this.bitcnt++
                    break
                case X24C02.X24C02_NAK:
                    this.sda = 0xFF // NAK
                    break
                case X24C02.X24C02_ACK:
                    this.sda = 0 // ACK
                    break
                case X24C02.X24C02_ACK_WAIT:
                    if (sda_in === 0) {
                        this.next_state = X24C02.X24C02_READ
                        if (this.pEEPDATA) {
                            this.data = this.pEEPDATA[this.addr]
                        }
                    }
                    break
            }
        }

        // SCL ----____ 下降沿
        if (scl_fall !== 0) {
            switch (this.now_state) {
                case X24C02.X24C02_DEVADDR:
                    if (this.bitcnt >= 8) {
                        if ((this.data & 0xA0) === 0xA0) {
                            this.now_state = X24C02.X24C02_ACK
                            this.rw = this.data & 0x01
                            this.sda = 0xFF
                            if (this.rw === 0) {
                                this.next_state = X24C02.X24C02_ADDRESS
                            }
                            else {

                                // 现在地址读取
                                this.next_state = X24C02.X24C02_READ
                                if (this.pEEPDATA) {
                                    this.data = this.pEEPDATA[this.addr]
                                }
                            }
                            this.bitcnt = 0
                        }
                        else {
                            this.now_state = X24C02.X24C02_NAK
                            this.next_state = X24C02.X24C02_IDLE
                            this.sda = 0xFF
                        }
                    }
                    break
                case X24C02.X24C02_ADDRESS:
                    if (this.bitcnt >= 8) {
                        this.now_state = X24C02.X24C02_ACK
                        this.sda = 0xFF
                        if (this.rw === 0) {

                            // 转换为数据写入
                            this.next_state = X24C02.X24C02_WRITE
                        }
                        else {

                            // 在读取模式下，理论上不会到达这里，但为了完整性还是写上了
                            this.next_state = X24C02.X24C02_IDLE
                        }
                        this.bitcnt = 0
                    }
                    break
                case X24C02.X24C02_READ:
                    if (this.bitcnt >= 8) {
                        this.now_state = X24C02.X24C02_ACK_WAIT
                        this.addr = this.addr + 1 & 0xFF
                    }
                    break
                case X24C02.X24C02_WRITE:
                    if (this.bitcnt >= 8) {
                        if (this.pEEPDATA !== null) {
                            this.pEEPDATA[this.addr] = this.data
                        }
                        this.now_state = X24C02.X24C02_ACK
                        this.next_state = X24C02.X24C02_WRITE
                        this.addr = this.addr + 1 & 0xFF
                        this.bitcnt = 0
                    }
                    break
                case X24C02.X24C02_NAK:
                    this.now_state = X24C02.X24C02_IDLE
                    this.bitcnt = 0
                    this.sda = 0xFF
                    break
                case X24C02.X24C02_ACK:
                    this.now_state = this.next_state
                    this.bitcnt = 0
                    this.sda = 0xFF
                    break
                case X24C02.X24C02_ACK_WAIT:
                    this.now_state = this.next_state
                    this.bitcnt = 0
                    this.sda = 0xFF
                    break
            }
        }
    }

    public read(): number {
        return this.sda
    }

    public load(p: Uint8Array): void {
        this.next_state = p[4] + (p[5] << 8) + (p[6] << 16) + (p[7] << 24)
        this.bitcnt = p[8] + (p[9] << 8) + (p[10] << 16) + (p[11] << 24)
        this.addr = p[12]
        this.data = p[13]
        this.rw = p[14]
        this.sda = p[15]
        this.scl_old = p[16]
        this.sda_old = p[17]
    }

    public save(p: Uint8Array): void {
        p[0] = this.now_state & 0xFF
        p[1] = this.now_state >> 8 & 0xFF
        p[2] = this.now_state >> 16 & 0xFF
        p[3] = this.now_state >> 24 & 0xFF
        p[4] = this.next_state & 0xFF
        p[5] = this.next_state >> 8 & 0xFF
        p[6] = this.next_state >> 16 & 0xFF
        p[7] = this.next_state >> 24 & 0xFF
        p[8] = this.bitcnt & 0xFF
        p[9] = this.bitcnt >> 8 & 0xFF
        p[10] = this.bitcnt >> 16 & 0xFF
        p[11] = this.bitcnt >> 24 & 0xFF
        p[12] = this.addr
        p[13] = this.data
        p[14] = this.rw
        p[15] = this.sda
        p[16] = this.scl_old
        p[17] = this.sda_old
    }
}

// // 示例用法
// const eepromData = new Uint8Array(256); // 256字节的EEPROM数据
// const x24c02 = new X24C02();
// x24c02.Reset(eepromData);

// // 模拟写入数据
// x24c02.Write(0, 1); // 模拟SCL和SDA信号变化
// x24c02.Write(1, 1);
// x24c02.Write(1, 0);
// x24c02.Write(0, 0);
// // ...继续模拟信号变化以完成写入

// // 读取数据
// const readData = x24c02.Read();
// console.log(readData);

export { X24C01, X24C02 }
