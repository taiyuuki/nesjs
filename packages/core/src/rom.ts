import type { NES } from './nes'
import { Tile } from './tile'
import { Mappers } from './mappers'

class ROM {

    // Mirroring types:
    VERTICAL_MIRRORING = 0
    HORIZONTAL_MIRRORING = 1
    FOURSCREEN_MIRRORING = 2
    SINGLESCREEN_MIRRORING = 3
    SINGLESCREEN_MIRRORING2 = 4
    SINGLESCREEN_MIRRORING3 = 5
    CHRROM_MIRRORING = 7

    header: number[] = []
    rom: number[][] = []
    vrom: number[][] = []
    vromTile: Tile[][] = []

    romCount = 0
    vromCount = 0
    mirroring = 0
    batteryRam: boolean = false
    batteryRamData: Uint8Array | null = null
    trainer = false
    trainerData: Uint8Array | null = null
    fourScreen = false
    mapperType = 0
    valid = false
    mapperName = new Array<string[] | string>(92)
    submapper = -1
    isNES20 = false

    // crc32 = 0

    constructor(public nes: NES) {
        for (let i = 0; i < 92; i++) {
            this.mapperName[i] = 'Unknown Mapper'
        }
        this.mapperName[0] = 'Direct Access'
        this.mapperName[1] = 'Nintendo MMC1'
        this.mapperName[2] = 'UNROM'
        this.mapperName[3] = 'CNROM'
        this.mapperName[4] = [
            'Nintendo MMC3',
            'Nintendo MMC6',
            'MMC3C',
            'MC-ACC',
            'NEC MMC3',
            'T9552',
        ]
        this.mapperName[5] = 'Nintendo MMC5'
        this.mapperName[6] = 'FFE F4xxx'
        this.mapperName[7] = 'AOROM'
        this.mapperName[8] = 'FFE F3xxx'
        this.mapperName[9] = 'Nintendo MMC2'
        this.mapperName[10] = 'Nintendo MMC4'
        this.mapperName[11] = 'Color Dreams Chip'
        this.mapperName[12] = 'FFE F6xxx'
        this.mapperName[15] = '100-in-1 switch'
        this.mapperName[16] = 'Bandai chip'
        this.mapperName[17] = 'FFE F8xxx'
        this.mapperName[18] = 'Jaleco SS8806 chip'
        this.mapperName[19] = 'Namcot 106 chip'
        this.mapperName[20] = 'Famicom Disk System'
        this.mapperName[21] = 'Konami VRC4a'
        this.mapperName[22] = 'Konami VRC2a'
        this.mapperName[23] = 'Konami VRC2a'
        this.mapperName[24] = 'Konami VRC6'
        this.mapperName[25] = 'Konami VRC4b'
        this.mapperName[32] = 'Irem G-101 chip'
        this.mapperName[33] = 'Taito TC0190/TC0350'
        this.mapperName[34] = '32kB ROM switch'
        
        this.mapperName[64] = 'Tengen RAMBO-1 chip'
        this.mapperName[65] = 'Irem H-3001 chip'
        this.mapperName[66] = 'GNROM switch'
        this.mapperName[67] = 'SunSoft3 chip'
        this.mapperName[68] = 'SunSoft4 chip'
        this.mapperName[69] = 'SunSoft5 FME-7 chip'
        this.mapperName[71] = 'Camerica chip'
        this.mapperName[78] = 'Irem 74HC161/32-based'
        this.mapperName[91] = 'Pirate HK-SF3 chip'
    }

    load(data: string) {
        let i, 
            j, 
            v

        const buffer = new Uint8Array(data.length)
        for (let i = 0; i < data.length; i++) {
            buffer[i] = data.charCodeAt(i) & 0xFF
        }

        this.header = Array.from(buffer.subarray(0, 16))

        if (String.fromCharCode(...buffer.subarray(0, 4)) !== 'NES\x1a') {
            throw new Error('Not a valid NES ROM.')
        }

        this.romCount = this.header[4]
        this.vromCount = this.header[5] * 2 // Get the number of 4kB banks, not 8kB
        this.mirroring = (this.header[6] & 1) === 0 ? 0 : 1
        this.batteryRam = (this.header[6] & 2) !== 0
        this.trainer = (this.header[6] & 4) !== 0
        this.fourScreen = (this.header[6] & 8) !== 0
        this.mapperType = this.header[6] >> 4 | this.header[7] & 0xf0
        this.isNES20 = (this.header[7] & 0x0C) === 0x08
        if (this.isNES20) {
            this.submapper = this.header[8] >> 4
        }

        /* TODO
            if (this.batteryRam)
                this.loadBatteryRam();*/
        // Check whether byte 8-15 are zero's:
        let foundError = false
        for (i = 8; i < 16; i++) {
            if (this.header[i] !== 0) {
                foundError = true
                break
            }
        }
        if (foundError) {
            this.mapperType &= 0xf // Ignore byte 7
        }

        // Load trainer data:
        let offset = 16
        if (this.trainer) {
            this.trainerData = buffer.subarray(offset, offset + 512)
            offset += 512
        }

        // Load PRG-ROM banks:
        this.rom = new Array(this.romCount)
        for (let i = 0; i < this.romCount; i++) {
            const start = offset + i * 16384
            const end = start + 16384
            this.rom[i] = Array.from(buffer.subarray(start, end))
        }
        offset += this.romCount * 16384

        // Load CHR-ROM banks:
        this.vrom = new Array(this.vromCount)
        for (let i = 0; i < this.vromCount; i++) {
            const start = offset + i * 4096
            const end = start + 4096
            this.vrom[i] = Array.from(buffer.subarray(start, end))
        }
    
        // Create VROM tiles:
        this.vromTile = new Array(this.vromCount)
        for (i = 0; i < this.vromCount; i++) {
            this.vromTile[i] = new Array(256)
            for (j = 0; j < 256; j++) {
                this.vromTile[i][j] = new Tile()
            }
        }
    
        // Convert CHR-ROM banks to tiles:
        let tileIndex
        let leftOver
        for (v = 0; v < this.vromCount; v++) {
            for (i = 0; i < 4096; i++) {
                tileIndex = i >> 4
                leftOver = i % 16
                if (leftOver < 8) {
                    this.vromTile[v][tileIndex].setScanline(
                        leftOver,
                        this.vrom[v][i],
                        this.vrom[v][i + 8],
                    )
                }
                else {
                    this.vromTile[v][tileIndex].setScanline(
                        leftOver - 8,
                        this.vrom[v][i - 8],
                        this.vrom[v][i],
                    )
                }
            }
        }
    
        this.valid = true

        // this.crc32 = this.calculateCRC32(buffer)
    }
    
    getMirroringType() {
        if (this.fourScreen) {
            return this.FOURSCREEN_MIRRORING
        }
        if (this.mirroring === 0) {
            return this.HORIZONTAL_MIRRORING
        }

        return this.VERTICAL_MIRRORING
    }
    
    getMapperName() {
        if (this.mapperType >= 0 && this.mapperType < this.mapperName.length) {
            if (Array.isArray(this.mapperName[this.mapperType])) {
                if (this.isNES20 && this.submapper >= 0 && this.submapper < this.mapperName[this.mapperType].length) {
                    return this.mapperName[this.mapperType][this.submapper]
                }

                return this.mapperName[this.mapperType][0]
            }

            return this.mapperName[this.mapperType]
        }

        return `Unknown Mapper, ${this.mapperType}`
    }
    
    mapperSupported() {
        return typeof Mappers[this.mapperType] !== 'undefined'
    }
    
    createMapper() {
        if (this.mapperSupported()) {
            return new Mappers[this.mapperType](this.nes)
        }
        else {
            this.notSupportError()
        }
    }

    notSupportError() {
        throw new Error(`This ROM uses a mapper not supported: ${
            this.getMapperName()
        }(${
            this.mapperType
        })`)
    }

    // private calculateCRC32(buffer: Uint8Array) {

    //     const polynomial = 0xEDB88320
    //     let crc = 0xFFFFFFFF

    //     // 计算整个ROM数据（包含PRG和CHR）
    //     for (let i = 16; i < buffer.length; i++) { // 跳过16字节头
    //         crc ^= buffer[i]
    //         for (let j = 0; j < 8; j++) {
    //             crc = crc >>> 1 ^ (crc & 1 ? polynomial : 0)
    //         }
    //     }

    //     return crc ^ 0xFFFFFFFF // 取反得到最终CRC32
    // }

    // getPRGCrc32() {
    //     return this.crc32
    // }

    toJSON() {
        return {
            header: this.header,
            rom: this.rom,
            vrom: this.vrom,
            vromTile: this.vromTile,
            romCount: this.romCount,
            vromCount: this.vromCount,
            mirroring: this.mirroring,
            batteryRam: this.batteryRam,
            trainer: this.trainer,
            fourScreen: this.fourScreen,
            mapperType: this.mapperType,
            valid: this.valid,
            mapperName: this.mapperName,
        }
    }
}

export { ROM }
