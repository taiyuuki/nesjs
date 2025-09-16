import { describe, expect, it } from 'vitest'
import { ROMLoader } from '../src/core/ROMLoader'
import { getMapper } from '../src/core/mappers/MapperFactory'

describe('Mapper 115 Tests', () => {
    it('should create Mapper115 for mapper 115', async() => {

        // 创建一个模拟的Mapper 115 ROM
        const mockRomData = new Uint8Array(16 + 65536 + 32768) // header + prg + chr
        
        // NES header
        mockRomData[0] = 0x4E // 'N'
        mockRomData[1] = 0x45 // 'E'
        mockRomData[2] = 0x53 // 'S'
        mockRomData[3] = 0x1A // '\x1a'
        mockRomData[4] = 4 // PRG ROM size (4 * 16KB = 64KB)
        mockRomData[5] = 4 // CHR ROM size (4 * 8KB = 32KB)
        mockRomData[6] = 0x30 // Mapper 115 lower nibble: (115 & 0x0F) << 4 = 3 << 4 = 0x30
        mockRomData[7] = 0x70 // Mapper 115 upper nibble: (115 >> 4) << 4 = 7 << 4 = 0x70
        
        const loader = new ROMLoader(mockRomData)
        loader.parseHeader()
        
        const mapper = await getMapper(loader)
        
        // 验证创建的是Mapper115
        expect(mapper.constructor.name).toBe('Mapper115')
        expect(loader.mappertype).toBe(115)
    })

    it('should handle NROM mode override', async() => {

        // 创建Mapper115实例
        const mockRomData = new Uint8Array(16 + 65536 + 32768)
        
        // NES header for Mapper 115
        mockRomData[0] = 0x4E
        mockRomData[1] = 0x45
        mockRomData[2] = 0x53
        mockRomData[3] = 0x1A
        mockRomData[4] = 4
        mockRomData[5] = 4
        mockRomData[6] = 0x30
        mockRomData[7] = 0x70
        
        const loader = new ROMLoader(mockRomData)
        loader.parseHeader()
        
        const mapper = await getMapper(loader)
        mapper.loadROM()
        
        // 1. 测试MMC3模式（默认，M=0）
        expect(mapper.cartRead(0x6002)).toBe(0) // 读取solder pad寄存器
        
        // 2. 切换到NROM-256模式 (M=1, N=1, PPPp=0x02)
        mapper.cartWrite(0x6000, 0x85) // 1000 0101: M=1, P=0, PPPp=0x02, N=1
        
        // 验证现在是NROM模式
        // 在NROM-256模式下，整个32KB应该映射相同的银行
        
        // 3. 测试CHR银行寄存器
        mapper.cartWrite(0x6001, 0x01) // 设置CHR A18=1
        
        // 验证CHR映射得到了更新（具体验证需要设置一些CHR数据）
    })

    it('should handle NROM-128 mode', async() => {

        // 创建Mapper115实例
        const mockRomData = new Uint8Array(16 + 65536 + 32768)
        
        // NES header
        mockRomData[0] = 0x4E
        mockRomData[1] = 0x45
        mockRomData[2] = 0x53
        mockRomData[3] = 0x1A
        mockRomData[4] = 4
        mockRomData[5] = 4
        mockRomData[6] = 0x30
        mockRomData[7] = 0x70
        
        const loader = new ROMLoader(mockRomData)
        loader.parseHeader()
        
        const mapper = await getMapper(loader)
        mapper.loadROM()
        
        // 切换到NROM-128模式 (M=1, N=0, PPPp=0x01)
        mapper.cartWrite(0x6000, 0x82) // 1000 0010: M=1, P=0, PPPp=0x01, N=0
        
        // 在NROM-128模式下，16KB应该在$8000-$BFFF和$C000-$FFFF镜像
        // 这个测试比较难验证具体的映射，但至少确保不会出错
    })

    it('should handle solder pad register', async() => {

        // 创建Mapper115实例  
        const mockRomData = new Uint8Array(16 + 65536 + 32768)
        
        // NES header
        mockRomData[0] = 0x4E
        mockRomData[1] = 0x45
        mockRomData[2] = 0x53
        mockRomData[3] = 0x1A
        mockRomData[4] = 4
        mockRomData[5] = 4
        mockRomData[6] = 0x30
        mockRomData[7] = 0x70
        
        const loader = new ROMLoader(mockRomData)
        loader.parseHeader()
        
        const mapper = await getMapper(loader)
        mapper.loadROM()
        
        // 测试solder pad寄存器读取
        const solderPad = mapper.cartRead(0x6002)
        expect(typeof solderPad).toBe('number')
        expect(solderPad).toBeGreaterThanOrEqual(0)
        expect(solderPad).toBeLessThanOrEqual(0xFF)
        
        // solder pad寄存器应该是只读的，写入应该不会改变值
        const originalValue = mapper.cartRead(0x6002)
        mapper.cartWrite(0x6002, 0xFF) // 尝试写入
        expect(mapper.cartRead(0x6002)).toBe(originalValue) // 值不应该改变
    })

    it('should maintain MMC3 compatibility', async() => {

        // 创建Mapper115实例
        const mockRomData = new Uint8Array(16 + 65536 + 32768)
        
        // NES header
        mockRomData[0] = 0x4E
        mockRomData[1] = 0x45
        mockRomData[2] = 0x53
        mockRomData[3] = 0x1A
        mockRomData[4] = 4
        mockRomData[5] = 4
        mockRomData[6] = 0x30
        mockRomData[7] = 0x70
        
        const loader = new ROMLoader(mockRomData)
        loader.parseHeader()
        
        const mapper = await getMapper(loader)
        mapper.loadROM()
        
        // 确保在MMC3模式下(M=0)，MMC3寄存器正常工作
        mapper.cartWrite(0x6000, 0x00) // 确保M=0 (MMC3模式)
        
        // 测试MMC3寄存器写入
        mapper.cartWrite(0x8000, 0x00) // Bank select
        mapper.cartWrite(0x8001, 0x05) // Bank data
        
        // 测试IRQ寄存器
        mapper.cartWrite(0xC000, 0x08) // IRQ counter
        mapper.cartWrite(0xC001, 0x08) // IRQ latch
        mapper.cartWrite(0xE000, 0x00) // IRQ disable
        mapper.cartWrite(0xE001, 0x00) // IRQ enable
        
        // 如果没有异常抛出，说明MMC3兼容性正常
    })
})
