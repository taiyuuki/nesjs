
import type { NES } from './NES'

/**
 * 金手指修改类型枚举
 */
export enum CheatType {

    /** 保持值不变 */
    KEEP = 0,

    /** 只修改一次 */
    ONCE = 1,

    /** 值不大于 */
    NOT_GREATER = 2,

    /** 值不小于 */
    NOT_LESS = 3,
}

/**
 * 金手指数据长度
 */
export enum CheatLength {
    BYTE = 1,
    WORD = 2,
    DWORD = 4,
}

/**
 * 金手指代码结构
 */
export interface CheatCode {

    /** 金手指代码（VirtuaNES格式，如：079F-01-01） */
    code: string

    /** 是否启用 */
    enabled: boolean

    /** 内存地址 */
    address: number

    /** 修改类型 */
    type: CheatType

    /** 数值长度（字节数） */
    length: CheatLength

    /** 目标数值 */
    value: number

    /** 是否已应用（用于ONCE类型） */
    applied?: boolean

    /** 原始值（用于恢复） */
    originalValue?: number
}

/**
 * 金手指管理器
 * 实现VirtuaNES格式的金手指系统
 */
export class Cheater {

    private cheats: Map<string, CheatCode> = new Map()

    private nes: NES

    constructor(nes: NES) {
        this.nes = nes
    }

    /**
     * 添加金手指
     */
    public addCheat(code: string): void {

        // 验证金手指代码格式
        try {
            const cheat = this.parseCheatCode(code)
        
            this.cheats.set(
                code, 
                cheat,
            )
        }
        catch(_error) {
            throw new Error(`Invalid cheat code format: ${code}`)
        }
    }

    /**
     * 移除金手指
     */
    public removeCheat(code: string): void {
        const cheat = this.cheats.get(code)
        if (cheat && cheat.enabled && cheat.originalValue !== undefined) {

            // 恢复原始值
            this.writeMemory(cheat.address, cheat.originalValue, cheat.length)
        }
        this.cheats.delete(code)
    }

    /**
     * 启用/禁用金手指
     */
    public setCheatEnabled(code: string, enabled: boolean): void {
        const cheat = this.cheats.get(code)
        if (!cheat) {
            return
        }

        if (cheat.enabled && !enabled && cheat.originalValue !== undefined) {

            // 禁用时恢复原始值
            this.writeMemory(cheat.address, cheat.originalValue, cheat.length)
            cheat.originalValue = undefined
        }

        cheat.enabled = enabled
        cheat.applied = false // 重置应用状态
    }

    /**
     * 检查金手指是否启用
     */
    public isCheatEnabled(code: string): boolean {
        const cheat = this.getCheat(code)

        return cheat ? cheat.enabled : false
    }

    /**
     * 获取单个金手指
     * @param code 金手指代码
     * @returns 金手指对象或undefined
     */
    public getCheat(code: string): CheatCode | undefined {
        return this.cheats.get(code)
    }

    /**
     * 获取所有金手指
     */
    public getCheats(): CheatCode[] {
        return Array.from(this.cheats.values())
    }

    /**
     * 解析VirtuaNES格式的金手指代码
     * 格式：XXXX-YZ-VVVV
     * XXXX: 内存地址（4位十六进制）
     * Y: 修改类型（0=保持, 1=只修改一次, 2=不大于, 3=不小于）
     * Z: 数值长度（1=1字节, 2=2字节, 4=4字节）
     * VVVV: 目标数值（十六进制）
     */
    public parseCheatCode(code: string): CheatCode {
        const parts = code.trim()
            .toUpperCase()
            .split('-')
        
        if (parts.length !== 3) {
            throw new Error('Invalid cheat code format. Expected: XXXX-YZ-VVVV')
        }

        // 解析地址
        const addressStr = parts[0]
        if (!/^[\dA-F]{4}$/.test(addressStr)) {
            throw new Error('Invalid address format. Expected 4 hex digits.')
        }
        const address = Number.parseInt(addressStr, 16)

        // 解析类型和长度
        const typeAndLength = parts[1]
        if (!/^[0-3][1-4]$/.test(typeAndLength)) {
            throw new Error('Invalid type/length format. Expected: XY where X=0-3, Y=1-4')
        }
        
        const type = Number.parseInt(typeAndLength[0], 10) as CheatType
        const lengthValue = Number.parseInt(typeAndLength[1], 10)
        
        // 验证长度值
        let length: CheatLength
        switch (lengthValue) {
            case 1:
                length = 1 as CheatLength
                break
            case 2:
                length = 2 as CheatLength
                break
            case 4:
                length = 4 as CheatLength
                break
            default:
                throw new Error('Invalid length. Supported: 1, 2, 4 bytes')
        }

        // 解析数值
        const valueStr = parts[2]
        const expectedValueLength = lengthValue * 2 // 每字节需要2个十六进制字符
        if (valueStr.length > expectedValueLength || !/^[\dA-F]+$/.test(valueStr)) {
            throw new Error(`Invalid value format. Expected up to ${expectedValueLength} hex digits.`)
        }
        
        const value = Number.parseInt(valueStr, 16)
        const maxValue = Math.pow(256, lengthValue) - 1
        if (value > maxValue) {
            throw new Error(`Value ${value} exceeds maximum for ${lengthValue} bytes`)
        }

        return {
            code,
            address,
            length,
            type,
            value,
            enabled: true,
        }
    }

    /**
     * 应用所有启用的金手指
     */
    public applyCheats(): void {
        for (const cheat of this.cheats.values()) {
            if (!cheat.enabled) {
                continue
            }

            this.applyCheat(cheat)
        }
    }

    /**
     * 应用单个金手指
     */
    private applyCheat(cheat: CheatCode): void {
        const currentValue = this.readMemory(cheat.address, cheat.length)
        
        // 保存原始值（如果还没有保存）
        if (cheat.originalValue === undefined) {
            cheat.originalValue = currentValue
        }

        let shouldWrite = false
        const newValue = cheat.value

        switch (cheat.type) {
            case 0: // KEEP - 保持值不变
                shouldWrite = true
                break

            case 1: // ONCE - 只修改一次
                if (!cheat.applied) {
                    shouldWrite = true
                    cheat.applied = true
                }
                break

            case 2: // NOT_GREATER - 值不大于
                if (currentValue > cheat.value) {
                    shouldWrite = true
                }
                break

            case 3: // NOT_LESS - 值不小于
                if (currentValue < cheat.value) {
                    shouldWrite = true
                }
                break
        }

        if (shouldWrite) {
            this.writeMemory(cheat.address, newValue, cheat.length)
        }
    }

    /**
     * 从内存读取数值
     */
    private readMemory(address: number, length: CheatLength): number {
        const cpuram = this.nes.getCPURAM()
        if (!cpuram) {
            return 0
        }

        let value = 0
        for (let i = 0; i < length; i++) {
            const byte = cpuram.read(address + i)
            value |= byte << i * 8
        }

        return value
    }

    /**
     * 向内存写入数值
     */
    private writeMemory(address: number, value: number, length: CheatLength): void {
        const cpuram = this.nes.getCPURAM()
        if (!cpuram) {
            return
        }

        for (let i = 0; i < length; i++) {
            const byte = value >> i * 8 & 0xFF
            cpuram.write(address + i, byte)
        }
    }

    /**
     * 清除所有金手指
     */
    public clearCheats(): void {

        // 恢复所有原始值
        for (const cheat of this.cheats.values()) {
            if (cheat.enabled && cheat.originalValue !== undefined) {
                this.writeMemory(cheat.address, cheat.originalValue, cheat.length)
            }
        }
        this.cheats.clear()
    }

    /**
     * 从文本加载金手指
     * 支持的格式：
     * 1. 每行一个金手指代码，格式：代码 名称（可选）
     * 2. 空行和以#开头的行会被忽略
     */
    public loadCheatsFromString(cheatsText: string): void {
        const lines = cheatsText.split('\n')

        for (const line of lines) {
            const trimmedLine = line.trim()
            
            // 跳过空行和注释行
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue
            }

            try {

                // 解析行：代码 名称（可选）
                const parts = trimmedLine.split(/\s+/)
                const code = parts[0]
                this.addCheat(code)
            }
            catch(error) {
                console.warn(`Failed to parse cheat line: "${trimmedLine}"`, error)
            }
        }
    }

    /**
     * 导出金手指为文本格式
     */
    public exportCheatsToString(): string {
        const lines: string[] = []
        
        for (const cheat of this.cheats.values()) {
            const status = cheat.enabled ? '' : '# DISABLED: '
            lines.push(`${status}${cheat.code}`)
        }

        return lines.join('\n')
    }

    /**
     * 创建预设金手指代码
     */
    public static createCheatCode(address: number, type: CheatType, length: CheatLength, value: number): string {
        const addressStr = address.toString(16)
            .toUpperCase()
            .padStart(4, '0')
        const typeAndLength = `${type}${length}`
        const valueStr = value.toString(16)
            .toUpperCase()
            .padStart(length * 2, '0')
        
        return `${addressStr}-${typeAndLength}-${valueStr}`
    }

    /**
     * 获取金手指统计信息
     */
    public getStats(): { total: number; enabled: number; disabled: number } {
        let enabled = 0
        let disabled = 0
        
        for (const cheat of this.cheats.values()) {
            if (cheat.enabled) {
                enabled++
            }
            else {
                disabled++
            }
        }

        return {
            total: this.cheats.size,
            enabled,
            disabled,
        }
    }
}
