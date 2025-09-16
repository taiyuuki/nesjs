import { describe, expect, it } from 'vitest'
import { ROMLoader } from '../src/core/ROMLoader'
import { getMapper } from '../src/core/mappers/MapperFactory'

describe('MMC6 Mapper Tests', () => {
    it('should create MMC6 mapper for mapper 4 submapper 1', async() => {

        // 创建一个模拟的MMC6 ROM头部数据
        const mockRomData = new Uint8Array(16 + 32768 + 8192) // header + prg + chr
        
        // NES header
        mockRomData[0] = 0x4E // 'N'
        mockRomData[1] = 0x45 // 'E'
        mockRomData[2] = 0x53 // 'S'
        mockRomData[3] = 0x1A // '\x1a'
        mockRomData[4] = 2 // PRG ROM size (2 * 16KB = 32KB)
        mockRomData[5] = 1 // CHR ROM size (1 * 8KB = 8KB)
        mockRomData[6] = 0x40 // Mapper 4 lower nibble, vertical mirroring
        mockRomData[7] = 0x08 // Mapper 4 upper nibble + NES 2.0 identifier (bits 2-3 = 10)
        mockRomData[8] = 0x10 // Submapper 1 (MMC6) in upper nibble
        
        const loader = new ROMLoader(mockRomData)
        loader.parseHeader()
        
        const mapper = await getMapper(loader)
        
        // 验证创建的是MMC6Mapper
        expect(mapper.constructor.name).toBe('MMC6Mapper')
        expect(loader.mappertype).toBe(4)
        expect(loader.submapper).toBe(1)
    })

    it('should create MMC3 mapper for mapper 4 submapper 0', async() => {

        // 创建一个模拟的MMC3 ROM头部数据
        const mockRomData = new Uint8Array(16 + 32768 + 8192) // header + prg + chr
        
        // NES header
        mockRomData[0] = 0x4E // 'N'
        mockRomData[1] = 0x45 // 'E'
        mockRomData[2] = 0x53 // 'S'
        mockRomData[3] = 0x1A // '\x1a'
        mockRomData[4] = 2 // PRG ROM size (2 * 16KB = 32KB)
        mockRomData[5] = 1 // CHR ROM size (1 * 8KB = 8KB)
        mockRomData[6] = 0x40 // Mapper 4 lower nibble, vertical mirroring
        mockRomData[7] = 0x08 // Mapper 4 upper nibble + NES 2.0 identifier (bits 2-3 = 10)
        mockRomData[8] = 0x00 // Submapper 0 (MMC3) in upper nibble
        
        const loader = new ROMLoader(mockRomData)
        loader.parseHeader()
        
        const mapper = await getMapper(loader)
        
        // 验证创建的是MMC3Mapper
        expect(mapper.constructor.name).toBe('MMC3Mapper')
        expect(loader.mappertype).toBe(4)
        expect(loader.submapper).toBe(0)
    })

    it('should handle MMC6 internal RAM protection', async() => {

        // 创建MMC6实例
        const mockRomData = new Uint8Array(16 + 32768 + 8192)
        
        // NES header for MMC6
        mockRomData[0] = 0x4E
        mockRomData[1] = 0x45
        mockRomData[2] = 0x53
        mockRomData[3] = 0x1A
        mockRomData[4] = 2
        mockRomData[5] = 1
        mockRomData[6] = 0x40
        mockRomData[7] = 0x08 // NES 2.0 identifier
        mockRomData[8] = 0x10 // Submapper 1 (MMC6)
        
        const loader = new ROMLoader(mockRomData)
        loader.parseHeader()
        
        const mapper = await getMapper(loader)
        mapper.loadROM()
        
        // 1. 启用PRG RAM ($8000 bit 5 = 1)
        mapper.cartWrite(0x8000, 0x20) // 0010 0000 - enable PRG RAM
        
        // 2. 设置保护寄存器 - 启用第一个银行的读写 ($A001)
        mapper.cartWrite(0xA001, 0x30) // 0011 0000 - enable read+write for first bank
        
        // 3. 测试写入和读取第一个银行 ($7000-$71FF)
        mapper.cartWrite(0x7000, 0xAB)
        expect(mapper.cartRead(0x7000)).toBe(0xAB)
        
        // 4. 测试第二个银行被保护（无法访问）
        mapper.cartWrite(0x7200, 0xCD)
        const result = mapper.cartRead(0x7200)
        expect(result).toBe(0) // 应该返回0，因为另一个银行可读但这个不可读
        
        // 5. 启用第二个银行
        mapper.cartWrite(0xA001, 0xF0) // 1111 0000 - enable read+write for second bank
        mapper.cartWrite(0x7200, 0xCD)
        expect(mapper.cartRead(0x7200)).toBe(0xCD)
    })
})
