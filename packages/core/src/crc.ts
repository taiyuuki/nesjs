class CRC {
    private static readonly CHAR_BIT = 8
    private static readonly CRCPOLY1 = 0x04C11DB7
    private static readonly CRCPOLY2 = 0xEDB88320

    private static m_Init = false
    private static m_InitRev = false
    private static m_CrcTable: Uint32Array = new Uint32Array(256)
    private static m_CrcTableRev: Uint32Array = new Uint32Array(256)

    public static Crc(size: number, c: Uint8Array): number {
        if (!CRC.m_Init) {
            CRC.MakeTable()
            CRC.m_Init = true
        }

        let r = 0xFFFFFFFF
        let step = 0
        while (--size >= 0) {
            const idx = r >>> 32 - CRC.CHAR_BIT ^ c[step]
            r = r << CRC.CHAR_BIT ^ CRC.m_CrcTable[idx & 0xFF]
            step++
            r = r >>> 0 // 保持无符号
        }

        return ~r >>> 0 & 0xFFFFFFFF
    }

    public static CrcRev(size: number, c: Uint8Array): number {
        if (!CRC.m_InitRev) {
            CRC.MakeTableRev()
            CRC.m_InitRev = true
        }

        let r = 0xFFFFFFFF
        let step = 0
        while (--size >= 0) {
            const idx = r & 0xFF ^ c[step]
            r = r >>> CRC.CHAR_BIT ^ CRC.m_CrcTableRev[idx & 0xFF]
            step++
            r = r >>> 0 // 保持无符号
        }

        return (r ^ 0xFFFFFFFF) >>> 0
    }

    private static MakeTable(): void {
        for (let i = 0; i <= 0xFF; i++) {
            let r = i << 32 - CRC.CHAR_BIT
            for (let j = 0; j < CRC.CHAR_BIT; j++) {
                if (r & 0x80000000) {
                    r = r << 1 ^ CRC.CRCPOLY1
                }
                else {
                    r <<= 1
                }
            }
            CRC.m_CrcTable[i] = r >>> 0
        }
    }

    private static MakeTableRev(): void {
        for (let i = 0; i <= 0xFF; i++) {
            let r = i
            for (let j = 0; j < CRC.CHAR_BIT; j++) {
                if (r & 1) {
                    r = r >>> 1 ^ CRC.CRCPOLY2
                }
                else {
                    r >>>= 1
                }
            }
            CRC.m_CrcTableRev[i] = r >>> 0
        }
    }
}

export { CRC }
