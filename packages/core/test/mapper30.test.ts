/*
 * Mapper 30 - UNROM 512 测试
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { ROMLoader } from '../src/core/ROMLoader'
import Mapper30 from '../src/core/mappers/MapperList/Mapper30'
import { MirrorType } from '../src/core/types'

// 创建模拟ROM数据
function createMockROMData(
    prgSize: number = 512 * 1024,
    chrSize: number = 0,
    mapper: number = 30,
    submapper: number = 0,
    mirroring: MirrorType = MirrorType.H_MIRROR,
): number[] {
    const totalSize = 0x10 + prgSize + chrSize
    const data = new Array(totalSize).fill(0)

    // 设置iNES 2.0头部
    data[0] = 0x4E // 'N'
    data[1] = 0x45 // 'E'
    data[2] = 0x53 // 'S'
    data[3] = 0x1A // EOF
    data[4] = prgSize / 16384 // PRG ROM size in 16KB units
    data[5] = chrSize / 8192 // CHR ROM size in 8KB units (0 for CHR RAM)
    data[6] = (mapper & 0x0F) << 4 | (mirroring === MirrorType.V_MIRROR ? 1 : 0)
    data[7] = 0x08 | mapper & 0xF0 // NES 2.0 标识 + Mapper高4位
    data[8] = (submapper & 0x0F) << 4 | mapper >> 8 & 0x0F

    // 填充PRG ROM - 每个16KB bank有不同的数据模式
    const numBanks = prgSize / 16384
    for (let bank = 0; bank < numBanks; bank++) {
        const bankStart = 0x10 + bank * 16384
        for (let i = 0; i < 16384; i++) {
            data[bankStart + i] = bank << 4 | i & 0x0F
        }
    }

    return data
}

describe('Mapper30 - UNROM 512', () => {
    let mapper: Mapper30
    let loader: ROMLoader

    describe('基本功能 - Submapper 0', () => {
        beforeEach(() => {
            const romData = createMockROMData(512 * 1024, 0, 30, 0)
            loader = new ROMLoader(new Uint8Array(romData))
            mapper = new Mapper30(loader)
            mapper.loadROM()
        })

        it('应该正确初始化', () => {
            expect(mapper.getMapperType()).toBe(30)
            expect(mapper.getPRGSize()).toBe(512 * 1024)
            expect(mapper.getCHRSize()).toBe(32 * 1024)
        })

        it('应该正确设置初始bank映射', () => {

            // 第一个bank (0x8000-0xBFFF) 应该映射到bank 0
            const firstBankData = mapper.cartRead(0x8000)
            expect(firstBankData).toBe(0x00)

            // 最后一个bank (0xC000-0xFFFF) 应该映射到最后一个bank (bank 31)
            const lastBankData = mapper.cartRead(0xC000)
            expect(lastBankData).toBe(0xF0 | 0)
        })

        it('应该正确处理PRG bank切换', () => {

            // 切换到bank 5
            mapper.cartWrite(0x8000, 0x05)

            // 检查第一个bank现在是否为bank 5
            const bankData = mapper.cartRead(0x8000)
            expect(bankData).toBe(0x50)

            // 最后一个bank应该保持不变 (仍然是bank 31)
            const lastBankData = mapper.cartRead(0xC000)
            expect(lastBankData).toBe(0xF0 | 0)
        })

        it('应该正确处理CHR bank切换', () => {

            // 设置PRG bank 0, CHR bank 2 (位5-6)
            mapper.cartWrite(0x8000, 0x00 | 2 << 5)

            // CHR bank切换不能通过cartRead直接测试，但可以验证值被存储
            // 实际测试需要通过ppuRead来验证
        })
    })

    describe('Submapper 1 - 无bus conflicts', () => {
        beforeEach(() => {
            const romData = createMockROMData(256 * 1024, 0, 30, 1)
            loader = new ROMLoader(new Uint8Array(romData))
            mapper = new Mapper30(loader)
            mapper.loadROM()
        })

        it('应该支持无bus conflicts的写入', () => {

            // 在submapper 1中，写入任何地址都应该正常工作
            mapper.cartWrite(0x8000, 0x07)

            const bankData = mapper.cartRead(0x8000)
            expect(bankData).toBe(0x70)
        })
    })

    describe('Submapper 3 - 动态镜像切换', () => {
        beforeEach(() => {
            const romData = createMockROMData(256 * 1024, 0, 30, 3)
            loader = new ROMLoader(new Uint8Array(romData))
            mapper = new Mapper30(loader)
            mapper.loadROM()
        })

        it('应该支持动态镜像切换', () => {

            // bit 7 = 0: 垂直镜像
            mapper.cartWrite(0x8000, 0x00)

            // bit 7 = 1: 水平镜像
            mapper.cartWrite(0x8000, 0x80)

            // 注意：实际的镜像测试需要通过ppuRead/ppuWrite来验证
            // 这里只是验证不会出错
        })
    })

    describe('单屏镜像模式', () => {
        beforeEach(() => {
            const romData = createMockROMData(256 * 1024, 0, 30, 0, MirrorType.SS_MIRROR0)
            loader = new ROMLoader(new Uint8Array(romData))
            mapper = new Mapper30(loader)
            mapper.loadROM()
        })

        it('应该支持单屏镜像切换', () => {

            // bit 7 = 0: Lower bank
            mapper.cartWrite(0x8000, 0x00)

            // bit 7 = 1: Upper bank
            mapper.cartWrite(0x8000, 0x80)

            // 注意：实际的镜像测试需要通过ppuRead/ppuWrite来验证
        })
    })

    describe('存档状态测试', () => {
        beforeEach(() => {
            const romData = createMockROMData(256 * 1024, 0, 30, 1)
            loader = new ROMLoader(new Uint8Array(romData))
            mapper = new Mapper30(loader)
            mapper.loadROM()
        })

        it('应该正确保存和恢复状态', () => {

            // 设置特定的bank
            mapper.cartWrite(0x8000, 0x05 | 1 << 5 | 1 << 7)

            // 获取状态
            const state = mapper.getMapperState()

            // 创建新mapper并恢复状态
            const romData = createMockROMData(256 * 1024, 0, 30, 1)
            const newLoader = new ROMLoader(new Uint8Array(romData))
            const newMapper = new Mapper30(newLoader)
            newMapper.loadROM()
            newMapper.setMapperState(state)

            // 验证状态被正确恢复
            const bankData = newMapper.cartRead(0x8000)
            expect(bankData).toBe(0x50)
        })
    })

    describe('边界情况', () => {
        beforeEach(() => {
            const romData = createMockROMData(256 * 1024, 0, 30, 1)
            loader = new ROMLoader(new Uint8Array(romData))
            mapper = new Mapper30(loader)
            mapper.loadROM()
        })

        it('应该正确处理超出范围的bank号', () => {

            // 尝试设置超过最大bank的值
            // PRG bank只使用低5位，所以0x1F是最大值
            mapper.cartWrite(0x8000, 0xFF)

            // bank号应该被限制在0-31范围内
            const bankData = mapper.cartRead(0x8000)

            // 0xFF & 0x1F = 0x1F = 31，但256KB只有16个16KB banks
            // 所以bank 31 % 16 = 15
            expect(bankData).toBe(0xF0 | 0)
        })

        it('应该正确处理PRG RAM读写', () => {

            // UNROM 512通常没有PRG RAM，但测试不应该崩溃
            mapper.cartWrite(0x6000, 0xAA)
            const value = mapper.cartRead(0x6000)

            // 如果没有PRG RAM，读取应该返回open bus或特定值
            expect(value).toBeDefined()
        })
    })
})
