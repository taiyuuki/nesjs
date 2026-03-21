import { describe, expect, it } from 'vitest'
import { PPU } from '../src/core/PPU'
import { ROMLoader } from '../src/core/ROMLoader'
import MMC5Mapper from '../src/core/mappers/MapperList/MMC5Mapper'

function createMockMMC5ROMData(
    prgSize: number = 32 * 1024,
    chrSize: number = 32 * 1024,
): Uint8Array {
    const data = new Uint8Array(16 + prgSize + chrSize)

    data[0] = 0x4E
    data[1] = 0x45
    data[2] = 0x53
    data[3] = 0x1A
    data[4] = prgSize / 16384
    data[5] = chrSize / 8192
    data[6] = 0x50 // mapper 5 low nibble
    data[7] = 0x08 // NES 2.0
    data[8] = 0x00

    const chrStart = 16 + prgSize
    const chrBanks4K = chrSize / 4096
    for (let bank = 0; bank < chrBanks4K; bank++) {
        const bankStart = chrStart + bank * 4096
        data.fill(bank & 0xFF, bankStart, bankStart + 4096)
    }

    return data
}

function createMockMMC5ChrRamROMData(
    prgSize: number = 512 * 1024,
    chrRamShift: number = 9,
): Uint8Array {
    const data = new Uint8Array(16 + prgSize)

    data[0] = 0x4E
    data[1] = 0x45
    data[2] = 0x53
    data[3] = 0x1A
    data[4] = prgSize / 16384
    data[5] = 0
    data[6] = 0x52 // mapper 5 low nibble + battery
    data[7] = 0x08
    data[8] = 0x00
    data[10] = 0x07 // 8KB PRG-RAM
    data[11] = chrRamShift & 0x0F // CHR-RAM size

    return data
}

function createMMC5Fixture() {
    const loader = new ROMLoader(createMockMMC5ROMData())
    loader.parseHeader()

    const mapper = new MMC5Mapper(loader)
    mapper.loadROM()

    const ppu = new PPU(mapper)
    mapper.ppu = ppu

    mapper.cartWrite(0x5101, 0x01) // 4KB CHR mode
    ppu.write(0, 0x20) // 8x16 sprite mode

    return { mapper, ppu }
}

describe('MMC5 Mapper CHR bank selection', () => {
    it('uses the last written CHR register group outside rendering', () => {
        const { mapper } = createMMC5Fixture()

        mapper.cartWrite(0x5123, 0x01) // A[3] -> lower 4KB bank 1
        mapper.fetchcount = 0
        mapper.spritemode = false
        expect(mapper.ppuRead(0x0000)).toBe(0x01)

        mapper.cartWrite(0x512B, 0x02) // B[3] -> lower 4KB bank 2
        mapper.fetchcount = 0
        mapper.spritemode = false
        expect(mapper.ppuRead(0x0000)).toBe(0x02)
    })

    it('uses background banks for background fetches during 8x16 rendering', () => {
        const { mapper, ppu } = createMMC5Fixture()

        mapper.cartWrite(0x5123, 0x01)
        mapper.cartWrite(0x512B, 0x02)

        ppu.write(1, 0x18)
        ppu.scanline = 10
        mapper.fetchcount = 0
        mapper.spritemode = false

        expect(mapper.ppuRead(0x0000)).toBe(0x02)
    })

    it('keeps sprite fetches on sprite banks during 8x16 rendering', () => {
        const { mapper, ppu } = createMMC5Fixture()

        mapper.cartWrite(0x5123, 0x01)
        mapper.cartWrite(0x512B, 0x02)

        ppu.write(1, 0x18)
        ppu.scanline = 10
        mapper.fetchcount = 0
        mapper.spritemode = true

        expect(mapper.ppuRead(0x0000)).toBe(0x01)
    })

    it('supports MMC5 CHR-RAM cartridges declared via NES 2.0 header', () => {
        const loader = new ROMLoader(createMockMMC5ChrRamROMData())
        loader.parseHeader()

        const mapper = new MMC5Mapper(loader)
        mapper.loadROM()

        expect(loader.chrRamSize).toBe(32768)
        expect(mapper.getCHRSize()).toBe(32768)

        mapper.ppuWrite(0x0000, 0x5A)
        expect(mapper.ppuRead(0x0000)).toBe(0x5A)
    })
})
