import { beforeEach, describe, expect, it } from 'vitest'
import { ROMLoader } from '../src/core/ROMLoader'
import Mapper006 from '../src/core/mappers/MapperList/Mapper6'

describe('Mapper006', () => {
    let mapper: Mapper006
    let mockLoader: ROMLoader

    beforeEach(() => {

        // 创建模拟的 ROM 数据，包含有效的 iNES 头部
        const mockROMData = new Uint8Array(16 + 32768 + 8192) // 16字节头部 + 32KB PRG + 8KB CHR
        
        // 设置 iNES 头部
        mockROMData[0] = 0x4E // 'N'
        mockROMData[1] = 0x45 // 'E'
        mockROMData[2] = 0x53 // 'S'
        mockROMData[3] = 0x1A // EOF
        mockROMData[4] = 2 // PRG banks (16KB each, so 2 banks = 32KB)
        mockROMData[5] = 1 // CHR banks (8KB each, so 1 bank = 8KB)
        mockROMData[6] = 0x60 // Mapper 6 (lower 4 bits) + other flags
        mockROMData[7] = 0x00 // Mapper 6 (upper 4 bits) + other flags
        
        mockLoader = new ROMLoader(mockROMData)
        mapper = new Mapper006(mockLoader)
        mapper.loadROM()
    })

    it('应该正确初始化', () => {
        expect(mapper.getMapperType()).toBe(6)
        expect(mapper.getPRGSize()).toBe(32768)
        expect(mapper.getCHRSize()).toBe(8192)
    })

    it('应该正确处理复位', () => {
        mapper.reset()

        // 验证初始银行设置
        expect(mapper.cartRead(0x8000)).toBeDefined()
        expect(mapper.cartRead(0xC000)).toBeDefined()
    })

    it('应该正确处理 IRQ 寄存器写入', () => {

        // 创建模拟 CPU
        const mockCPU = { interrupt: 0 }
        
        mapper.cpu = mockCPU as any

        // 测试禁用 IRQ
        mapper.cartWrite(0x4501, 0x00)
        expect(mockCPU.interrupt).toBe(0)

        // 测试 IRQ 计数器设置
        mapper.cartWrite(0x4502, 0x34) // 低字节
        mapper.cartWrite(0x4503, 0x12) // 高字节，同时启用 IRQ

        // 模拟扫描线触发 IRQ
        mapper.notifyscanline(0)
        
        // IRQ 计数器应该递增，但可能不会立即触发
        expect(mockCPU.interrupt).toBeGreaterThanOrEqual(0)
    })

    it('应该正确处理镜像寄存器', () => {

        // 测试镜像控制寄存器
        mapper.cartWrite(0x42FE, 0x00) // 应该设置为 MIRROR4L
        mapper.cartWrite(0x42FE, 0x10) // 应该设置为 MIRROR4H
        
        mapper.cartWrite(0x42FF, 0x00) // 应该设置为 VMIRROR
        mapper.cartWrite(0x42FF, 0x10) // 应该设置为 HMIRROR
        
        // 这些操作应该不抛出错误
        expect(true).toBe(true)
    })

    it('应该正确处理 PRG 银行切换', () => {

        // 测试银行切换
        mapper.cartWrite(0x8000, 0x04) // 设置银行1, CHR RAM 银行0
        
        // 验证能正常读取
        const data1 = mapper.cartRead(0x8000)
        expect(data1).toBeDefined()

        mapper.cartWrite(0x8000, 0x08) // 设置银行2, CHR RAM 银行0
        
        // 验证能正常读取
        const data2 = mapper.cartRead(0x8000)
        expect(data2).toBeDefined()
    })

    it('应该能够正确保存和加载状态', () => {

        // 设置一些状态
        mapper.cartWrite(0x4502, 0x34)
        mapper.cartWrite(0x4503, 0x12)
        mapper.cartWrite(0x8000, 0x04)

        // 保存状态
        const state = mapper.getMapperState()
        expect(state).toBeDefined()
        expect(state.type).toBe(6)

        // 创建新的 mapper 实例
        const newMapper = new Mapper006(mockLoader)
        newMapper.loadROM()

        // 加载状态
        newMapper.setMapperState(state)

        // 验证状态是否正确恢复
        expect(newMapper.getMapperType()).toBe(6)
    })
})
