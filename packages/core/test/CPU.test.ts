/*
 * CPU 测试
 * 验证 NES 6502 CPU 基本功能
 */

import { beforeEach, describe, expect, it } from 'vitest'
import NromMapper from '../src/core/mappers/MapperList/NromMapper'
import { CPU } from '../src/core/CPU'
import { CPURAM } from '../src/core/CPURAM'
import { ROMLoader } from '../src/core/ROMLoader'
import { PPU } from '../src/core/PPU'

describe('CPU', () => {
    let cpu: CPU
    let cpuRam: CPURAM
    let mapper: NromMapper
    let loader: ROMLoader
    let ppu: PPU

    // 辅助函数：运行 CPU 直到指令完成
    function runUntilPCChange(maxCycles: number = 10): void {
        const startPC = cpu.PC
        for (let i = 0; i < maxCycles; i++) {
            cpu.runcycle()
            if (cpu.PC !== startPC) break
        }
        
        // 确保延迟的写入（如 Battletoads hack）也被执行
        // 对于存储指令，需要额外的周期来完成延迟写入
        const cpuAny = cpu as any
        if (cpuAny.dirtyBattletoadsHack) {

            // 模拟下一条指令的第一个周期（cycles=1）
            cpuAny.cycles = 1
            cpu.runcycle()
        }
    }

    beforeEach(() => {

        // 创建基本的测试 ROM
        const rom = new Uint8Array(0x8000 + 16)
        
        // NES 头部
        rom[0] = 0x4E // 'N'
        rom[1] = 0x45 // 'E'
        rom[2] = 0x53 // 'S'
        rom[3] = 0x1A // EOF
        rom[4] = 2 // 2 x 16KB PRG ROM
        rom[5] = 1 // 1 x 8KB CHR ROM
        rom[6] = 0x00 // Mapper 0 (NROM)
        rom[7] = 0x00

        // 设置重置向量
        const resetVectorAddr = 16 + 0x7FFC
        rom[resetVectorAddr] = 0x00
        rom[resetVectorAddr + 1] = 0x80

        // 初始化组件
        loader = new ROMLoader(rom)
        loader.parseHeader()
        
        mapper = new NromMapper(loader)
        mapper.loadROM()
        
        // 创建 PPU 和 CPURAM
        ppu = new PPU(mapper)
        cpuRam = new CPURAM(mapper)
        cpuRam.setPPU(ppu)
        
        cpu = new CPU(cpuRam)
        cpu.init()
    })

    it('初始化后应该设置正确的重置向量', () => {
        expect(cpu.PC).toBe(0x8000)
        expect(cpu.getA()).toBe(0)
        expect(cpu.getX()).toBe(0)
        expect(cpu.getY()).toBe(0)
        expect(cpu.getS()).toBe(0xFD)
    })

    it('应该正确执行 LDA 立即寻址', () => {

        // 在 $0200 处放置 LDA #$42 (使用RAM区域而不是ROM区域)
        cpuRam.write(0x0200, 0xA9) // LDA 立即
        cpuRam.write(0x0201, 0x42) // 操作数
        cpuRam.write(0x0202, 0xEA) // NOP (防止执行到未定义区域)

        cpu.setPC(0x0200)
        
        // 确保 CPU 状态正确
        cpu.interrupt = 0
        cpu.idle = false
        cpu.nmiNext = false
        
        // 运行直到PC改变 (指令完成)
        runUntilPCChange()

        expect(cpu.getA()).toBe(0x42)
    })

    it('应该正确执行寄存器传输指令', () => {

        // 设置 A = 0x55
        cpu.setA(0x55)
        
        // 在 $0200 处放置 TAX (Transfer A to X)
        cpuRam.write(0x0200, 0xAA)

        cpu.setPC(0x0200)
        runUntilPCChange()

        expect(cpu.getX()).toBe(0x55)
        expect(cpu.getA()).toBe(0x55) // A 应该保持不变
    })

    it('应该正确执行 STA 绝对寻址', () => {

        // 设置 A = 0x33
        cpu.setA(0x33)
        
        // 在 $0200 处放置 STA $0300
        cpuRam.write(0x0200, 0x8D) // STA 绝对
        cpuRam.write(0x0201, 0x00) // 地址低字节
        cpuRam.write(0x0202, 0x03) // 地址高字节

        cpu.setPC(0x0200)
        runUntilPCChange()

        expect(cpuRam.read(0x0300)).toBe(0x33)
    })

    it('应该正确设置零标志', () => {

        // 在 $0200 处放置 LDA #$00
        cpuRam.write(0x0200, 0xA9) // LDA 立即
        cpuRam.write(0x0201, 0x00) // 操作数 0

        cpu.setPC(0x0200)
        runUntilPCChange()

        expect(cpu.getA()).toBe(0)

        // 检查状态字符串中是否包含零标志
        const status = cpu.getStatus()
        expect(status).toContain('P:26') // 零标志设置时的状态值
    })

    it('应该正确执行 INX 指令', () => {

        // 设置 X = 0xFE
        cpu.setX(0xFE)
        
        // 在 $0200 处放置 INX
        cpuRam.write(0x0200, 0xE8)

        cpu.setPC(0x0200)
        runUntilPCChange()

        expect(cpu.getX()).toBe(0xFF)
        
        // 再执行一次，测试溢出
        cpu.setPC(0x0200)
        runUntilPCChange()

        expect(cpu.getX()).toBe(0x00) // 应该溢出到 0
    })

    it('应该正确执行跳转指令', () => {

        // 在 $0200 处放置 JMP $0300
        cpuRam.write(0x0200, 0x4C) // JMP 绝对
        cpuRam.write(0x0201, 0x00) // 地址低字节
        cpuRam.write(0x0202, 0x03) // 地址高字节

        cpu.setPC(0x0200)
        runUntilPCChange()

        expect(cpu.PC).toBe(0x0300)
    })
})
