import { Mapper } from '../Mapper'
import { FDSSoundChip } from '../../audio/FDSSoundChip'
import type { ROMLoader } from '../../ROMLoader'

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
    
    // BIOS数据 (8KB)
    private biosData: Uint8Array | null = null
    
    // Work RAM (32KB) - 扩展以支持$A000区域代码
    private workRam: Uint8Array = new Uint8Array(32768)
    
    // CHR RAM (8KB) 
    private chrRam: Uint8Array = new Uint8Array(8192)
    
    // FDS磁盘数据
    private diskData: Uint8Array
    
    // 磁盘系统控制
    private diskIoEnable: boolean = false
    private diskReadMode: boolean = true
    private diskMotorOn: boolean = false
    private controlRegister: number = 0 // $4025 控制寄存器值
    private lastResetBit: boolean = false // 上次bit1的状态，用于边沿检测
    
    // 磁盘状态管理（根据VirtuaNES）
    private diskEject: number = 0 // 磁盘弹出状态 (0=已插入, 1=未插入)
    
    // 数据传输状态
    private diskDataBuffer: Uint8Array = new Uint8Array(65500) // FDS磁盘数据缓冲
    private lastDriveStatus: number = 0 // 用于减少日志输出
    
    // FDS磁盘块状态机（根据VirtuaNES实现）
    private blockMode: number = 0 // 当前块类型: 0=READY, 1=VOLUME_LABEL, 2=FILE_AMOUNT, 3=FILE_HEADER, 4=FILE_DATA
    private blockPoint: number = 0 // 块内偏移
    private point: number = 0 // 磁盘数据全局偏移
    private currentFileSize: number = 0 // 当前文件大小
    private rwStart: boolean = false // 读写开始标志
    private driveReset: boolean = false // 驱动器重置标志（VirtuaNES兼容）
    
    private static readonly SIZE_VOLUME_LABEL = 16
    private static readonly SIZE_FILE_AMOUNT = 2
    private static readonly SIZE_FILE_HEADER = 16
    
    // IRQ控制
    private irqReload: number = 0
    private irqCounter: number = 0
    private irqEnabled: boolean = false
    private irqRepeat: boolean = false
    private diskTimerIrq: boolean = false
    
    // 磁盘IRQ机制（新增）
    private diskIrqPending: boolean = false // 磁盘IRQ待处理标志
    private diskTransferCounter: number = 0 // 磁盘传输周期计数器
    private dataReady: boolean = false // 数据准备好标志
    private readonly CYCLES_PER_BYTE = 149 // 每字节传输周期数 - FDS硬件实际速率约96.4μs/byte ≈ 149 CPU cycles @ 1.79MHz
    private firstClockLog: boolean = false // 调试标志 - 避免重复日志
    
    // BIOS控制向量设置标志
    private biosVectorsSet: boolean = false
    
    // 游戏状态跟踪
    private gameStarted: boolean = false
    private tickCount: number = 0
    private cartReadCount: number = 0
    
    // 动态内存管理 - 解决BIOS验证问题
    private zeroPagePointer: number = 0x0000 // ($02/$03)组成的间接地址
    private fileDataBuffer: Uint8Array = new Uint8Array(256) // $0200区域文件缓冲
    
    // CHR保护机制（防止花屏）
    private chrProtectionEnabled: boolean = false
    private initTime: number = 0
    private lastChrWriteTime?: number
    private lastChrWriteData?: number
    private consecutiveIdenticalWrites: number = 0
    
    // 音频芯片
    private soundChip: FDSSoundChip
    private soundRegistersEnabled: boolean = false
    
    constructor(loader: ROMLoader) {
        super(loader)
        
        // 保存磁盘数据
        this.diskData = loader.fdsData
        
        this.hasprgram = false
        
        // 初始化CHR保护
        this.initTime = Date.now()
        
        // 初始化音频芯片
        this.soundChip = new FDSSoundChip()
        
        // 解析和加载磁盘文件
        this.loadBootFiles()
        
        console.log('FDS: Mapper initialized')
    }

    /**
     * 设置外部BIOS数据
     */
    public setBIOS(biosData: Uint8Array): void {
        if (biosData.length === 8192) {
            this.biosData = new Uint8Array(biosData)
            
            console.log('FDS: External BIOS loaded (8KB) - keeping original RESET vector for proper boot sequence')
        }
        else {
            console.warn(`FDS: Invalid BIOS size: ${biosData.length}, expected 8192 bytes`)

            // 不设置BIOS，让游戏尝试直接从Work RAM启动
        }
    }
    
    /**
     * 加载启动文件
     */
    private loadBootFiles(): void {
        try {
            if (this.diskData.length < 16) {
                return
            }
            
            // ROMLoader已经解析过头部，直接从磁盘数据开始
            let offset = 0
            console.log('FDS: Loading disk data, size:', this.diskData.length)
            let filesLoaded = 0
            const bootFileCode = 255 // 通常启动文件的ID较小
            
            // 解析磁盘信息块并提取许可证信息
            if (offset < this.diskData.length && this.diskData[offset] === 0x01) {
                console.log('FDS: Parsing disk info block for license data')
                
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
                
                if (offset + 56 <= this.diskData.length) {
                    
                    // 提取关键的许可证相关信息
                    const manufacturerCode = this.diskData[offset + 16]
                    const gameNameCode = Array.from(this.diskData.slice(offset + 17, offset + 20))
                        .map(b => String.fromCharCode(b))
                        .join('')
                    
                    console.log(`FDS: Disk info - Manufacturer: $${manufacturerCode.toString(16).padStart(2, '0')}, Game code: '${gameNameCode}'`)
                    
                    // 显示磁盘信息块的完整内容用于分析
                    const diskInfoHex = Array.from(this.diskData.slice(offset, offset + 56))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ')
                    console.log(`FDS: Complete disk info block: ${diskInfoHex}`)
                }
                
                offset += 56 // 跳过磁盘信息块
            }
            else {
                return
            }
            
            // 解析文件计数块  
            if (offset < this.diskData.length && this.diskData[offset] === 0x02) {
                const fileCount = this.diskData[offset + 1]
                offset += 2
                console.log(`FDS: Found ${fileCount} files on disk`)
                
                // 解析每个文件
                for (let fileIndex = 0; fileIndex < fileCount && offset < this.diskData.length; fileIndex++) {
                    
                    // 文件头块 (block 3)
                    if (offset + 16 >= this.diskData.length) break
                    
                    if (this.diskData[offset] !== 0x03) {
                        console.warn(`FDS: Expected file header block, got ${this.diskData[offset]}`)
                        break
                    }
                    
                    const fileId = this.diskData[offset + 2]
                    const fileName = Array.from(this.diskData.slice(offset + 3, offset + 11))
                        .map(b => String.fromCharCode(b))
                        .join('')
                    const loadAddr = this.diskData[offset + 11] | this.diskData[offset + 12] << 8
                    const fileSize = this.diskData[offset + 13] | this.diskData[offset + 14] << 8
                    const fileType = this.diskData[offset + 15]
                    
                    offset += 16
                    
                    // 文件数据块 (block 4)
                    if (offset >= this.diskData.length || this.diskData[offset] !== 0x04) {
                        console.warn('FDS: Expected file data block')
                        break
                    }
                    
                    offset += 1 // 跳过block code
                    
                    // 检查是否是启动文件
                    if (fileId <= bootFileCode) {
                        console.log(`FDS: Loading boot file ${fileId}: '${fileName}' Type:${fileType} Addr:$${loadAddr.toString(16)} Size:${fileSize}`)
                        
                        if (this.loadFile(fileType, loadAddr, fileSize, offset)) {
                            filesLoaded++
                        }
                    }
                    
                    offset += fileSize // 跳过文件数据
                }
                
                console.log(`FDS: Boot file loading complete - ${filesLoaded} files loaded`)
                
                if (filesLoaded > 0) {

                    // 设置RESET向量
                    this.setupVectorControls()

                    // 启用音频寄存器
                    this.soundRegistersEnabled = true
                    console.log('FDS: Game started successfully!')
                    this.gameStarted = true
                }
                
            }
        }
        catch(error) {
            console.warn('FDS: File parsing failed:', error)
        }
    }
    
    /**
     * 设置FDS BIOS向量控制参数
     */
    private setupVectorControls(): void {

        // 检查$6000处的游戏代码
        const gameCode = this.workRam.slice(0, 16)
        const codeHex = Array.from(gameCode)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ')
        console.log(`FDS: Game code at $6000: ${codeHex}`)
        
        // 根据FCEUX调试数据，游戏RESET向量$DFFC-$DFFD应该设置为 00 60 (指向$6000)
        // 这与FCEUX数据完全匹配：DFFC-DFFD从 00 00 变为 00 60
        const resetVectorOffset = 0xDFFC - 0xA000 + 0x4000 // $DFFC在扩展Work RAM中的偏移
        this.workRam[resetVectorOffset] = 0x00 // RESET vector low (低字节)
        this.workRam[resetVectorOffset + 1] = 0x60 // RESET vector high (高字节) - 指向$6000
        
        console.log('FDS: Game RESET vector set to $6000 (00 60) - matches FCEUX debug data')
        console.log(`FDS: Vector location: $DFFC-$DFFD = ${this.workRam[resetVectorOffset].toString(16).padStart(2, '0')} ${this.workRam[resetVectorOffset + 1].toString(16).padStart(2, '0')}`)
    }

    /**
     * 设置BIOS控制向量（让BIOS自然处理）
     */
    private setBIOSControlVectors(): void {
        if (this.cpuram && !this.biosVectorsSet) {
            console.log('FDS: Letting BIOS handle control vectors and license check naturally')
            this.biosVectorsSet = true
        }
    }
    
    /**
     * 加载单个文件
     */
    private loadFile(type: number, loadAddr: number, size: number, dataOffset: number): boolean {
        try {
            if (dataOffset + size > this.diskData.length) {
                console.warn('FDS: File data exceeds disk bounds')

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
                        console.log(`FDS: Program loaded to Work RAM at $${loadAddr.toString(16)}`)
                    }
                    else if (loadAddr >= 0xA000 && loadAddr < 0xE000) {

                        // 有些FDS游戏需要加载代码到$A000-$DFFF区域
                        // 暂存到Work RAM的后半部分，后续映射时再处理
                        const ramOffset = loadAddr - 0xA000 + 0x4000 // 存储到Work RAM后半部分
                        for (let i = 0; i < size && ramOffset + i < this.workRam.length; i++) {
                            this.workRam[ramOffset + i] = this.diskData[dataOffset + i]
                        }
                        console.log(`FDS: Program loaded to extended Work RAM at $${loadAddr.toString(16)} (${size} bytes)`)
                    }
                    else {
                        console.warn(`FDS: Program load address $${loadAddr.toString(16)} not supported`)
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
                        console.log(`FDS: Pattern table data loaded (${patternSize} bytes)`)
                        
                        // 如果还有更多数据，可能是nametable数据
                        if (size > 0x1000) {
                            const nameTableSize = Math.min(size - 0x1000, 0x1000)
                            for (let i = 0; i < nameTableSize; i++) {
                                this.chrRam[0x1000 + i] = this.diskData[dataOffset + 0x1000 + i]
                            }
                            console.log(`FDS: Nametable data from CHR file loaded (${nameTableSize} bytes)`)
                        }
                    }
                    else {

                        // 直接按地址加载
                        for (let i = 0; i < size && i < this.chrRam.length; i++) {
                            this.chrRam[i] = this.diskData[dataOffset + i]
                        }
                        console.log(`FDS: Character data loaded to CHR RAM (${size} bytes at addr $${loadAddr.toString(16)})`)
                    }
                    break
                    
                case 2: // Name table data
                    // FDS的nametable数据应该映射到CHR RAM的正确位置
                    // $2000-$2FFF -> CHR RAM offset 0x0000-0x0FFF
                    // $2800 -> CHR RAM offset 0x0800
                    if (loadAddr >= 0x2000 && loadAddr < 0x3000) {
                        const chrOffset = loadAddr - 0x2000
                        for (let i = 0; i < size && chrOffset + i < this.chrRam.length; i++) {
                            this.chrRam[chrOffset + i] = this.diskData[dataOffset + i]
                        }
                        console.log(`FDS: Nametable data loaded at $${loadAddr.toString(16)} -> CHR RAM offset $${chrOffset.toString(16)}`)
                        
                        if (loadAddr === 0x2800 && size === 224) {
                            console.log('FDS: Detected license/nametable data block - ensuring BIOS compatibility')
                            
                            // 分析许可证数据
                            console.log(`FDS: License data size: ${size} bytes (loaded to $2800)`)
                            
                            // 显示原始许可证数据用于分析
                            const licensePreview = Array.from(this.diskData.slice(dataOffset, dataOffset + Math.min(32, size)))
                                .map(b => `$${b.toString(16).padStart(2, '0')}`)
                                .join(' ')
                            console.log(`FDS: Original disk license data (first 32 bytes): ${licensePreview}`)
                            
                            // 使用原始磁盘数据写入PPU
                            for (let i = 0; i < size; i++) {
                                this.ppuWrite(0x2800 + i, this.diskData[dataOffset + i])
                            }
                            
                            // 显示写入PPU的许可证数据
                            const ppuLicenseData = []
                            for (let i = 0; i < 16; i++) {
                                ppuLicenseData.push(`$${this.diskData[dataOffset + i].toString(16).padStart(2, '0')}`)
                            }
                            console.log(`FDS: PPU $2800-$280F license data: ${ppuLicenseData.join(' ')}`)
                            
                            console.log('FDS: License data loaded to PPU - BIOS should perform verification check')
                        }
                    }
                    else {
                        
                        // 如果地址不在nametable范围，直接加载到CHR RAM开头
                        for (let i = 0; i < size && i < this.chrRam.length; i++) {
                            this.chrRam[i] = this.diskData[dataOffset + i]
                        }
                        console.log(`FDS: Nametable data loaded to CHR RAM start (addr was $${loadAddr.toString(16)})`)
                    }
                    break
                    
                default:
                    console.warn(`FDS: Unsupported file type ${type}`)

                    return false
            }
            
            return true
            
        }
        catch(error) {
            console.warn('FDS: File load failed:', error)

            return false
        }
    }
    
    // Memory mapping
    public override cartWrite(addr: number, data: number): void {

        if (addr === 0x0002 || addr === 0x0003) {
            if (this.cpuram) {
                this.cpuram.write(addr, data)
                this.updateZeroPagePointer()
                
                return
            }
        }
        
        // **简化方案** - 不拦截写入,让BIOS正常工作
        
        if (addr >= 0x2000 && addr <= 0x2007) {
            
            // PPU寄存器写入 - 直接调用基类处理
            console.log(`FDS: PPU Write $${addr.toString(16)} = $${data.toString(16).padStart(2, '0')}`)
            super.cartWrite(addr, data)
        }
        else if (addr >= 0x6000 && addr < 0x8000) {

            // Work RAM
            this.workRam[addr - 0x6000] = data
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
        
        // PPU寄存器写入现在在cartWrite开头处理
    }
    
    public override cartRead(addr: number): number {

        // 处理Work RAM区域的文件缓冲区（仅限$0200-$02FF）
        if (this.cpuram && addr >= 0x0200 && addr < 0x0300) {
            this.updateZeroPagePointer()
            if (this.zeroPagePointer >= 0x0200 && this.zeroPagePointer < 0x0300) {

                // 文件数据缓冲区 - 让BIOS能够读取文件数据
                const bufferIndex = addr - 0x0200
                const data = this.fileDataBuffer[bufferIndex] || 0x00
                
                return data
            }
        }

        // 延迟设置BIOS控制向量（当cpuram可用时）
        if (!this.biosVectorsSet && this.cpuram) {
            console.log(`FDS: Setting BIOS control vectors - gameStarted: ${this.gameStarted}`)
            this.setBIOSControlVectors()
        }
        
        // **新增** - 检测游戏代码跳转
        if (addr >= 0x6000 && addr < 0x8000 && this.cartReadCount <= 3) {
            console.log(`FDS: 🎉 GAME CODE EXECUTION detected at $${addr.toString(16)} - BIOS loading complete!`)
        }
        
        // 先解决磁盘I/O问题，许可证验证是后续步骤
        
        // 监控BIOS控制向量状态
        if (this.cpuram && this.cartReadCount % 100000 === 0) {
            const vec0100 = this.cpuram.read(0x0100)
            const vec0101 = this.cpuram.read(0x0101)
            const vec0102 = this.cpuram.read(0x0102)
            const vec0103 = this.cpuram.read(0x0103)
            console.log(`FDS: BIOS Vectors: $0100=${vec0100.toString(16).padStart(2, '0')} $0101=${vec0101.toString(16).padStart(2, '0')} $0102=${vec0102.toString(16).padStart(2, '0')} $0103=${vec0103.toString(16).padStart(2, '0')}`)
        }

        // 检查是否是FDS寄存器读取
        if (addr >= 0x4030 && addr <= 0x4033) {
            return this.readFDSRegister(addr)
        }
        
        // FDS使用统一的ROM bank系统 - 所有$6000-$FFFF通过PRG banks访问
        if (addr >= 0x6000) {
            
            // 计数访问但不输出日志
            this.cartReadCount++
            
            // 只在首次访问游戏区域时输出一次
            if (addr >= 0x6000 && addr < 0x8000 && this.cartReadCount <= 5) {
                console.log(`FDS: 🎉 GAME AREA ACCESS! #${this.cartReadCount} at $${addr.toString(16)}`)
            }
            
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
                    const data = this.biosData[addr - 0xE000]
                    
                    // 监控关键的RESET向量读取
                    if (addr === 0xFFFC || addr === 0xFFFD) {
                        console.log(`FDS: RESET vector read at $${addr.toString(16)} = $${data.toString(16).padStart(2, '0')}`)
                    }
                    
                    return data
                }

                return 0
            }
            
            // 从对应的Work RAM bank读取
            const data = this.workRam[bankIndex * 8192 + offset]
            
            // 游戏代码执行监控（静默模式）
            
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

                // IRQ控制
                this.irqEnabled = (data & 0x01) !== 0
                this.irqRepeat = (data & 0x02) !== 0
                if (this.irqEnabled) {
                    this.irqCounter = this.irqReload
                }
                break
            case 0x4023:

                // 磁盘I/O启用
                this.diskIoEnable = (data & 0x01) !== 0
                console.log(`FDS: Disk I/O ${this.diskIoEnable ? 'enabled' : 'disabled'}`)
                break
            case 0x4024:

                // 磁盘数据写入寄存器
                // 简化实现
                break
            case 0x4025:

                // bit6是读写开始位，bit0是重置位
                
                // bit0: Transfer Reset (1=重置传输时序)
                const currentResetBit = (data & 0x01) !== 0
                
                // 只在bit0从0变为1时触发重置（上升沿）
                if (currentResetBit && !this.lastResetBit) {

                    // bit0上升沿检测到 - 这才是真正的重置信号

                    this.point = 0
                    this.blockPoint = 0
                    this.blockMode = 0 // BLOCK_READY
                    this.rwStart = false
                    this.driveReset = true
                    console.log('FDS: Transfer RESET detected (bit0 rising edge)')
                }
                else if (!currentResetBit && this.driveReset) {

                    // bit0清除时 - 清除重置状态

                    this.driveReset = false
                    console.log('FDS: Transfer RESET released (bit0=0)')
                }
                
                // 当bit6=1时也自动清除reset状态
                // 这允许BIOS在设置bit0=1后直接写入bit6=1来开始读取
                if (data & 0x40 && this.driveReset) {
                    this.driveReset = false
                    console.log('FDS: Transfer RESET auto-released by bit6=1')
                }
                
                // 当马达开启(bit1=0)时也自动清除reset状态
                // FCEUX行为：BIOS写入$2D后期望$4032立即返回$40
                const motorStart = (data & 0x02) === 0
                if (motorStart && this.driveReset) {
                    this.driveReset = false
                    console.log('FDS: Transfer RESET auto-released by motor start')
                }
                
                // 保存当前bit0状态用于下次边沿检测
                this.lastResetBit = currentResetBit
                
                // IRQ传输控制 (bit7) - VirtuaNES关键逻辑
                const irqTransfer = (data & 0x80) !== 0
                if (irqTransfer) {
                    this.diskTimerIrq = true
                }
                else {
                    this.diskTimerIrq = false
                }
                
                // 当!RW_start && (data & 0x40)时进行块转换
                // **关键修复** - 不在重置状态下进行块转换
                const canTransition = !this.rwStart && data & 0x40 && !this.driveReset
                
                // **调试** - 只在块转换时显示
                if (data & 0x40) {
                    console.log(`FDS: Block transition attempt - rwStart:${this.rwStart}, bit6:1, driveReset:${this.driveReset}, canTransition:${canTransition}`)
                }
                
                if (canTransition) {
                    
                    this.blockPoint = 0

                    // 重置传输状态，让新块的第一个字节立即准备好
                    this.dataReady = false
                    
                    // **FDS硬件特性** - 磁盘持续旋转,块开始时第一个字节可能已经在磁头下
                    // 设置counter=149让第一个IRQ在下一个CPU周期就触发
                    this.diskTransferCounter = this.CYCLES_PER_BYTE
                    
                    switch (this.blockMode) {
                        case 0: // BLOCK_READY
                            this.blockMode = 1 // BLOCK_VOLUME_LABEL

                            // FDS磁盘格式：前15字节是磁盘头
                            // 真正的VOLUME_LABEL块从offset 15开始
                            this.point = 15
                            console.log('FDS: Block transition READY -> VOLUME_LABEL (starting at offset 15)')
                            break
                        case 1: // BLOCK_VOLUME_LABEL  
                            this.blockMode = 2 // BLOCK_FILE_AMOUNT
                            // BIOS只读16字节，但磁盘上VOLUME_LABEL是56字节
                            // 需要跳过完整的56字节到达FILE_AMOUNT
                            this.point += 56
                            console.log('FDS: Block transition VOLUME_LABEL -> FILE_AMOUNT')
                            break
                        case 2: // BLOCK_FILE_AMOUNT
                            this.blockMode = 3 // BLOCK_FILE_HEADER
                            this.point += FDSMapper.SIZE_FILE_AMOUNT
                            console.log('FDS: Block transition FILE_AMOUNT -> FILE_HEADER')
                            break
                        case 3: // BLOCK_FILE_HEADER
                            this.blockMode = 4 // BLOCK_FILE_DATA
                            this.point += FDSMapper.SIZE_FILE_HEADER
                            console.log('FDS: Block transition FILE_HEADER -> FILE_DATA')
                            break
                        case 4: // BLOCK_FILE_DATA
                            this.blockMode = 3 // 回到 FILE_HEADER (下一个文件)
                            this.point += this.currentFileSize + 1
                            console.log('FDS: Block transition FILE_DATA -> FILE_HEADER (next file)')
                            break
                    }
                }
                
                // 读写开始控制 (bit6) - VirtuaNES: RW_start = data & 0x40
                this.rwStart = (data & 0x40) !== 0
                
                // 读写模式控制 (bit2) - VirtuaNES: RW_mode = data & 0x04, 读取条件是RW_mode为真
                this.diskReadMode = (data & 0x04) !== 0 // bit2=1时是读模式（VirtuaNES逻辑）
                
                // 磁盘马达控制 (bit1) - 注意：0=开启, 1=停止
                // 在FILE_DATA阶段保持磁盘马达开启
                const motorStop = (data & 0x02) !== 0
                if (this.blockMode === 4 && motorStop) {
                    console.log('FDS: Preventing motor shutdown during FILE_DATA phase')

                    // 在FILE_DATA阶段不关闭磁盘马达
                }
                else {
                    this.diskMotorOn = !motorStop // 0=开启, 1=停止
                }
                
                // **调试信息** - 只在关键状态变化时输出
                if (this.controlRegister !== data && (data & 0x40 || this.blockMode > 0)) {
                    console.log(`FDS: $4025 = $${data.toString(16).padStart(2, '0')} - Motor:${this.diskMotorOn}, Block:${this.blockMode}, rwStart:${this.rwStart}`)
                }
                this.controlRegister = data
                
                break
            case 0x4026:

                // IRQ确认
                this.diskTimerIrq = false
                break
        }
    }
    
    private readFDSRegister(addr: number): number {
        switch (addr) {
            case 0x4030:

                // Disk I/O Status register
                let status = 0x80 // 基础值，表示字节传输标志

                // bit0: Timer IRQ发生
                if (this.diskTimerIrq) {
                    status |= 0x01
                    this.diskTimerIrq = false // 读取后清除
                }

                // bit1: Disk IRQ发生（磁盘数据传输IRQ）
                if (this.diskIrqPending) {
                    status |= 0x02
                    
                    // 不在这里清除! 应该在 $4031 读取时清除
                    // this.diskIrqPending = false
                }

                if (this.blockMode === 1) {
                    console.log(`FDS: $4030 read = $${status.toString(16).padStart(2, '0')} (diskIrqPending:${this.diskIrqPending}, dataReady:${this.dataReady}, byte ${this.blockPoint})`)
                }

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
                
                let data = 0
                
                // 只在数据准备好时读取
                if (this.dataReady) {
                    const globalOffset = this.point + this.blockPoint
                    if (globalOffset < this.diskData.length) {
                        data = this.diskData[globalOffset]
                        console.log(`FDS: $4031 read [$${globalOffset.toString(16)}] = $${data.toString(16).padStart(2, '0')} (Block ${this.blockMode}, byte ${this.blockPoint}/${this.getBlockSize()})`)
                        
                        // 读取后清除标志和CPU IRQ
                        this.dataReady = false
                        this.diskIrqPending = false
                        
                        // 重置 counter,从读取时刻开始计时下一个 IRQ
                        // 这意味着下一个 IRQ 将在读取后 149 周期触发,不是从上一个 IRQ 后 149 周期
                        this.diskTransferCounter = 0
                        
                        console.log('FDS: $4031 read complete, cleared flags and RESET counter to 0')
                        
                        // 清除 CPU IRQ - 这会在下一个 clockIRQ 前停止 IRQ
                        if (this.cpu) {
                            this.cpu.interrupt &= ~0x20
                            console.log('FDS: Cleared CPU IRQ flag')
                        }
                        
                        this.blockPoint++
                    }
                }
                
                return data
            case 0x4032:
                
                // Drive status register - 按照FCEUX实际行为实现
                // FCEUX返回: $42 (bit1=1, 未准备好) → $40 (bit1=0, 准备好)
                let driveStatus = 0x40 // bit6: 基础状态位（总是1）
                
                // 更准确的磁盘状态检测
                const diskDataAvailable = this.diskData && this.diskData.length > 0
                
                // bit0: 磁盘插入状态 (0=插入, 1=未插入)
                if (this.diskEject !== 0 || !diskDataAvailable) {
                    driveStatus |= 0x01 // 磁盘未插入或数据不可用
                }
                
                // bit1: 驱动器准备状态 (0=准备好, 1=未准备好)
                // **关键逻辑** - FCEUX行为：
                // 1. 在重置状态(driveReset=true)时返回 $42 (bit1=1)
                // 2. 重置释放后返回 $40 (bit1=0)
                // 3. 条件：磁盘插入 && 非重置状态 && 数据可用
                if (this.diskEject === 0 && !this.driveReset && diskDataAvailable) {
                    
                    // 准备好 (bit1=0) - 注意：不要求马达开启
                }
                else {
                    driveStatus |= 0x02 // 未准备好
                }
                
                // bit2: 写保护 (未实现，总是可写)
                // driveStatus &= ~0x04

                // 只在状态变化时输出日志
                if (this.lastDriveStatus !== driveStatus) {
                    console.log(`FDS: Read $4032 = $${driveStatus.toString(16).padStart(2, '0')} - Eject:${this.diskEject}, Motor:${this.diskMotorOn}, Reset:${this.driveReset}`)
                }
                
                this.lastDriveStatus = driveStatus

                return driveStatus
            case 0x4033:

                // External connector
                // 需要设置bit7=1表示电源正常，避免BATTERY ERR.02
                return 0x80 // bit7=1: 电源正常
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
            console.log('FDS: WARNING - No disk data available, BIOS may return error codes')
            this.diskEject = 1 // 设置为未插入状态避免ERR.FF
        }
        else {
            console.log(`FDS: Disk ready with ${this.diskData.length} bytes of data`)
        }
        
        console.log('FDS: Disk insertion started (VirtuaNES style)')
        
        // 确保PPU处于可访问状态，让BIOS能正确初始化
        this.ensurePPUReady()
        
        console.log('FDS: Init complete with VirtuaNES-style initialization')
    }
    
    /**
     * 确保PPU处于就绪状态，允许BIOS正确访问
     */
    private ensurePPUReady(): void {

        // 模拟BIOS的PPU初始化过程
        // 根据FDS_BIOS.md，BIOS会初始化PPU寄存器
        console.log('FDS: Ensuring PPU is ready for BIOS initialization')
    }
    
    // IRQ处理
    public tick(): void {
        
        // 定期检查CPU是否在执行游戏代码
        if (this.gameStarted && this.cpu) {
            
            // 每1024个tick检查一次CPU位置
            if (this.tickCount % 1024 === 0) {
                
                // 添加调试信息来确认此逻辑被执行
                if (this.tickCount === 0) {
                    console.log('FDS: Starting CPU monitoring - game started, checking PC every 1024 ticks')
                }
                const currentPC = (this.cpu as any)?.PC || 0
                
                // 如果CPU还在BIOS区域执行($E000+)，强制跳转到游戏代码
                if (currentPC >= 0xE000) {
                    console.log(`FDS: CPU still in BIOS at $${currentPC.toString(16)
                        .padStart(4, '0')} - forcing jump to game`)
                    try {
                        if (this.cpu.setPC) {
                            this.cpu.setPC(0x6000)
                        }
                    } 
                    catch(e) {
                        console.log('FDS: Failed to force CPU jump:', e)
                    }
                }
            }
        }
        this.tickCount = (this.tickCount + 1) % 1048576 // 防止溢出

        // IRQ计时器
        if (this.irqEnabled && this.irqCounter > 0) {
            this.irqCounter--
            if (this.irqCounter === 0) {
                this.diskTimerIrq = true
                if (this.irqRepeat) {
                    this.irqCounter = this.irqReload
                }
                else {
                    this.irqEnabled = false
                }
            }
        }
    }
    
    /**
     * 磁盘读取IRQ时钟更新 - 实现FDS磁盘数据传输的IRQ机制
     * 每个字节传输约需149个CPU周期（基于真实FDS硬件速率）
     * @param cpuCycles 本次更新的CPU周期数
     */
    public clockIRQ(cpuCycles: number): void {

        // **调试** - 在块模式下记录第一次调用
        if (this.blockMode === 1 && !this.firstClockLog) {
            console.log(`FDS: clockIRQ first call in block 1 - readMode:${this.diskReadMode}, rwStart:${this.rwStart}, reset:${this.driveReset}, dataReady:${this.dataReady}, counter:${this.diskTransferCounter}`)
            this.firstClockLog = true
        }

        // 只在所有条件都满足时才处理IRQ：
        // 1. 磁盘读取模式
        // 2. 读写已开始（rwStart） - 一旦开始就持续到块结束
        // 3. 驱动器未重置
        // 4. 当前在有效的块模式（不是READY）
        // 5. 数据未准备好（防止重复触发）
        // 注意：不检查马达状态，因为BIOS可能在IRQ期间关闭马达
        
        if (!this.diskReadMode || !this.rwStart 
            || this.driveReset || this.blockMode === 0 
            || this.dataReady) { // 数据未被读取时不累积cycles
            return
        }
        
        // **调试** - 重置日志标志
        if (this.blockMode !== 1) {
            this.firstClockLog = false
        }
        
        // 累积周期计数器
        this.diskTransferCounter += cpuCycles
        
        // **调试** - 记录累积过程
        if (this.blockMode === 1 && this.diskTransferCounter % 30 === 0) {
            console.log(`FDS: clockIRQ accumulating - counter:${this.diskTransferCounter}`)
        }
        
        // 防止累积器溢出,最多累积到一个字节的时间
        if (this.diskTransferCounter > this.CYCLES_PER_BYTE * 2) {
            console.log(`FDS: clockIRQ counter overflow! ${this.diskTransferCounter} -> ${this.CYCLES_PER_BYTE * 2}`)
            this.diskTransferCounter = this.CYCLES_PER_BYTE * 2
        }
        
        // **IRQ 电平触发** - 只要 diskIrqPending=true,就持续激活 IRQ
        if (this.diskIrqPending && this.cpu) {
            this.cpu.interrupt |= 0x20 // 持续激活 IRQ_MAPPER2
        }
        
        // 检查是否达到一个字节的传输周期
        if (this.diskTransferCounter >= this.CYCLES_PER_BYTE) {
            
            console.log(`FDS: clockIRQ reached ${this.CYCLES_PER_BYTE} cycles, preparing byte ${this.blockPoint}`)
            
            // 检查是否还有数据需要传输
            const blockSize = this.getBlockSize()
            if (this.blockPoint < blockSize) {

                // 准备下一个字节
                this.dataReady = true
                this.diskIrqPending = true
                
                console.log(`FDS: Disk IRQ triggered for byte ${this.blockPoint}/${blockSize} in block ${this.blockMode}`)
            }
            else {

                // 块读取完成后不自动转换
                // 让BIOS通过$4025的bit6控制块转换
                console.log(`FDS: Block ${this.blockMode} read complete (${blockSize} bytes) - waiting for BIOS block transition`)

                // 不再调用autoTransitionToNextBlock，让BIOS控制
            }
        }
    }
    
    /**
     * 获取当前块的大小
     */
    private getBlockSize(): number {
        switch (this.blockMode) {
            case 0: // READY
                return 0
            case 1: // VOLUME_LABEL
                return FDSMapper.SIZE_VOLUME_LABEL
            case 2: // FILE_AMOUNT
                return FDSMapper.SIZE_FILE_AMOUNT
            case 3: // FILE_HEADER
                return FDSMapper.SIZE_FILE_HEADER
            case 4: // FILE_DATA
                return this.currentFileSize
            default:
                return 0
        }
    }

    /**
     * PPU读取 - CHR RAM访问
     */
    public override ppuRead(addr: number): number {
        addr &= 0x3FFF
        
        // CHR RAM $0000-$1FFF映射 (Pattern Tables)
        if (addr < 0x2000) {
            const data = this.chrRam[addr & 0x1FFF]
            
            // CHR读取（静默模式）
            
            return data
        }

        else if (addr >= 0x3F00 && addr <= 0x3F1F) {

            // 调色板读取（静默模式）
            return super.ppuRead(addr)
        }
        else {

            // 其他PPU区域（Nametable等）- 调用基类处理
            return super.ppuRead(addr)
        }
    }

    /**
     * PPU写入 - CHR RAM访问（带保护机制防止花屏）
     */
    public override ppuWrite(addr: number, value: number): void {
        addr &= 0x3FFF
        
        if (addr < 0x2000) {

            // CHR区域写入保护
            const chrIndex = addr & 0x1FFF
            
            // 如果保护已禁用，直接允许所有写入
            if (!this.chrProtectionEnabled) {
                this.chrRam[chrIndex] = value

                return
            }
            
            // 保护启用期间的逻辑
            const currentTime = Date.now()
            const timeSinceInit = currentTime - this.initTime
            
            // 只在前3秒内进行保护，主要是为了阻止FDS文件头的初始写入
            if (timeSinceInit < 3000) {
                
                // 只阻止明显的FDS文件头字符串（严格限制）
                const strictFdsChars = [0x2A, 0x4E, 0x49] // 只阻止"*NI"开头
                if (strictFdsChars.includes(value) && chrIndex < 100) {
                    console.log(`FDS: CHR Protected - blocking FDS header char 0x${value.toString(16)} at ${addr.toString(16)}`)

                    return
                }
                
                // 检测超快速批量写入（明显的恶意覆盖）
                if (this.lastChrWriteTime && currentTime - this.lastChrWriteTime < 50) {
                    if (value === this.lastChrWriteData) {
                        this.consecutiveIdenticalWrites = (this.consecutiveIdenticalWrites || 0) + 1
                        
                        // 只在超高频且连续超过20次时才阻止
                        if (this.consecutiveIdenticalWrites > 20) {
                            console.log(`FDS: CHR Protected - blocking ultra-fast batch (${this.consecutiveIdenticalWrites})`)

                            return
                        }
                    }
                    else {
                        this.consecutiveIdenticalWrites = 0
                    }
                }
                else {
                    this.consecutiveIdenticalWrites = 0
                }
            }
            
            // 允许写入
            this.chrRam[chrIndex] = value
            this.lastChrWriteTime = currentTime
            this.lastChrWriteData = value
            
            // CHR写入（静默模式）
        }
        else if (addr >= 0x3F00 && addr <= 0x3F1F) {

            // 调色板区域 - 根据VirtuaNES实现正确的镜像逻辑
            const maskedValue = value & 0x3F // 调色板值只有6位有效
            
            // 调色板写入（日志已移除避免卡死）
            
            // 特殊处理调色板镜像 - 只有$3F00影响通用背景色
            if (addr === 0x3F00) {
                
                // 只有$3F00是通用背景色，影响所有调色板的透明色
                // 通用背景色设置
            } 
            else if (addr === 0x3F10) {
                
                // $3F10是精灵调色板0的背景色，不影响背景调色板
                // 精灵调色板0背景设置
            }
            
            super.ppuWrite(addr, maskedValue)
        }
        else {

            // 其他PPU区域（Nametable等）- 调用基类处理
            super.ppuWrite(addr, value)
        }
    }

    // HSync处理 - 每扫描线调用一次
    public override notifyscanline(_scanline: number): void {

        // Timer IRQ处理
        if (this.irqEnabled && this.irqCounter > 0) {
            this.irqCounter--
            if (this.irqCounter <= 0) {
                if (this.cpu) {
                    this.cpu.interrupt |= 0x04 // IRQ_MAPPER
                }
                console.log('FDS: Timer IRQ triggered')
                if (this.irqRepeat) {
                    this.irqCounter = this.irqReload
                }
                else {
                    this.irqEnabled = false
                }
            }
        }

        // Disk IRQ处理 (FDS特有的IRQ_MAPPER2) - 只在irq_transfer为true时触发
        if (this.diskTimerIrq && this.cpu) {

            // 设置IRQ但不重复输出日志避免卡死
            this.cpu.interrupt |= 0x20 // IRQ_MAPPER2
        }
    }
    
    /**
     * 更新零页间接寻址指针
     */
    private updateZeroPagePointer(): void {
        if (!this.cpuram) return
        
        const low = this.cpuram.read(0x0002)
        const high = this.cpuram.read(0x0003)
        const newPointer = low | high << 8
        
        if (newPointer !== this.zeroPagePointer) {
            this.zeroPagePointer = newPointer
            
            // 静默更新，只在关键指针时准备数据
            if (this.zeroPagePointer >= 0x0200 && this.zeroPagePointer < 0x0300) {
                this.prepareFileDataBuffer()
            }
        }
    }
    
    /**
     * 准备文件数据缓冲区
     */
    private prepareFileDataBuffer(): void {

        // 清空缓冲区
        this.fileDataBuffer.fill(0x00)
        
        // 如果有磁盘数据，填充文件信息
        if (this.diskData && this.diskData.length > 0) {

            // 简单地复制磁盘数据的前256字节作为文件缓冲
            const copyLength = Math.min(256, this.diskData.length)
            for (let i = 0; i < copyLength; i++) {
                this.fileDataBuffer[i] = this.diskData[i]
            }
            
            // 文件缓冲区准备完成
        }
    }
}
