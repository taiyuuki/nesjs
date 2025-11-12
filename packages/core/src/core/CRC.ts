/**
 * CRC-16 implementation for FDS (Famicom Disk System)
 * Uses polynomial 0x8408 (reversed form of 0x1021)
 * This is the exact algorithm used by FDS BIOS
 */
class CRC16 {
    private crc: number

    constructor() {
        this.crc = 0x0000 // FDS starts with 0x0000
    }

    /**
     * Update CRC with a single byte
     * This matches the FDS BIOS CRC algorithm
     */
    public update(byte: number): void {
        this.crc ^= byte & 0xFF
        
        for (let i = 0; i < 8; i++) {
            if (this.crc & 1) {
                this.crc = this.crc >> 1 ^ 0x8408
            }
            else {
                this.crc >>= 1
            }
        }
        
        this.crc &= 0xFFFF
    }

    /**
     * Get current CRC value (16-bit)
     */
    public getValue(): number {
        return this.crc & 0xFFFF
    }

    /**
     * Reset CRC to initial value
     */
    public reset(): void {
        this.crc = 0x0000
    }
}

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

export { CRC16, CRC32 }
