/*
 * APU 测试
 * 验证 NES APU 基本功能
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { APU } from '../src/core/APU'
import type { AudioOutputInterface } from '../src/core/interfaces'
import { TVType } from '../src/core/types'

// 测试音频输出接口
class TestAudioOutput implements AudioOutputInterface {
    public samples: number[] = []
    public frameFlushes: number = 0
    public paused: boolean = false
    public destroyed: boolean = false

    public outputSample(sample: number): void {
        this.samples.push(sample)
    }

    public flushFrame(): void {
        this.frameFlushes++
    }

    public destroy(): void {
        this.destroyed = true
        this.samples = []
    }

    public pause(): void {
        this.paused = true
    }

    public resume(): void {
        this.paused = false
    }

    public reset(): void {
        this.samples = []
        this.frameFlushes = 0
        this.paused = false
        this.destroyed = false
    }
}

// 模拟CPU接口
class MockCPU {
    public clocks: number = 0
    public interrupt: number = 0

    public stealcycles(_cycles: number): void {

        // 模拟CPU周期窃取
    }
}

// 模拟CPURAM接口
class MockCPURAM {
    private memory = new Uint8Array(0x10000)
    public mapper = { getTVType: () => TVType.NTSC }

    public read(addr: number): number {
        return this.memory[addr & 0xFFFF]
    }

    public write(addr: number, value: number): void {
        this.memory[addr & 0xFFFF] = value & 0xFF
    }
}

// 模拟控制器
class MockController {
    public strobe(): void {

        // 模拟
    }

    public getbyte(): number {
        return 0x40
    }

    public output(_value: boolean): void {

        // 模拟
    }
}

// 模拟NES系统
class MockNES {
    private controller1 = new MockController()
    private controller2 = new MockController()

    public getController1(): MockController {
        return this.controller1
    }

    public getController2(): MockController {
        return this.controller2
    }
}

describe('APU', () => {
    let apu: APU
    let audioOutput: TestAudioOutput
    let cpu: any
    let cpuram: any
    let nes: any

    beforeEach(() => {
        cpu = new MockCPU()
        cpuram = new MockCPURAM()
        nes = new MockNES()
        apu = new APU(48000, cpu, cpuram, nes)
        audioOutput = new TestAudioOutput()
        apu.setAudioInterface(audioOutput)
    })

    it('应该正确初始化APU', () => {
        expect(apu.samplerate).toBe(48000)
        expect(apu.sprdmaCount).toBe(0)
    })

    it('应该正确读取状态寄存器', () => {

        // 测试状态寄存器读取
        const status = apu.read(0x15)
        expect(status).toBeTypeOf('number')
        expect(status).toBeGreaterThanOrEqual(0)
        expect(status).toBeLessThanOrEqual(255)
    })

    it('应该正确处理控制器读取', () => {
        const controller1 = apu.read(0x16)
        expect(controller1).toBe(0x40)
        
        const controller2 = apu.read(0x17)
        expect(controller2).toBe(0x40)
    })

    it('应该正确处理无效地址读取', () => {
        const result = apu.read(0x18)
        expect(result).toBe(0x40) // open bus
    })

    it('应该正确写入脉冲1通道寄存器', () => {

        // 启用通道
        apu.write(0x15, 0x01)
        
        // 配置脉冲1
        apu.write(0x00, 0x80) // duty cycle + envelope
        apu.write(0x01, 0x08) // sweep
        apu.write(0x02, 0x54) // timer low
        apu.write(0x03, 0x08) // length counter + timer high
        
        // 读取状态应该显示通道1活跃
        const status = apu.read(0x15)
        expect(status & 0x01).toBe(1)
    })

    it('应该正确写入脉冲2通道寄存器', () => {

        // 启用通道
        apu.write(0x15, 0x02)
        
        // 配置脉冲2
        apu.write(0x04, 0x40)
        apu.write(0x05, 0x00)
        apu.write(0x06, 0xA8)
        apu.write(0x07, 0x06)
        
        // 读取状态应该显示通道2活跃
        const status = apu.read(0x15)
        expect(status & 0x02).toBe(2)
    })

    it('应该正确写入三角波通道寄存器', () => {

        // 启用通道
        apu.write(0x15, 0x04)
        
        // 配置三角波
        apu.write(0x08, 0x81)
        apu.write(0x0A, 0x50)
        apu.write(0x0B, 0x04)
        
        // 读取状态应该显示通道3活跃
        const status = apu.read(0x15)
        expect(status & 0x04).toBe(4)
    })

    it('应该正确写入噪声通道寄存器', () => {

        // 启用通道
        apu.write(0x15, 0x08)
        
        // 配置噪声
        apu.write(0x0C, 0x30)
        apu.write(0x0E, 0x04)
        apu.write(0x0F, 0x08)
        
        // 读取状态应该显示通道4活跃
        const status = apu.read(0x15)
        expect(status & 0x08).toBe(8)
    })

    it('应该正确处理DMC寄存器', () => {
        apu.write(0x10, 0x00) // DMC频率和标志
        apu.write(0x11, 0x40) // DMC值
        apu.write(0x12, 0x10) // DMC地址
        apu.write(0x13, 0x08) // DMC长度
        
        // 启用DMC
        apu.write(0x15, 0x10)
        
        // 这些操作不应该引发错误
        expect(() => {
            const status = apu.read(0x15)
            expect(status).toBeTypeOf('number')
        }).not.toThrow()
    })

    it('应该正确处理帧计数器', () => {

        // 设置4步序列
        apu.write(0x17, 0x00)
        
        // 设置5步序列
        apu.write(0x17, 0x80)
        
        // 应该没有错误
        expect(() => {
            apu.updateto(1000)
        }).not.toThrow()
    })

    it('应该生成音频样本', () => {
        audioOutput.reset()
        
        // 启用所有通道
        apu.write(0x15, 0x0F)
        
        // 配置一些基本的声音
        apu.write(0x00, 0x80)
        apu.write(0x02, 0x54)
        apu.write(0x03, 0x08)
        
        // 运行一些周期
        cpu.clocks = 1000
        apu.updateto(1000)
        
        // 应该生成一些音频样本
        expect(audioOutput.samples.length).toBeGreaterThan(0)
    })

    it('应该正确处理Sprite DMA', () => {
        const initialCount = apu.sprdmaCount
        
        // 触发Sprite DMA
        apu.write(0x14, 0x02)
        
        expect(apu.sprdmaCount).toBe(initialCount + 2)
    })
})
