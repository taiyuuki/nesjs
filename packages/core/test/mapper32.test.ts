import { beforeEach, describe, expect, it } from 'vitest'
import { ROMLoader } from '../src/core/ROMLoader'
import Mapper32 from '../src/core/mappers/MapperList/Mapper32'

function createMockROMData(submapper: number = 0): Uint8Array {
    const prgSize = 64 * 1024
    const chrSize = 8 * 1024
    const totalSize = 0x10 + prgSize + chrSize
    const data = new Uint8Array(totalSize)

    data[0] = 0x4E
    data[1] = 0x45
    data[2] = 0x53
    data[3] = 0x1A
    data[4] = prgSize / 16384
    data[5] = chrSize / 8192
    data[6] = (32 & 0x0F) << 4
    data[7] = 0x08 | 32 & 0xF0
    data[8] = (submapper & 0x0F) << 4 | 32 >> 8 & 0x0F

    const prgBanks = prgSize / 8192
    for (let bank = 0; bank < prgBanks; bank++) {
        const bankStart = 0x10 + bank * 8192
        data.fill(bank, bankStart, bankStart + 8192)
    }

    const chrBanks = chrSize / 1024
    for (let bank = 0; bank < chrBanks; bank++) {
        const bankStart = 0x10 + prgSize + bank * 1024
        data.fill(bank, bankStart, bankStart + 1024)
    }

    return data
}

describe('Mapper32', () => {
    let mapper: Mapper32

    beforeEach(() => {
        const loader = new ROMLoader(createMockROMData())
        mapper = new Mapper32(loader)
        mapper.loadROM()
    })

    it('maps the default PRG layout', () => {
        expect(mapper.getMapperType()).toBe(32)
        expect(mapper.cartRead(0x8000)).toBe(0)
        expect(mapper.cartRead(0xA000)).toBe(1)
        expect(mapper.cartRead(0xC000)).toBe(6)
        expect(mapper.cartRead(0xE000)).toBe(7)
    })

    it('switches PRG banks in mode 0', () => {
        mapper.cartWrite(0x8000, 2)
        mapper.cartWrite(0xA000, 4)

        expect(mapper.cartRead(0x8000)).toBe(2)
        expect(mapper.cartRead(0xA000)).toBe(4)
        expect(mapper.cartRead(0xC000)).toBe(6)
        expect(mapper.cartRead(0xE000)).toBe(7)
    })

    it('swaps the first and third PRG slots in mode 1', () => {
        mapper.cartWrite(0x8000, 2)
        mapper.cartWrite(0xA000, 4)
        mapper.cartWrite(0x9000, 0x02)

        expect(mapper.cartRead(0x8000)).toBe(6)
        expect(mapper.cartRead(0xA000)).toBe(4)
        expect(mapper.cartRead(0xC000)).toBe(2)
        expect(mapper.cartRead(0xE000)).toBe(7)
    })

    it('switches CHR in 1KB units', () => {
        mapper.cartWrite(0xB003, 5)

        expect(mapper.ppuRead(0x0C00)).toBe(5)
        expect(mapper.ppuRead(0x0FFF)).toBe(5)
    })

    it('updates mirroring through $9000 on normal boards', () => {
        mapper.ppuWrite(0x2000, 0x12)
        expect(mapper.ppuRead(0x2400)).toBe(0x12)

        mapper.cartWrite(0x9000, 0x00)
        mapper.ppuWrite(0x2000, 0x34)
        expect(mapper.ppuRead(0x2800)).toBe(0x34)
    })

    it('keeps Major League in mode 0 with fixed one-screen mirroring', () => {
        const loader = new ROMLoader(createMockROMData(1))
        const majorLeagueMapper = new Mapper32(loader)
        majorLeagueMapper.loadROM()

        majorLeagueMapper.cartWrite(0x8000, 3)
        majorLeagueMapper.cartWrite(0xA000, 4)
        majorLeagueMapper.cartWrite(0x9000, 0x03)

        expect(majorLeagueMapper.cartRead(0x8000)).toBe(3)
        expect(majorLeagueMapper.cartRead(0xC000)).toBe(6)

        majorLeagueMapper.ppuWrite(0x2400, 0x56)
        expect(majorLeagueMapper.ppuRead(0x2000)).toBe(0x56)
        expect(majorLeagueMapper.ppuRead(0x2800)).toBe(0x56)
        expect(majorLeagueMapper.ppuRead(0x2C00)).toBe(0x56)
    })
})
