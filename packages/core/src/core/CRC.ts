class CRC32 {
    private static TABLE: Uint32Array
    private crc: number

    constructor() {
        this.crc = 0xFFFFFFFF // 初始值
        if (!CRC32.TABLE) {
            CRC32.TABLE = CRC32.makeTable()
        }
    }

    private static makeTable(): Uint32Array {
        const table = new Uint32Array(256)
        for (let n = 0; n < 256; n++) {
            let c = n
            for (let k = 0; k < 8; k++) {
                c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1
            }
            table[n] = c
        }

        return table
    }

    public update(b: number): void {
        const index = (this.crc ^ b) & 0xFF
        this.crc = CRC32.TABLE[index] ^ this.crc >>> 8
    }

    public getValue(): number {

        return (this.crc ^ 0xFFFFFFFF) >>> 0
    }
}

export { CRC32 }
