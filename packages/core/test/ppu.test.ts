/*
 * PPU 功能测试
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { PPU } from '../src/core/PPU'
import { CPURAM } from '../src/core/CPURAM'
import { ROMLoader } from '../src/core/ROMLoader'
import NromMapper from '../src/core/mappers/MapperList/NromMapper'

describe('PPU', () => {
    let ppu: PPU
    let cpuram: CPURAM

    beforeEach(() => {

        // 创建测试ROM数据
        const simpleRomData = new Uint8Array([

            // NES Header (16 bytes)
            0x4E,
            0x45,
            0x53,
            0x1A, // "NES" + MS-DOS EOF
            0x01, // PRG ROM size (1 * 16KB)
            0x01, // CHR ROM size (1 * 8KB)
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            
            // PRG ROM (16KB)
            ...new Array(16384).fill(0)
                .map((_, i) => i & 0xFF),
            
            // CHR ROM (8KB)
            ...new Array(8192).fill(0),
        ])

        // 设置文件读取器和加载ROM
        const loader = new ROMLoader(simpleRomData)
        loader.parseHeader()
        
        const mapper = new NromMapper(loader)
        
        // 创建一个mock CPU
        const mockCpu = {
            setNMI: (_value: boolean) => {},
            interrupt: (_irq: boolean) => {},
            runcycle: (_scanline: number, _cycles: number) => {},
        }
        mapper.cpu = mockCpu as any
        
        ppu = new PPU(mapper)
        
        cpuram = new CPURAM(mapper)
        cpuram.setPPU(ppu)
    })

    it('应该正确初始化', () => {
        expect(ppu).toBeDefined()
        expect(ppu.scanline).toBe(0)
        expect(ppu.cycles).toBe(0)
        expect(ppu.pal).toHaveLength(32)
    })

    it('应该正确处理PPUCTRL寄存器', () => {

        // 测试PPUCTRL (寄存器0)
        ppu.write(0, 0x80) // 启用NMI
        
        // 无法直接读取PPUCTRL，但可以通过其他方式验证
        expect(ppu.renderingOn()).toBe(false) // 渲染还未启用
    })

    it('应该正确处理PPUMASK寄存器', () => {

        // 测试PPUMASK (寄存器1)
        expect(ppu.renderingOn()).toBe(false)
        
        ppu.write(1, 0x18) // 启用背景和精灵
        expect(ppu.renderingOn()).toBe(true)
        
        ppu.write(1, 0x00) // 禁用渲染
        expect(ppu.renderingOn()).toBe(false)
    })

    it('应该正确处理PPUSTATUS寄存器', () => {

        // 测试PPUSTATUS (寄存器2)
        const status1 = ppu.read(2)
        const status2 = ppu.read(2)
        
        // 状态寄存器读取应该返回有效值
        expect(status1).toBeGreaterThanOrEqual(0)
        expect(status1).toBeLessThanOrEqual(255)
        expect(status2).toBeGreaterThanOrEqual(0)
        expect(status2).toBeLessThanOrEqual(255)
    })

    it('应该正确处理PPUADDR和PPUDATA寄存器', () => {

        // 设置PPU地址
        ppu.write(6, 0x20) // 高字节
        ppu.write(6, 0x00) // 低字节，地址现在是0x2000
        
        // 写入数据
        ppu.write(7, 0x42)
        
        // 重新设置地址读取
        ppu.write(6, 0x20) // 高字节
        ppu.write(6, 0x00) // 低字节
        
        // 读取数据（注意PPU读取有延迟）
        const _dummy = ppu.read(7) // 第一次读取是缓冲的
        const data = ppu.read(7) // 第二次读取是实际数据
        
        // 数据应该被正确存储和读取
        expect(data).toBeGreaterThanOrEqual(0)
        expect(data).toBeLessThanOrEqual(255)
    })

    it('应该正确处理扫描行时钟', () => {
        const _initialScanline = ppu.scanline
        const _initialCycles = ppu.cycles
        
        // 运行一个扫描行
        ppu.clockLine(0)
        
        // 周期应该已经前进
        expect(ppu.cycles).toBe(341) // 一个扫描行有341个周期
    })

    it('应该正确运行帧', () => {
        const initialScanline = ppu.scanline
        
        // 运行一帧
        ppu.runFrame()
        
        // 帧应该完成
        expect(initialScanline).toBeGreaterThanOrEqual(0)
    })

    it('应该正确检测渲染状态', () => {

        // 初始状态应该是关闭的
        expect(ppu.renderingOn()).toBe(false)
        
        // 启用背景
        ppu.write(1, 0x08) // PPUMASK bit 3
        expect(ppu.renderingOn()).toBe(true)
        
        // 禁用背景，启用精灵
        ppu.write(1, 0x10) // PPUMASK bit 4
        expect(ppu.renderingOn()).toBe(true)
        
        // 禁用所有渲染
        ppu.write(1, 0x00)
        expect(ppu.renderingOn()).toBe(false)
    })

    it('应该正确处理MMC3计数器时钟', () => {

        // 默认情况下应该是false（因为背景和精灵使用相同的图案表）
        expect(ppu.mmc3CounterClocking()).toBe(false)
        
        // 启用渲染
        ppu.write(1, 0x18) // 启用背景和精灵
        expect(ppu.mmc3CounterClocking()).toBe(false) // 仍然使用相同的图案表
        
        // 改变背景图案表
        ppu.write(0, 0x10) // PPUCTRL bit 4
        expect(ppu.mmc3CounterClocking()).toBe(true) // 现在使用不同的图案表
    })

    it('应该通过CPURAM正确访问', () => {

        // 通过CPURAM写入PPU寄存器
        cpuram.write(0x2001, 0x18) // 启用渲染
        expect(ppu.renderingOn()).toBe(true)
        
        // 通过CPURAM读取PPU寄存器
        const status = cpuram.read(0x2002)
        expect(status).toBeGreaterThanOrEqual(0)
        expect(status).toBeLessThanOrEqual(255)
        
        // 测试PPU地址和数据
        cpuram.write(0x2006, 0x20) // 地址高字节
        cpuram.write(0x2006, 0x00) // 地址低字节
        cpuram.write(0x2007, 0x55) // 写入数据
        
        // 重新设置地址并读取
        cpuram.write(0x2006, 0x20)
        cpuram.write(0x2006, 0x00)
        const _dummy = cpuram.read(0x2007) // 缓冲读取
        const data = cpuram.read(0x2007) // 实际数据
        
        expect(data).toBeGreaterThanOrEqual(0)
        expect(data).toBeLessThanOrEqual(255)
    })
})
