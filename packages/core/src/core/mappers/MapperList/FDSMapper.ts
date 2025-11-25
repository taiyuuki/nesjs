import { Mapper } from '../Mapper'
import { FDSSoundChip } from '../../audio/FDSSoundChip'
import type { ROMLoader } from '../../ROMLoader'
import { MirrorType } from '../../types'

/**
 * FDS (Famicom Disk System) Mapper 实现
 * 
 * 基于官方FDS文档的简洁实现：
 * - 8KB BIOS ROM (映射到 $E000-$FFFF)
 * - 8KB Work RAM (映射到 $6000-$7FFF)  
 * - 8KB CHR RAM
 * - FDS音频芯片
 * - 磁盘读写控制
 * - Timer IRQ系统
 */
export default class FDSMapper extends Mapper {

    public readonly name = 'FDSMapper'

    // BIOS数据 (8KB)
    private biosData: Uint8Array | null = null
    
    // Work RAM (32KB) - 扩展以支持$A000区域代码
    private workRam: Uint8Array = new Uint8Array(32768)
    
    // CHR RAM (8KB) 
    private chrRam: Uint8Array = new Uint8Array(8192)
    
    // FDS磁盘数据
    private diskData: Uint8Array
    
    // 磁盘系统控制
    private diskReadMode: boolean = true
    private diskMotorOn: boolean = false
    private lastResetBit: boolean = false // 上次bit1的状态，用于边沿检测
    
    // 磁盘状态管理（根据VirtuaNES）
    private diskEject: number = 0 // 磁盘弹出状态 (0=已插入, 1=未插入)
    
    // FDS磁盘块状态机（根据VirtuaNES实现）
    private blockMode: number = 0 // 当前块类型: 0=READY, 1=VOLUME_LABEL, 2=FILE_AMOUNT, 3=FILE_HEADER, 4=FILE_DATA
    private blockPoint: number = 0 // 块内偏移
    private point: number = 0 // 磁盘数据全局偏移
    private currentFileSize: number = 0 // 当前文件大小
    private currentFileLoadAddr: number = 0 // 当前文件加载地址
    private rwStart: boolean = false // 读写开始标志
    private driveReset: boolean = false // 驱动器重置标志（VirtuaNES兼容）

    // FDS寄存器
    private fdsRegs: Uint8Array = new Uint8Array(8)
    private shouldDetectBlockId: boolean = false
    
    private static readonly SIZE_VOLUME_LABEL = 55 // Volume Label 数据大小是 55 字节（不包括 Block ID）
    private static readonly SIZE_FILE_AMOUNT = 1 // File Amount 块内容大小是 1 字节（不包括 Block ID）
    
    // IRQ控制
    private irqReload: number = 0
    private irqCounter: number = 0
    private irqEnabled: boolean = false
    private irqRepeat: boolean = false
    private diskTimerIrq: boolean = false
    private diskSeekIrq: number = 0
    
    // 磁盘IRQ机制（新增）
    private diskIrqPending: boolean = false // 磁盘IRQ待处理标志
    private diskTransferCounter: number = 0 // 磁盘传输周期计数器
    private dataReady: boolean = false // 数据准备好标志
    private readonly CYCLES_PER_BYTE = 150
    
    // 游戏状态跟踪
    private tickCount: number = 0
    private cartReadCount: number = 0
    
    // 音频芯片
    private soundChip: FDSSoundChip
    private soundRegistersEnabled: boolean = false

    constructor(loader: ROMLoader) {
        super(loader)
        
        // 保存磁盘数据
        this.diskData = loader.fdsData
          
        this.hasprgram = false
        
        // 初始化音频芯片
        this.soundChip = new FDSSoundChip()
        
        // 解析和加载磁盘文件
        this.loadBootFiles()
    }

    /**
     * 设置外部BIOS数据
     */
    public setBIOS(biosData: Uint8Array): void {
        if (biosData.length === 8192) {
            this.biosData = new Uint8Array(biosData)
        }
    }
    
    /**
     * 加载启动文件
     */
    private loadBootFiles(): void {

        if (this.diskData.length < 16) {
            return
        }
            
        // ROMLoader已经解析过头部，直接从磁盘数据开始
        let offset = 0
        let filesLoaded = 0
        const bootFileCode = 255 // 通常启动文件的ID较小
            
        // 解析磁盘信息块并提取许可证信息
        if (offset < this.diskData.length && this.diskData[offset] === 0x01) {
                
            // 磁盘信息块结构（56字节）：
            // +0: Block code (0x01)
            // +1-15: '*NINTENDO-HVC*' (15字节)
            // +16: 厂商代码
            // +17-19: 游戏名称缩写 (3字节)
            // +20: 游戏类型
            // +21: 版本号
            // +22: 面号
            // +23: 磁盘号
            // +24: 磁盘类型
            // +25: 未知字节
            // +26-31: 日期 (6字节)
            // +32-47: 保留 (16字节)
            // +48-55: CRC (8字节)
                
            offset += 56 // 跳过磁盘信息块
        }
        else {
            return
        }
            
        // 解析文件计数块  
        if (offset < this.diskData.length && this.diskData[offset] === 0x02) {
            const fileCount = this.diskData[offset + 1]
            offset += 2
                
            // 解析每个文件
            for (let fileIndex = 0; fileIndex < fileCount && offset < this.diskData.length; fileIndex++) {
                    
                // 文件头块 (block 3)
                if (offset + 16 >= this.diskData.length) break
                    
                if (this.diskData[offset] !== 0x03) {
                    break
                }
                    
                const fileId = this.diskData[offset + 2]
                const loadAddr = this.diskData[offset + 11] | this.diskData[offset + 12] << 8
                const fileSize = this.diskData[offset + 13] | this.diskData[offset + 14] << 8
                const fileType = this.diskData[offset + 15]
                                  
                offset += 16
                    
                // 文件数据块 (block 4)
                if (offset >= this.diskData.length || this.diskData[offset] !== 0x04) {
                    break
                }
                    
                offset += 1 // 跳过block code
                    
                // 检查是否是启动文件
                if (fileId <= bootFileCode) {
                         
                    if (this.loadFile(fileType, loadAddr, fileSize, offset)) {
                        filesLoaded++
                    }
                }
                    
                offset += fileSize // 跳过文件数据
            }
                
            if (filesLoaded > 0) {

                // 启用音频寄存器
                this.soundRegistersEnabled = true
            }
                
        }
    }
    
    /**
     * 加载单个文件
     */
    private loadFile(type: number, loadAddr: number, size: number, dataOffset: number): boolean {
        try {
            if (dataOffset + size > this.diskData.length) {

                return false
            }
            
            switch (type) {
                case 0: // Program data
                    if (loadAddr >= 0x6000 && loadAddr < 0x8000) {

                        // Load to Work RAM
                        const ramOffset = loadAddr - 0x6000

                        for (let i = 0; i < size && ramOffset + i < this.workRam.length; i++) {
                            this.workRam[ramOffset + i] = this.diskData[dataOffset + i]
                        }
                    }
                    else if (loadAddr >= 0xA000 && loadAddr < 0xE000) {

                        // 有些FDS游戏需要加载代码到$A000-$DFFF区域
                        // 暂存到Work RAM的后半部分，后续映射时再处理
                        const ramOffset = loadAddr - 0xA000 + 0x4000 // 存储到Work RAM后半部分
                        for (let i = 0; i < size && ramOffset + i < this.workRam.length; i++) {
                            this.workRam[ramOffset + i] = this.diskData[dataOffset + i]
                        }
                    }
                    break
                    
                case 1: // Character data  
                    // FDS CHR数据可能包含pattern tables和nametable数据
                    // 根据loadAddr决定加载位置
                    if (loadAddr === 0x0000 || loadAddr < 0x2000) {

                        // Pattern table data - 加载到CHR RAM前4KB
                        const patternSize = Math.min(size, 0x1000)
                        for (let i = 0; i < patternSize; i++) {
                            this.chrRam[i] = this.diskData[dataOffset + i]
                        }
                        
                        // 如果还有更多数据，可能是nametable数据
                        if (size > 0x1000) {
                            const nameTableSize = Math.min(size - 0x1000, 0x1000)
                            for (let i = 0; i < nameTableSize; i++) {
                                this.chrRam[0x1000 + i] = this.diskData[dataOffset + 0x1000 + i]
                            }
                        }
                    }
                    else {

                        // 直接按地址加载
                        for (let i = 0; i < size && i < this.chrRam.length; i++) {
                            this.chrRam[i] = this.diskData[dataOffset + i]
                        }
                    }
                    break
                    
                case 2: // Name table data
                    // 通过正常的PPU写入到Nametable（pput0/pput1）
                    // 这样BIOS的许可检查才能正确读取到数据
                    if (loadAddr >= 0x2000 && loadAddr < 0x3000) {

                        // 通过PPU写入，自动处理镜像映射到pput0/pput1
                        for (let i = 0; i < size; i++) {
                            const ppuAddr = loadAddr + i
                            const data = this.diskData[dataOffset + i]

                            // 使用PPU写入，数据会被正确写入到pput（内部VRAM）
                            this.ppuWrite(ppuAddr, data)
                        }
                    }
                    break
                    
                default:
                    return false
            }
            
            return true
            
        }
        catch {

            return false
        }
    }
    
    // Memory mapping
    public override cartWrite(addr: number, data: number): void {
        
        if (addr >= 0x6000 && addr < 0x8000) {

            // Work RAM ($6000-$7FFF)
            this.workRam[addr - 0x6000] = data
        }
        else if (addr >= 0x8000 && addr < 0xa000) {

            // Bank 4: Work RAM $2000-$3FFF (映射到 $8000-$9FFF)
            this.workRam[addr - 0x8000 + 0x2000] = data
        }
        else if (addr >= 0xa000 && addr < 0xc000) {

            // Bank 5: Work RAM $4000-$5FFF (映射到 $a000-$bFFF)
            this.workRam[addr - 0xa000 + 0x4000] = data
        }
        else if (addr >= 0xc000 && addr < 0xe000) {

            // Bank 6: Work RAM $6000-$7FFF (映射到 $c000-$dFFF)
            this.workRam[addr - 0xc000 + 0x6000] = data
        }
        else if (addr >= 0x4020 && addr <= 0x4026) {

            // FDS控制寄存器
            this.writeFDSControlRegister(addr, data)
        }
        else if (addr >= 0x4040 && addr <= 0x4092) {

            // FDS音频寄存器
            if (this.soundRegistersEnabled) {
                this.soundChip.write(addr, data)
            }
        }
    }
    
    public override cartRead(addr: number): number {
            
        // FDS寄存器读取
        if (addr >= 0x4030 && addr <= 0x4033) {
            return this.readFDSRegister(addr)
        }

        // FDS使用统一的ROM bank系统 - 所有$6000-$FFFF通过PRG banks访问
        if (addr >= 0x6000) {
            
            // 计数访问但不输出日志
            this.cartReadCount++
            
            // 计算bank和偏移
            let bankIndex: number
            let offset: number
            
            if (addr < 0x8000) {

                // $6000-$7FFF: Bank 3 (Work RAM 0x0000-0x1FFF)
                bankIndex = 0 // 对应workRam的前8KB
                offset = addr - 0x6000
            }
            else if (addr < 0xA000) {

                // $8000-$9FFF: Bank 4 (Work RAM 0x2000-0x3FFF)  
                bankIndex = 1 // 对应workRam的第二个8KB
                offset = addr - 0x8000
            }
            else if (addr < 0xC000) {

                // $A000-$BFFF: Bank 5 (Work RAM 0x4000-0x5FFF)
                bankIndex = 2 // 对应workRam的第三个8KB
                offset = addr - 0xA000
            }
            else if (addr < 0xE000) {

                // $C000-$DFFF: Bank 6 (Work RAM 0x6000-0x7FFF)
                bankIndex = 3 // 对应workRam的第四个8KB
                offset = addr - 0xC000
            }
            else {

                // $E000-$FFFF: BIOS ROM区域
                // **简化方案** - 直接从BIOS ROM读取,在init()中预设$EF00-$EFFF为$FF
                if (this.biosData) {
  
                    return this.biosData[addr - 0xE000]
                }

                return 0
            }
            
            // 从对应的Work RAM bank读取
            const workRamAddr = bankIndex * 8192 + offset
            const data = this.workRam[workRamAddr]
            
            return data
        }
        
        return 0
    }
    
    // FDS寄存器访问
    private writeFDSControlRegister(addr: number, data: number): void {
        
        // FDS寄存器写入
        switch (addr) {
            case 0x4020:

                // IRQ reload低8位
                this.irqReload = this.irqReload & 0xFF00 | data
                break
            case 0x4021:

                // IRQ reload高8位
                this.irqReload = this.irqReload & 0x00FF | data << 8
                break
            case 0x4022:

                // Timer IRQ control
                const wasEnabled = this.irqEnabled
                this.irqEnabled = (data & 0x01) !== 0
                this.irqRepeat = (data & 0x02) !== 0

                if (this.irqEnabled) {

                    // Enable IRQ - copy reload value to counter
                    this.irqCounter = this.irqReload
                }
                else if (wasEnabled) {

                    // IRQ was disabled - acknowledge any pending timer IRQs
                    this.diskTimerIrq = false
                }
                break
            case 0x4023:

                // Master I/O enable - bit0 enables disk I/O, bit1 enables sound I/O
                // When disk I/O is disabled, stop disk transfers and clear IRQs
                if ((data & 0x01) === 0) {

                    // Disk I/O disabled - stop transfers and clear disk IRQs
                    this.diskTimerIrq = false
                    this.diskIrqPending = false
                    this.rwStart = false
                    if (this.cpu) {
                        this.cpu.interrupt &= ~0x20
                    }
                }

                // Sound I/O enable bit (bit1) - store for audio chip
                this.soundRegistersEnabled = (data & 0x02) !== 0
                break

            case 0x4024:

                // Write data register - data to be written to disk
                // Store the data and acknowledge disk IRQs
                this.fdsRegs[4] = data

                // Writing to $4024 acknowledges disk IRQs according to FDS docs
                this.diskTimerIrq = false
                this.diskIrqPending = false
                break

            case 0x4025:

                // 存储寄存器值
                this.fdsRegs[5] = data
                
                // bit1: Transfer Reset (1=重置传输时序)
                const currentResetBit = (data & 0x02) !== 0

                // 只在bit1从0变为1时触发重置（上升沿）
                if (currentResetBit && !this.lastResetBit) {
                    this.point = 0
                    this.blockPoint = 0
                    this.blockMode = 0 // BLOCK_READY
                    this.rwStart = false
                    this.driveReset = true
                    this.shouldDetectBlockId = true
                }

                // 保存当前bit1状态用于下次边沿检测
                this.lastResetBit = currentResetBit

                if (data & 0x40 && this.driveReset) {
                    this.driveReset = false
                }
                
                const motorStart = (data & 0x02) === 0
                if (motorStart && this.driveReset) {
                    this.driveReset = false
                }
                
                // 保存当前bit1状态用于下次边沿检测
                this.lastResetBit = currentResetBit
    
                // 添加磁盘寻址IRQ机制
                const irqTransferFlag = (data & 0x80) !== 0
                const motorOn = (data & 0x02) !== 0

                if (irqTransferFlag) {
                    this.diskTimerIrq = true
                }
                else {
                    this.diskTimerIrq = false
                }

                if (irqTransferFlag && motorOn) {
                    this.diskSeekIrq = 150 
                }
                
                const rwStartRisingEdge = !this.rwStart && (data & 0x40) !== 0

                const blockSize = this.getBlockSize()
                const blockComplete = this.blockPoint >= blockSize && blockSize > 0
                const canTransition = rwStartRisingEdge && !this.driveReset && blockComplete
                
                if (canTransition) {

                    const blockSize = this.getBlockSize()
                    this.point += blockSize // 使用 blockSize 而不是 blockPoint
                    this.blockPoint = 0
                    
                    this.blockMode++
                    if (this.blockMode > 4) {
                        this.blockMode = 3 // FILEDATA (4) → FILEHDR (3)
                    }
                    
                    // 重置传输状态
                    this.dataReady = false
                    this.diskTransferCounter = this.CYCLES_PER_BYTE
                }
                
                // 读写开始控制 (bit6) - VirtuaNES: RW_start = data & 0x40
                const wasRwStart = this.rwStart
                this.rwStart = (data & 0x40) !== 0
                
                // 当rwStart变为false时，重置传输计数器
                if (wasRwStart && !this.rwStart) {

                    // 暂停传输 - 重置计数器，下次恢复时从0开始
                    this.diskTransferCounter = 0
                    this.dataReady = false
                }
                
                // 当rwStart从false变true时（恢复读取），处理待读取的数据
                if (!wasRwStart && this.rwStart && !this.driveReset) {

                    // 在rwStart时检测Block ID并设置blockMode
                    // 只在 block transition 后（shouldDetectBlockId=true）且 blockPoint=0 时检测
                    // 如果是 FILE_DATA 中途暂停/恢复，不应该重新检测 Block ID
                    if (this.shouldDetectBlockId && this.blockPoint === 0) {
                        const globalOffset = this.point + this.blockPoint
                        if (this.diskData && globalOffset < this.diskData.length) {
                            const possibleBlockId = this.diskData[globalOffset]
                            if (possibleBlockId >= 1 && possibleBlockId <= 4) {
                                this.blockMode = possibleBlockId
                                this.shouldDetectBlockId = false // 清除标志
                            }
                        }
                    }

                    // 如果已经有数据准备好（dataReady=true），立即触发IRQ让BIOS读取
                    if (this.dataReady) {
                        if (this.cpu) {
                            this.cpu.interrupt |= 0x20 // IRQ_MAPPER2
                        }
                    }
                    else {

                        // 没有数据准备好，设置counter让下一个字节立即准备
                        this.diskTransferCounter = this.CYCLES_PER_BYTE
                    }
                }
                
                // 读写模式控制 (bit2) - VirtuaNES: RW_mode = data & 0x04, 读取条件是RW_mode为真
                this.diskReadMode = (data & 0x04) !== 0 // bit2=1时是读模式（VirtuaNES逻辑）
                
                // 磁盘马达控制 (bit1) - 注意：0=开启, 1=停止
                // 在FILE_DATA阶段保持磁盘马达开启
                const motorStop = (data & 0x02) !== 0
                if (this.blockMode === 4 && motorStop) {

                    // 在FILE_DATA阶段不关闭磁盘马达
                }
                else {
                    this.diskMotorOn = !motorStop // 0=开启, 1=停止
                }
                
                // Mirroring 控制 (bit3)
                // 注意: 需要对bit3取反 (XOR 1)
                // bit3=1 → mirrorBit=0 → Horizontal
                // bit3=0 → mirrorBit=1 → Vertical
                const bit3 = data >> 3 & 1
                const mirrorBit = bit3 ^ 1 // 取反
                const newMirrorType = mirrorBit === 1 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR
                
                this.setmirroring(newMirrorType)
                
                break
            case 0x4026:

                // External connector output register
                // Store the written value (it will be read back by $4033)
                this.fdsRegs[6] = data & 0x7F // bit7 is input only (battery)

                // Writing to $4026 also acknowledges disk IRQs
                this.diskTimerIrq = false
                break
        }
    }
    
    private readFDSRegister(addr: number): number {
        switch (addr) {
            case 0x4030:

                // Disk I/O Status register
                let status = 0x80 // bit7: Byte transfer flag (always set when reading)

                // bit0: Timer IRQ发生
                if (this.diskTimerIrq) {
                    status |= 0x01
                    this.diskTimerIrq = false // 读取后清除
                }

                // bit1: Disk IRQ发生（磁盘数据传输IRQ）
                if (this.diskIrqPending) {
                    status |= 0x02
                }

                // bit3: Nametable arrangement (from $4025.3)
                if (this.fdsRegs[5] & 0x08) {
                    status |= 0x08 // bit3 = $4025.3
                }

                // bit6: CRC control (0=CRC passed, 1=CRC error) - always set to 0 (passed)
                // bit4: End of Head (1 when disk head is on innermost track)
                // bit5: Unknown interrupt source

                return status
            case 0x4031:

                // 磁盘数据读取寄存器 - 基于IRQ的异步读取
                // 只有在IRQ触发后dataReady为true时才能读取数据
                
                if (!this.diskReadMode) {

                    // 非读取模式
                    return 0x00
                }
                
                if (!this.diskMotorOn || !this.diskData || this.diskData.length === 0) {

                    // 磁盘未准备好
                    return 0x00
                }
                
                // 无论 dataReady 状态，都读取当前位置数据
                // BIOS 可能会连续读取多次，每次都应该返回当前字节并前进
                const globalOffset = this.point + this.blockPoint
                let data = 0
                
                // 读取全局offset的数据
                // 只有当全局offset超出磁盘数据时才返回$00
                if (globalOffset < this.diskData.length) {
                    data = this.diskData[globalOffset]
                    
                    // 如果 blockPoint=0，检查是否是 Block ID
                    // 或者当shouldDetectBlockId=true时也检测(用于跨Block连续读取)
                    if (this.blockPoint === 0 || this.shouldDetectBlockId && data >= 1 && data <= 4) {
                        
                        // Block ID: 1=VOLUME_LABEL, 2=FILE_AMOUNT, 3=FILE_HEADER, 4=FILE_DATA
                        if (data >= 1 && data <= 4) {
                            this.blockMode = data
                            this.shouldDetectBlockId = false // 清除标志
                        }
                    }

                }
                else {

                    // 全局偏移超出磁盘数据范围
                    data = 0x00 
                }
                
                // 在FILE_HEADER模式下提取加载地址和文件大小
                if (this.blockMode === 3) {
                    
                    // FILE_HEADER 结构:
                    // byte 0: Block ID ($03)
                    // byte 1: 文件序号
                    // byte 2: 文件ID  
                    // byte 3-10: 文件名 (8字节)
                    // byte 11-12: 加载地址 (2字节, little-endian)
                    // byte 13-14: 文件大小 (2字节, little-endian)
                    // byte 15: 文件类型
                    
                    if (this.blockPoint === 11) {
                        
                        // 加载地址低字节
                        this.currentFileLoadAddr = data
                    }
                    else if (this.blockPoint === 12) {
                        
                        // 加载地址高字节
                        this.currentFileLoadAddr |= data << 8
                    }
                    else if (this.blockPoint === 13) {
                        
                        // 文件大小低字节
                        this.currentFileSize = data
                    }
                    else if (this.blockPoint === 14) {
                        
                        // 文件大小高字节
                        this.currentFileSize |= data << 8
                    }
                }
                
                // Reading $4031 always acknowledges disk IRQs (according to FDS docs)
                this.diskIrqPending = false

                if (this.dataReady) {

                    // 只有在 dataReady 时才清除 dataReady 标志和重置 counter
                    this.dataReady = false

                    // 重置counter，让BIOS有时间处理数据
                    // 虽然磁盘在持续旋转，但BIOS需要时间处理每个字节
                    // 下一个字节会在149周期后准备好
                    this.diskTransferCounter = 0
                }

                // 清除 CPU IRQ - 让BIOS能够从IRQ handler返回
                if (this.cpu) {
                    this.cpu.interrupt &= ~0x20
                }
                
                // 每次读取$4031都自动调度DiskSeek IRQ
                this.diskSeekIrq = 150

                // 无论 dataReady 状态，每次读取都前进 blockPoint
                this.blockPoint++

                return data
            case 0x4032:

                // Drive status register
                // $42 (bit1=1, 未准备好) → $40 (bit1=0, 准备好)
                let driveStatus = 0x40 // bit6: 基础状态位（总是1）
                
                // 更准确的磁盘状态检测
                const diskDataAvailable = this.diskData && this.diskData.length > 0
                
                // bit0: 磁盘插入状态 (0=插入, 1=未插入)
                if (this.diskEject !== 0 || !diskDataAvailable) {
                    driveStatus |= 0x01 // 磁盘未插入或数据不可用
                }
                
                // bit1: 驱动器准备状态 (0=准备好, 1=未准备好)
                // 1. 在重置状态(driveReset=true)时返回 $42 (bit1=1)
                // 2. 重置释放后返回 $40 (bit1=0)
                // 3. 条件：磁盘插入 && 非重置状态 && 数据可用
                if (this.diskEject === 0 && !this.driveReset && diskDataAvailable) {

                    // 准备好 (bit1=0) - 注意：不要求马达开启
                }
                else {
                    driveStatus |= 0x02 // 未准备好
                }

                return driveStatus
            case 0x4033:

                // External connector input register
                // bit7: Battery status (0=low voltage, 1=good)
                // bits 0-6: Input from expansion terminal (reflects $4026 output)
                return this.fdsRegs[6] & 0x7F | 0x80 // bit7=1: battery good
            default:
                return 0
        }
    }
    
    // 初始化覆盖
    public override init(): void {
        super.init()

        // 设置磁盘状态 - 磁盘已插入并准备好
        this.diskEject = 0 // 磁盘已插入
        this.diskMotorOn = true // 磁盘马达默认开启
        this.diskReadMode = true // 默认读模式

        // 确保磁盘数据有效
        if (!this.diskData || this.diskData.length === 0) {
            this.diskEject = 1 // 设置为未插入状态避免ERR.FF
        }

    }
    
    // 时钟处理 - 每CPU周期调用一次
    public tick(): void {

        this.tickCount = (this.tickCount + 1) % 1048576 // 防止溢出
    }
    
    /**
     * 磁盘读取IRQ时钟更新 - 实现FDS磁盘数据传输的IRQ机制
     * 每个字节传输约需149个CPU周期（基于真实FDS硬件速率）
     * @param cpuCycles 本次更新的CPU周期数
     */
    public clockIRQ(cpuCycles: number): void {

        // 只在所有条件都满足时才处理IRQ：
        // 1. 磁盘读取模式
        // 2. 读写已开始（rwStart）
        // 3. 驱动器未重置
        // 4. 当前在有效的块模式（不是READY）
        // 5. 磁盘马达开启
        // 磁盘在持续旋转，数据在持续流动，不管BIOS是否读取

        if (!this.diskReadMode || !this.rwStart
            || this.driveReset || this.blockMode === 0
            || !this.diskMotorOn) {

            return // 不满足条件，不处理磁盘IRQ
        }
        
        // 累积周期计数器
        this.diskTransferCounter += cpuCycles
        
        // 防止累积器溢出,最多累积到一个字节的时间
        if (this.diskTransferCounter > this.CYCLES_PER_BYTE * 2) {

            this.diskTransferCounter = this.CYCLES_PER_BYTE * 2
        }
        
        // 检查是否达到一个字节的传输周期
        if (this.diskTransferCounter >= this.CYCLES_PER_BYTE) {

            // 检查是否还有数据需要传输
            const blockSize = this.getBlockSize()

            if (this.dataReady) {

                // BIOS还没读取上一个字节，等待
            }
            else {

                // 准备下一个字节（即使超出 block 范围，也要触发 IRQ）
                this.dataReady = true
                this.diskIrqPending = true
                
                // 立即设置CPU IRQ
                if (this.cpu) {
                    this.cpu.interrupt |= 0x20 // IRQ_MAPPER2
                }
                
            }
            
            // 块读取完成后不自动转换，让BIOS通过$4025的bit6控制块转换
            if (this.blockPoint >= blockSize) {

                // 块已完成，等待BIOS控制
            }
        }
    }
    
    /**
     * 获取当前块的大小（包括 Block ID）
     */
    private getBlockSize(): number {
        let size = 0
        switch (this.blockMode) {
            case 0: // READY
                size = 0
                break
            case 1: // VOLUME_LABEL
                size = 0x38
                break
            case 2: // FILE_AMOUNT
                size = 0x02
                break
            case 3: // FILE_HEADER
                size = 0x10
                break
            case 4: // FILE_DATA
                size = 1 + this.currentFileSize
                break
            default:
                size = 0
        }

        return size
    }

    /**
     * PPU读取 - CHR RAM和Nametable访问
     */
    public override ppuRead(addr: number): number {
        addr &= 0x3FFF

        // CHR RAM $0000-$1FFF映射 (Pattern Tables)
        if (addr < 0x2000) {
            return this.chrRam[addr & 0x1FFF]
        }

        // 其他区域（Nametable、调色板等）由基类处理
        return super.ppuRead(addr)
    }

    /**
     * PPU写入 - CHR RAM和Nametable访问
     */
    public override ppuWrite(addr: number, value: number): void {
        addr &= 0x3FFF

        // CHR RAM $0000-$1FFF可写 (Pattern Tables)
        if (addr < 0x2000) {
            this.chrRam[addr & 0x1FFF] = value

            return
        }

        // 其他区域（Nametable、调色板等）由基类处理
        super.ppuWrite(addr, value)
    }

    // HSync处理 - 每扫描线调用一次
    public override notifyscanline(_scanline: number): void {

        // 每扫描线约113.67 CPU cycles
        this.clockIRQ(114)

        // FDS磁盘寻址IRQ处理 - 注意：不要与Disk IRQ冲突
        if (this.diskSeekIrq > 0) {
            this.diskSeekIrq -= 114
            if (this.diskSeekIrq <= 0) {
                if (this.fdsRegs && this.fdsRegs[5] & 0x80) {

                    // 设置Disk Seek IRQ标志，但不立即设置CPU IRQ
                    // 让clockIRQ统一处理磁盘IRQ，避免冲突
                    this.diskTimerIrq = true
                }
            }
        }

        // Timer IRQ处理
        if (this.irqEnabled && this.irqCounter > 0) {
            this.irqCounter--
            if (this.irqCounter <= 0) {
                if (this.cpu) {
                    this.cpu.interrupt |= 0x04 // IRQ_MAPPER
                }
                if (this.irqRepeat) {
                    this.irqCounter = this.irqReload
                }
                else {
                    this.irqEnabled = false
                }
            }
        }
    }
}
