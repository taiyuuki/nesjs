/*
 * UNROM Mapper (Mapper         for (let i = 0; i < 0x4000; i++) {
            data[bankStart + i] = bank << 4 | i & 0x0F
        }测试
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { ROMLoader } from '../src/core/ROMLoader'
import UnromMapper from '../src/core/mappers/MapperList/UnromMapper'

// 创建模拟ROM数据
function createMockROMData(): number[] {
    const prgSize = 128 * 1024 // 128KB PRG ROM (8个16KB banks)
    const chrSize = 0 // 0 表示使用 CHR RAM
    const totalSize = 0x10 + prgSize + chrSize
    const data = new Array(totalSize).fill(0)
    
    // 设置iNES头部
    data[0] = 0x4E // 'N'
    data[1] = 0x45 // 'E'
    data[2] = 0x53 // 'S'
    data[3] = 0x1A // EOF
    data[4] = prgSize / 16384 // PRG ROM size in 16KB units
    data[5] = chrSize / 8192 // CHR ROM size in 8KB units (0 for CHR RAM)
    data[6] = (2 & 0x0F) << 4 | 0 // Mapper 2, 水平镜像
    data[7] = 2 & 0xF0 // Mapper高4位
    
    // 填充PRG ROM - 每个bank有不同的数据模式
    for (let bank = 0; bank < 8; bank++) {
        const bankStart = 0x10 + bank * 16384
        for (let i = 0; i < 16384; i++) {
            data[bankStart + i] = bank << 4 | i & 0x0F
        }
    }
    
    // 不需要填充CHR数据，因为使用CHR RAM
    
    return data
}

describe('UnromMapper (Mapper 2)', () => {
    let mapper: UnromMapper
    let loader: ROMLoader

    beforeEach(() => {
        const romData = createMockROMData()
        loader = new ROMLoader(new Uint8Array(romData))
        mapper = new UnromMapper(loader)
        mapper.loadROM()
    })

    it('应该正确初始化', () => {
        expect(mapper.getMapperType()).toBe(2)
        expect(mapper.getPRGSize()).toBe(128 * 1024)
        expect(mapper.getCHRSize()).toBe(8 * 1024)
    })

    it('应该正确设置初始bank映射', () => {

        // 第一个bank (0x8000-0xBFFF) 应该映射到bank 0
        const firstBankData = mapper.cartRead(0x8000)
        expect(firstBankData).toBe(0x00) // bank 0的特征数据
        
        // 最后一个bank (0xC000-0xFFFF) 应该映射到最后一个bank (bank 7)
        const lastBankData = mapper.cartRead(0xC000)
        expect(lastBankData).toBe(0x70) // bank 7的特征数据
    })

    it('应该正确处理bank切换', () => {

        // 切换到bank 1
        mapper.cartWrite(0x8000, 0x01)
        
        // 检查第一个bank现在是否为bank 1
        const bankData = mapper.cartRead(0x8000)
        expect(bankData).toBe(0x10) // bank 1的特征数据
        
        // 最后一个bank应该保持不变 (仍然是bank 7)
        const lastBankData = mapper.cartRead(0xC000)
        expect(lastBankData).toBe(0x70) // bank 7的特征数据
    })

    it('应该正确处理多个bank切换', () => {

        // 测试切换到不同的banks
        for (let bank = 0; bank < 8; bank++) {
            mapper.cartWrite(0x9000, bank) // 任意地址都可以触发切换
            
            const bankData = mapper.cartRead(0x8000)
            expect(bankData).toBe(bank << 4) // 每个bank的特征数据
        }
    })

    it('应该只使用数据的低4位进行bank切换', () => {

        // 写入一个大于15的值，应该只使用低4位
        mapper.cartWrite(0x8000, 0x15) // 0x15 & 0x0F = 0x05
        
        const bankData = mapper.cartRead(0x8000)
        expect(bankData).toBe(0x50) // bank 5的特征数据
    })

    it('应该正确处理PRG RAM写入', () => {
        const testValue = 0x42
        mapper.cartWrite(0x6000, testValue)
        
        const readValue = mapper.cartRead(0x6000)
        expect(readValue).toBe(testValue)
    })

    it('应该正确读取不同地址范围', () => {

        // 测试0x8000-0xBFFF范围 (可切换bank)
        mapper.cartWrite(0x8000, 0x02)
        expect(mapper.cartRead(0x8000)).toBe(0x20) // bank 2开始
        expect(mapper.cartRead(0xBFFF)).toBe(0x2F) // bank 2结束
        
        // 测试0xC000-0xFFFF范围 (固定最后一个bank)
        expect(mapper.cartRead(0xC000)).toBe(0x70) // bank 7开始
        expect(mapper.cartRead(0xFFFF)).toBe(0x7F) // bank 7结束
    })

    it('应该正确处理CHR数据访问', () => {

        // CHR通常是RAM，应该可以读写
        const testValue = 0x55
        mapper.ppuWrite(0x1000, testValue)
        
        const readValue = mapper.ppuRead(0x1000)
        expect(readValue).toBe(testValue)
    })

    it('应该正确处理开放总线读取', () => {

        // 读取无效地址应该返回开放总线值
        const openBusValue = mapper.cartRead(0x5000)
        expect(openBusValue).toBe(0x5000 >> 8) // 0x50
    })

    it('应该保持最后一个bank固定', () => {

        // 无论如何切换，最后一个bank都应该保持为bank 7
        for (let bank = 0; bank < 8; bank++) {
            mapper.cartWrite(0x8000, bank)
            
            const lastBankData = mapper.cartRead(0xC000)
            expect(lastBankData).toBe(0x70) // 始终是bank 7
        }
    })
})
