
import type { SaveStateData } from './interfaces'

/**
 * 二进制存档
 */
export class BinarySaveState {
    private static readonly MAGIC_HEADER = 0x4E455353 // "NESS" in hex
    private static readonly VERSION = 1

    /**
     * 将存档数据转换为二进制格式
     */
    public static serialize(saveData: SaveStateData): Uint8Array {
        const writer = new BinaryWriter()
        
        // 写入文件头
        writer.writeUint32(this.MAGIC_HEADER)
        writer.writeUint32(this.VERSION)
        writer.writeUint64(saveData.timestamp)
        
        // 写入ROM信息
        writer.writeUint32(saveData.romInfo.crc32)
        writer.writeUint32(saveData.romInfo.mapperType)
        
        // 写入CPU状态
        writer.writeUint16(saveData.cpu.PC)
        writer.writeUint8(saveData.cpu.A)
        writer.writeUint8(saveData.cpu.X)
        writer.writeUint8(saveData.cpu.Y)
        writer.writeUint8(saveData.cpu.SP)
        writer.writeUint8(saveData.cpu.P)
        writer.writeUint64(saveData.cpu.cycles)
        writer.writeByteArray(saveData.cpu.ram, 2048)
        
        // 写入完整的PPU状态 (使用JSON序列化，不重复保存基本字段)
        const ppuStateJson = JSON.stringify(saveData.ppu)
        const ppuStateBytes = new TextEncoder().encode(ppuStateJson)
        writer.writeUint32(ppuStateBytes.length)
        writer.writeBytes(ppuStateBytes)
        
        // 写入APU状态 (使用JSON序列化)
        const apuStateJson = JSON.stringify(saveData.apu)
        const apuStateBytes = new TextEncoder().encode(apuStateJson)
        writer.writeUint32(apuStateBytes.length)
        writer.writeBytes(apuStateBytes)
        
        // 写入控制器状态
        const player1 = saveData.controllers.player1
        const player2 = saveData.controllers.player2
        writer.writeUint8(player1.buttonState)
        writer.writeUint8(player1.strobeState ? 1 : 0)
        writer.writeUint8(player1.buttonIndex)
        writer.writeUint8(player2.buttonState)
        writer.writeUint8(player2.strobeState ? 1 : 0)
        writer.writeUint8(player2.buttonIndex)
        
        // 写入Mapper状态
        this.writeMapperState(writer, saveData.mapper)
        
        // 写入帧计数
        writer.writeUint64(saveData.frameCount)
        
        const result = writer.getBuffer()
        
        return result
    }
    
    /**
     * 从二进制格式恢复存档数据
     */
    public static deserialize(binaryData: Uint8Array): SaveStateData {
        const reader = new BinaryReader(binaryData)
        
        // 验证文件头
        const magic = reader.readUint32()
        if (magic !== this.MAGIC_HEADER) {
            throw new Error('Invalid save file format')
        }
        
        const version = reader.readUint32()
        if (version > this.VERSION) {
            throw new Error(`Unsupported save file version: ${version}`)
        }
        
        const timestamp = reader.readUint64()
        
        // 读取ROM信息
        const romCrc32 = reader.readUint32()
        const mapperType = reader.readUint32()
        
        // 读取CPU状态
        const cpuPC = reader.readUint16()
        const cpuA = reader.readUint8()
        const cpuX = reader.readUint8()
        const cpuY = reader.readUint8()
        const cpuSP = reader.readUint8()
        const cpuP = reader.readUint8()
        const cpuCycles = reader.readUint64()
        const cpuRam = reader.readByteArray(2048)
        
        // 读取完整的PPU状态 (从JSON反序列化)
        const ppuStateLength = reader.readUint32()
        let ppuState = null
        if (ppuStateLength > 0) {
            const ppuStateBytes = reader.readBytes(ppuStateLength)
            const ppuStateJson = new TextDecoder().decode(ppuStateBytes)
            ppuState = JSON.parse(ppuStateJson)
        }
        else {
            
            // fallback到基本PPU状态
            ppuState = {
                registers: [],
                palette: new Array(32).fill(0),
                oam: new Array(256).fill(0),
                vram: [],
                scanline: 0,
                cycle: 0,
            }
        }
        
        // 读取APU状态 (从JSON反序列化)
        const apuStateLength = reader.readUint32()
        let apuState = null
        if (apuStateLength > 0) {
            const apuStateBytes = reader.readBytes(apuStateLength)
            const apuStateJson = new TextDecoder().decode(apuStateBytes)
            apuState = JSON.parse(apuStateJson)
        }
        else {
            
            // fallback到空APU状态
            apuState = {
                registers: [],
                channels: [],
            }
        }
        
        // 读取控制器状态
        const p1ButtonState = reader.readUint8()
        const p1StrobeState = reader.readUint8() === 1
        const p1ButtonIndex = reader.readUint8()
        const p2ButtonState = reader.readUint8()
        const p2StrobeState = reader.readUint8() === 1
        const p2ButtonIndex = reader.readUint8()
        
        // 读取Mapper状态
        const mapperState = this.readMapperState(reader, mapperType)
        
        // 读取帧计数
        const frameCount = reader.readUint64()
        
        // 构造SaveStateData对象
        const saveData: SaveStateData = {
            version: 1,
            timestamp,
            romInfo: {
                crc32: romCrc32,
                mapperType,
            },
            cpu: {
                PC: cpuPC,
                A: cpuA,
                X: cpuX,
                Y: cpuY,
                SP: cpuSP,
                P: cpuP,
                cycles: cpuCycles,
                ram: Array.from(cpuRam),
            },
            ppu: ppuState,
            apu: apuState,
            mapper: { state: mapperState },
            controllers: {
                player1: {
                    buttonState: p1ButtonState,
                    strobeState: p1StrobeState,
                    buttonIndex: p1ButtonIndex,
                },
                player2: {
                    buttonState: p2ButtonState,
                    strobeState: p2StrobeState,
                    buttonIndex: p2ButtonIndex,
                },
            },
            frameCount,
        }
        
        return saveData
    }
    
    /**
     * 写入Mapper状态
     */
    private static writeMapperState(writer: BinaryWriter, mapper: any): void {

        // PRG RAM
        if (mapper.prgram && mapper.prgram.length > 0) {
            writer.writeUint32(mapper.prgram.length)
            writer.writeByteArray(mapper.prgram, mapper.prgram.length)
        }
        else {
            writer.writeUint32(0)
        }
        
        // Mapper特定状态 (使用JSON序列化)
        if (mapper.state) {
            const stateJson = JSON.stringify(mapper.state)
            const stateBytes = new TextEncoder().encode(stateJson)
            writer.writeUint32(stateBytes.length)
            writer.writeBytes(stateBytes)
        }
        else {
            writer.writeUint32(0)
        }
    }
    
    /**
     * 读取Mapper状态
     */
    private static readMapperState(reader: BinaryReader, mapperType: number): any {

        // PRG RAM
        const prgRamLength = reader.readUint32()
        const prgram = prgRamLength > 0 ? Array.from(reader.readByteArray(prgRamLength)) : []
        
        // Mapper状态
        const stateLength = reader.readUint32()
        let state = null
        if (stateLength > 0) {
            const stateBytes = reader.readBytes(stateLength)
            const stateJson = new TextDecoder().decode(stateBytes)
            state = JSON.parse(stateJson)
        }
        
        return {
            prgram,
            type: mapperType,
            state,
        }
    }
}

/**
 * 二进制写入器
 */
class BinaryWriter {
    private buffer: Uint8Array
    private view: DataView
    private offset: number = 0
    
    constructor(initialSize: number = 1024 * 256) {
        this.buffer = new Uint8Array(initialSize)
        this.view = new DataView(this.buffer.buffer)
    }
    
    private ensureCapacity(additionalBytes: number): void {
        if (this.offset + additionalBytes > this.buffer.length) {
            const newSize = Math.max(this.buffer.length * 2, this.offset + additionalBytes)
            const newBuffer = new Uint8Array(newSize)
            newBuffer.set(this.buffer)
            this.buffer = newBuffer
            this.view = new DataView(this.buffer.buffer)
        }
    }
    
    writeUint8(value: number): void {
        this.ensureCapacity(1)
        this.view.setUint8(this.offset, value)
        this.offset += 1
    }
    
    writeUint16(value: number): void {
        this.ensureCapacity(2)
        this.view.setUint16(this.offset, value, true)
        this.offset += 2
    }
    
    writeUint32(value: number): void {
        this.ensureCapacity(4)
        this.view.setUint32(this.offset, value, true)
        this.offset += 4
    }
    
    writeUint64(value: number): void {
        this.ensureCapacity(8)
        const bigValue = BigInt(Math.floor(value))
        this.view.setBigUint64(this.offset, bigValue, true)
        this.offset += 8
    }
    
    writeString(str: string): void {
        const bytes = new TextEncoder().encode(str)
        this.writeUint16(bytes.length)
        this.writeBytes(bytes)
    }
    
    writeByteArray(array: number[], expectedLength: number): void {
        if (array.length !== expectedLength) {
            throw new Error(`Array length mismatch: expected ${expectedLength}, got ${array.length}`)
        }
        for (const byte of array) {
            this.writeUint8(byte)
        }
    }
    
    writeBytes(bytes: Uint8Array): void {
        this.ensureCapacity(bytes.length)
        this.buffer.set(bytes, this.offset)
        this.offset += bytes.length
    }
    
    getBuffer(): Uint8Array {
        return this.buffer.slice(0, this.offset)
    }
}

/**
 * 二进制读取器
 */
class BinaryReader {
    private view: DataView
    private offset: number = 0
    
    constructor(private buffer: Uint8Array) {
        this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    }
    
    readUint8(): number {
        const value = this.view.getUint8(this.offset)
        this.offset += 1
        
        return value
    }
    
    readUint16(): number {
        const value = this.view.getUint16(this.offset, true)
        this.offset += 2
        
        return value
    }
    
    readUint32(): number {
        const value = this.view.getUint32(this.offset, true)
        this.offset += 4
        
        return value
    }
    
    readUint64(): number {
        const value = this.view.getBigUint64(this.offset, true)
        this.offset += 8
        
        return Number(value)
    }
    
    readString(): string {
        const length = this.readUint16()
        const bytes = this.readBytes(length)
        
        return new TextDecoder().decode(bytes)
    }
    
    readByteArray(length: number): Uint8Array {
        return this.readBytes(length)
    }
    
    readBytes(length: number): Uint8Array {
        const bytes = this.buffer.slice(this.offset, this.offset + length)
        this.offset += length
        
        return bytes
    }
}
