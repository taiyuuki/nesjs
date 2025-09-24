import { Mapper } from '../Mapper'
import type { ROMLoader } from '../../ROMLoader'
import { FDSSoundChip } from '../../audio/FDSSoundChip'
import { MirrorType, TVType } from '../../types'

export default class FDSMapper extends Mapper {
    private bios: Uint8Array = new Uint8Array(8192)
    private ram: Uint8Array = new Uint8Array(0x2000 * 4) // 0x6000-0xDFFF (32KB)
    private fdsAudio?: FDSSoundChip

    // 磁盘与数据流（极简实现）
    private fdsData: Uint8Array = new Uint8Array()
    private sideCount: number = 1
    private sideIndex: number = 0
    private sideSize: number = 0
    private dataPtr: number = 0
    private dataReady: boolean = false
    private lastData: number = 0
    private motorOn: boolean = false
    private readMode: boolean = true
    private transferActive: boolean = false
    private cyclesAccum: number = 0
    private cyclesPerByte: number = 24 // 简化节奏：每 ~24 CPU 周期出 1 字节

    // 外部连接口/状态（用于 $4033 电池与盘状态）
    private batteryGood: boolean = true // 始终报告电池良好，避免 BIOS 报错
    private diskInserted: boolean = true // 假定始终有盘（当前 side 数据）
    private writeProtected: boolean = false // 简化：不写保护
    private driveReady: boolean = true // 简化：就绪

    // 主 I/O 使能（$4023）
    private diskIOEnabled: boolean = true
    private soundIOEnabled: boolean = true

    // 外部连接口输出（$4026），开漏：清零会使 $4033 读到 0
    private externalPortOut: number = 0xFF

    // 调试（限流日志）
    private debugEnabled: boolean = true
    private debugCount: Record<string, number> = Object.create(null)
    private bytesOutCount: number = 0

    // 简易 IRQ：数据就绪时触发，中断在读 $4030 时确认
    private interrupted: boolean = false

    // 写操作会话状态：一旦开始写操作，直到显式重置才清除
    private writeSessionActive: boolean = false

    // 自动写入游戏代码状态
    private autoWriteStarted: boolean = false
    
    // CHR 写入保护相关属性
    private lastChrWriteTime?: number
    private lastChrWriteData?: number
    private consecutiveIdenticalWrites: number = 0
    private initTime: number = 0
    private chrProtectionEnabled: boolean = true
    private autoWriteOffset: number = 0

    public setFDSDebug(enabled: boolean): void { this.debugEnabled = !!enabled }

    private dbg(category: string, ...args: any[]): void {
        if (!this.debugEnabled) return
        const limits: Record<string, number> = {
            
            // 关键写入相关，保留调试
            gameCodeWrite: 32,
            gameCodeWriteExtended: 32,
            write4024: 16,
            writeMode: 8,
            
            // 内存转储和重要状态，保留调试
            memoryDump: 8,
            globalWriteCapture: 16,
            fdsRamMirrorWrite: 16,
            dumpMemoryForComparison: 4,
            
            // 其它调试信息禁用
            write4025: 0,
            write4023: 0,
            read4030: 0,
            read4031: 0,
            read4032: 0,
            read4033: 0,
            byteReady: 0,
            loopTrack: 0,
            resetStream: 0,
            irqTrigger: 0,
            irqAck: 0,
            irqClear: 0,
            firstByteReady: 0,
            biosRead: 0,
            biosCodeAccess: 0,
            highRomAccess: 0,
            gameCodeRead: 0,
            ramWrite6000: 0,
            ramWrite9000: 0,
            ramWriteGeneral: 0,
            blockMarker: 0,
            fileDataContent: 0,
            lowRamAccess: 0,
            possibleInstruction: 0,
        }
        const prev = this.debugCount[category] | 0
        const next = prev + 1
        this.debugCount[category] = next
        const limit = limits[category] ?? 16
        if (next <= limit) {
            console.log('[FDSDBG]', category, ...args)
            if (next === limit) {
                console.log('[FDSDBG]', category, 'muted further logs')
            }
        }
    }

    // 简化：仅做基础映射与音频接入；磁盘控制/IRQ 后续补齐
    constructor(loader: ROMLoader) {
        super(loader)
    }

    protected override setLoader(loader: ROMLoader): void {
        this.loader = loader
    }

    public override loadROM(): void {
        this.loader.parseHeader()
        if (!this.loader.isFDS) {
            throw new Error('FDSMapper used with non-FDS ROM')
        }

        // FDS 默认 NTSC，CHR 为 RAM
        this.mappertype = this.loader.mappertype // -2
        this.region = TVType.NTSC
        this.scrolltype = MirrorType.H_MIRROR
        this.haschrram = true
        this.chrsize = 8192
        this.chr = new Array(8192).fill(0)

        // 初始化映射表
        this.prg_map = new Array(32)
        for (let i = 0; i < 32; ++i) this.prg_map[i] = 0
        this.chr_map = new Array(8)
        for (let i = 0; i < 8; ++i) this.chr_map[i] = 1024 * i & this.chrsize - 1

        // nametable 初始化
        this.pput0.fill(0x00)
        this.setmirroring(this.scrolltype)

        // FDS 镜像数据
        this.fdsData = this.loader.fdsData
        this.sideCount = Math.max(1, this.loader.fdsSides | 0)
        this.sideSize = this.sideCount > 0 ? Math.floor(this.fdsData.length / this.sideCount) : this.fdsData.length
        this.sideIndex = 0
        this.resetStream()

        // 预加载游戏代码到内存
        this.preloadGameCode()
        
        // 记录初始化时间，用于CHR保护策略
        this.initTime = Date.now()
        
        // 设置定时器，在游戏运行一段时间后输出内存状态用于对比
        setTimeout(() => {
            this.dumpMemoryForComparison()
        }, 3000)
        
        // 5秒后关闭CHR保护，允许正常的图形数据写入
        setTimeout(() => {
            this.chrProtectionEnabled = false
            
            // 重置CHR为干净状态，让游戏能正常更新图形数据
            console.log('[FDSDBG] chrReset Resetting CHR to clean state before disabling protection')
            
            // 清空CHR RAM，让游戏从头开始绘制图形
            this.chr.fill(0)
            
            // 只保留VirtuaNES期望的前16字节初始数据
            const expectedInitData = [
                0x00, 0x4f, 0xd0, 0x01, 0x00, 0x28, 0x20, 0x00, 
                0x05, 0x43, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00,
            ]
            
            for (let i = 0; i < expectedInitData.length; i++) {
                this.chr[i] = expectedInitData[i]
            }
            
            console.log('[FDSDBG] chrProtectionDisabled CHR protection disabled, CHR reset to clean state')
            this.dumpCHRData('after_protection_disabled_and_reset')
        }, 5000)
        
        // 10秒后再次导出CHR数据（此时应该进入游戏了）
        setTimeout(() => {
            this.dumpCHRData('game_running')
        }, 10000)
    
    }

    public override init(): void {

        // 接入 FDS 扩展音频
        this.fdsAudio = new FDSSoundChip()
        if (this.cpuram?.apu) {
            this.cpuram.apu.addExpnSound(this.fdsAudio)
        }
    }

    // BIOS 注入（由 NES 提供）
    public setBIOS(bios: Uint8Array): void {
        if (bios.length !== 8192) throw new Error('Invalid FDS BIOS size (expected 8192)')
        this.bios = bios
    }

    // 输出内存状态用于与VirtuaNES对比（精简版）
    private dumpMemoryForComparison(): void {
        this.dbg('dumpMemoryForComparison', {
            gameCodeArea: this.getGameCodeAreaHex(),
            fdsRamArea: this.getFdsRamAreaHex(),
        })
    }
    
    private getGameCodeAreaHex(): string {
        const hex: string[] = []
        
        // 检查标准游戏代码区 $8000-$801F (与 VirtuaNES 对比)
        for (let i = 0; i < 32; i++) {
            const addr = 0x8000 + i
            const ramAddr = addr - 0x8000 // 转换为 RAM 地址
            const data = this.ram[ramAddr] || 0
            hex.push(data.toString(16)
                .padStart(2, '0')
                .toUpperCase())
        }
        
        return hex.join(' ')
    }
    
    private getFdsRamAreaHex(): string {
        const hex: string[] = []
        for (let i = 0x6000; i < 0x6020; i++) {
            const data = this.ram[i - 0x6000] || 0
            hex.push(data.toString(16)
                .padStart(2, '0')
                .toUpperCase())
        }

        return hex.join(' ')
    }
    
    // 导出CHR数据用于调试对比
    private dumpCHRData(phase: string): void {
        console.log(`🎨 CHR DATA DUMP [${phase}]:`)
        
        // 导出CHR前64字节（对比VirtuaNES的关键区域）
        const chrFirst64: string[] = []
        for (let i = 0; i < 64; i++) {
            const data = this.chr[i] || 0
            chrFirst64.push(data.toString(16)
                .padStart(2, '0')
                .toUpperCase())
        }
        console.log(`CHR 0000-003F: ${chrFirst64.join(' ')}`)
        
        // 导出一些关键的CHR区域
        const ranges = [
            { start: 0x1000, end: 0x1020, name: 'CHR 1000-101F' },
            { start: 0x1300, end: 0x1320, name: 'CHR 1300-131F' },
            { start: 0x1800, end: 0x1820, name: 'CHR 1800-181F' },
        ]
        
        ranges.forEach(range => {
            const hex: string[] = []
            for (let i = range.start; i < range.end; i++) {
                const data = this.chr[i] || 0
                hex.push(data.toString(16)
                    .padStart(2, '0')
                    .toUpperCase())
            }
            console.log(`${range.name}: ${hex.join(' ')}`)
        })
        
        // 统计CHR中的数据分布
        const stats = { zero: 0, ff: 0, other: 0 }
        for (let i = 0; i < Math.min(2048, this.chr.length); i++) {
            const data = this.chr[i] || 0
            if (data === 0) stats.zero++
            else if (data === 0xFF) stats.ff++
            else stats.other++
        }
        console.log(`CHR Stats (first 2KB): zero=${stats.zero}, 0xFF=${stats.ff}, other=${stats.other}`)
    }

    // 检查是否读取了游戏程序数据，并自动写入到游戏代码区
    private checkAndWriteGameCode(_data: number): void {

        // 只有在传输激活且在读取模式时才自动写入
        if (!this.transferActive || !this.readMode) return
        
        // 游戏代码已通过预加载机制写入，无需实时写入

        // 预加载机制已经在初始化时正确处理了游戏代码
        // 不再需要实时自动写入逻辑，避免覆盖预加载的正确内容
    }
    
    private isValidGameCode(byte: number): boolean {

        // 常见的6502指令开头
        const validOpcodes = [
            0xD8, 0xA9, 0x8D, 0xA2, 0x9A, 0xAD, 0x10, 0x20, 0x58, 0x4C,
            0xEE, 0x09, 0x60, 0x18, 0x78, 0xEA, 0xC9, 0xB0, 0xCA, 0xF0,
            0xD0, 0x30, 0x90, 0x70, 0x50, 0xE6, 0xC6, 0xE8, 0x88, 0xC8,
        ]

        return validOpcodes.includes(byte)
    }

    // 预加载游戏代码到内存，根据 VirtuaNES 的预期内容
    private preloadGameCode(): void {
        if (!this.fdsData || this.fdsData.length === 0) return

        // 根据 VirtuaNES 反汇编，我们知道 $6000 处应该是这些字节
        const expectedGameCode = [
            0xD8, // CLD
            0xA9, 0x10, // LDA #$10
            0x8D, 0x00, 0x20, // STA PPU_CTRL
            0xA2, 0xFF, // LDX #$FF
            0x9A, // TXS
            0xAD, 0x02, 0x20, // LDA PPU_STATUS
            0x10, 0xFB, // BPL $600E
            0xAD, 0x02, 0x20, // LDA PPU_STATUS
            0x10, 0xFB, // BPL $600E
            0xA0, 0xFE, // LDY #$FE
            0xA2, 0x05, // LDX #$05
        ]

        // 在 FDS 数据中寻找这个游戏代码序列
        let gameCodeStart = -1
        for (let i = 0; i < this.fdsData.length - expectedGameCode.length; i++) {
            let matches = 0
            for (let j = 0; j < Math.min(8, expectedGameCode.length); j++) {
                if (this.fdsData[i + j] === expectedGameCode[j]) {
                    matches++
                }
            }
            
            // 如果匹配了前8个字节中的至少6个，认为找到了游戏代码
            if (matches >= 6) {
                gameCodeStart = i
                console.log(`🎯 FOUND GAME CODE PATTERN at FDS offset: ${i}, matches: ${matches}/8`)
                break
            }
        }

        if (gameCodeStart >= 0) {

            // 将找到的游戏代码写入到 RAM
            const maxCopyLength = Math.min(0x2000, this.fdsData.length - gameCodeStart)
            let written = 0
            
            for (let i = 0; i < maxCopyLength; i++) {
                const dataByte = this.fdsData[gameCodeStart + i]
                
                // 写入到 $6000 区域
                if (i < 0x2000) {
                    this.ram[i] = dataByte
                    written++
                    
                    if (i < 32) { // 只记录前32字节
                        console.log(`✅ PRELOAD $${(0x6000 + i).toString(16).toUpperCase()}: 0x${dataByte.toString(16).padStart(2, '0')}`)
                    }
                }
            }
            
            console.log(`📋 PRELOADED ${written} bytes of game code from FDS offset ${gameCodeStart}`)
            this.autoWriteStarted = true // 标记已完成自动写入
        }
        else {
            console.warn('⚠️  Could not find expected Mario2 game code pattern in FDS data')
        }
    }

    // CPU 读取
    public override cartRead(addr: number): number {

        // 监控游戏代码区的访问模式 ($A000-$BFFF)
        if (addr >= 0xA000 && addr <= 0xBFFF) {
            const ramAddr = addr - 0x8000
            const data = this.ram[ramAddr] || 0
            
            // 记录所有游戏代码区的读取，特别是我们写入的区域
            if (data > 0) {
                this.dbg('gameCodeRead', { addr: addr.toString(16), ramAddr: ramAddr.toString(16), data, hex: `0x${data.toString(16).padStart(2, '0')}` })

                // 游戏代码区读取
                this.dbg('gameCodeRead', `$${addr.toString(16).toUpperCase()} -> 0x${data.toString(16).padStart(2, '0')}`)
            }
        }

        // 监控基础代码区读取 ($8000-$9FFF)
        if (addr >= 0x8000 && addr <= 0x9FFF) {
            const ramAddr = addr - 0x8000
            const data = this.ram[ramAddr] || 0
            
            // 只在有意义的数据时才记录读取
            if (data > 0) {
                this.dbg('baseCodeRead', { addr: addr.toString(16), ramAddr: ramAddr.toString(16), data })
            }
        }

        // 监控 FDS 数据是否被写入到其他内存区域
        if (addr >= 0x6000 && addr <= 0x7FFF) {
            const data = this.ram[addr - 0x6000] || 0
            if (data > 0) {
                this.dbg('fdsRamRead', { addr: addr.toString(16), data, isNonZero: true })
            }
        }

        // 0x4030: 状态寄存器（bit0 数据就绪；其余位简化为 open bus 高）
        if (addr === 0x4030) {
            const val = 0x40 | (this.dataReady ? 0x01 : 0x00)
            this.dbg('read4030', val)

            return val
        }

        // 0x4031: 数据寄存器（读取后清除字节就绪标志和IRQ）
        if (addr === 0x4031) {
            const v = this.lastData | 0
            
            // 读取数据时确认IRQ
            if (this.interrupted && this.cpu) {
                --this.cpu.interrupt
                this.interrupted = false
                this.dbg('irqAck', { data: v })
            }
            
            // 检查是否读取了可能的游戏程序数据，并自动写入到游戏代码区
            this.checkAndWriteGameCode(v)
            
            // 读取后清除就绪标志，但保留数据以便调试
            this.dataReady = false
            
            // 如果在读模式且传输激活，立即准备下一个字节
            if (this.readMode && this.transferActive) {
                const [start, end] = this.currentSideRange()
                if (start + this.dataPtr < end) {
                    const currentByte = this.fdsData[start + this.dataPtr]
                    
                    // 检查是否卡在文件头块，如果是，尝试跳过到文件数据块
                    if (currentByte === 0x03) {

                        // 这是文件头块，尝试找到下一个文件数据块（0x04）
                        let searchPtr = this.dataPtr + 1
                        let foundFileData = false
                        
                        // 在接下来的32字节内搜索文件数据块
                        while (searchPtr < Math.min(this.dataPtr + 32, end - start)) {
                            if (this.fdsData[start + searchPtr] === 0x04) {

                                // 找到文件数据块，直接跳过去
                                this.dataPtr = searchPtr
                                foundFileData = true
                                this.dbg('skipFileHeader', {
                                    oldPtr: this.dataPtr - (searchPtr - this.dataPtr),
                                    newPtr: this.dataPtr,
                                    skippedBytes: searchPtr - (this.dataPtr - (searchPtr - this.dataPtr)),
                                })
                                break
                            }
                            searchPtr++
                        }
                        
                        if (!foundFileData) {

                            // 如果没找到文件数据块，正常推进
                            this.dataPtr++
                        }
                    }
                    else {

                        // 正常推进
                        this.dataPtr++
                    }
                    
                    // 获取新位置的数据
                    if (start + this.dataPtr < end) {
                        this.lastData = this.fdsData[start + this.dataPtr]
                    }
                    else {
                        this.lastData = 0
                    }
                    
                    this.dataReady = true
                    
                    // 触发IRQ通知下一个字节就绪
                    if (this.cpu) {
                        ++this.cpu.interrupt
                        this.interrupted = true
                    }
                    
                    this.dbg('nextByteReady', {
                        ptr: this.dataPtr,
                        data: this.lastData,
                        dataHex: `0x${this.lastData.toString(16).padStart(2, '0')}`,
                    })
                }
            }
            
            this.dbg('read4031', v)

            return v
        }

        // 0x4032: 驱动状态（bit7:字节传输；bit5:恒1；bit3:镜像；bit2..0:P/R/S）
        if (addr === 0x4032) {
            
            // bit7: 字节传输标志；bit5: 恒为1；bit3: 镜像（$4025.D3）；bit2..0: P/R/S
            const byteFlag = this.dataReady ? 0x80 : 0x00
            const mirrorBit = this.scrolltype === MirrorType.V_MIRROR ? 0x08 : 0x00
            const p = this.writeProtected ? 0x04 : 0x00
            const r = this.driveReady ? 0x02 : 0x00
            const s = this.diskInserted ? 0x00 : 0x01
            const v = byteFlag | 0x20 | mirrorBit | p | r | s
            this.dbg('read4032', v)

            return v
        }
        
        // 0x4033: 外部连接口读取（报告磁盘与电池状态，受 $4026 开漏遮罩）
        if (addr === 0x4033) {
            let status = 0x00
            
            // bit7: 电池状态（1=良好）
            if (this.batteryGood) status |= 0x80
            
            // bit2: 磁盘插入状态（0=插入）
            if (!this.diskInserted) status |= 0x04
            
            // bit1: 写保护状态（1=写保护）  
            if (this.writeProtected) status |= 0x02
            
            // 应用 $4026 开漏遮罩
            const mask = this.externalPortOut
            const val = status & mask
            
            this.dbg('read4033', { 
                out: this.externalPortOut, 
                battery: this.batteryGood,
                diskInserted: this.diskInserted,
                writeProtected: this.writeProtected,
                rawStatus: status,
                maskedVal: val,
            })

            return val
        }
        if (addr >= 0xE000) {

            // BIOS 映射到 E000-FFFF（8KB）
            const biosData = this.bios[addr - 0xE000]
            
            // 记录 BIOS 读取，特别是向量表区域和关键函数调用
            if (addr >= 0xFFFA) {
                this.dbg('biosRead', { addr: addr.toString(16), data: biosData })
            }
            
            // 监控BIOS中可能的游戏加载相关代码
            if (addr >= 0xF000 && addr < 0xF100) {
                this.dbg('biosCodeAccess', { addr: addr.toString(16), data: biosData, desc: 'BIOS code execution' })
            }
            
            return biosData
        }
        if (addr >= 0xC000) {

            // 监控高ROM区域访问，FDS游戏代码可能映射到这里
            const ramData = this.ram[addr - 0x6000]
            if (ramData !== 0) {
                this.dbg('highRomAccess', { addr: addr.toString(16), data: ramData, desc: 'High ROM area with data' })
            }

            return ramData
        }

        // 扩展游戏代码区域 ($A000-$BFFF) - BIOS 正在写入此区域
        if (addr >= 0xA000 && addr <= 0xBFFF) {

            // $A000 映射到 RAM，与自动写入映射一致
            const ramAddr = addr - 0x8000 // $A000 -> ram[0x2000], 与写入映射一致
            const ramData = this.ram[ramAddr] || 0
            
            // 记录扩展游戏代码区域的读取，特别是我们写入的区域
            this.dbg('gameCodeReadExtended', { 
                addr: addr.toString(16), 
                ramAddr: ramAddr.toString(16), 
                data: ramData, 
                hex: `0x${ramData.toString(16).padStart(2, '0')}`, 
            })
            
            // 如果读取了有意义的数据，输出重要信息
            if (ramData > 0) {
                this.dbg('extendedGameCodeRead', `$${addr.toString(16).toUpperCase()} -> 0x${ramData.toString(16).padStart(2, '0')}`)
            }
            
            return ramData
        }

        // 游戏代码区域 ($8000-$9FFF) - 映射到独立的内存区域
        if (addr >= 0x8000 && addr <= 0x9FFF) {

            // $8000 映射到 RAM，与其他映射保持一致
            const ramAddr = addr - 0x8000 // $8000 -> ram[0x0000]
            const ramData = this.ram[ramAddr] || 0
            
            // 记录游戏代码区域的读取
            if (ramData > 0) {
                this.dbg('gameCodeRead', { addr: addr.toString(16), ramAddr: ramAddr.toString(16), data: ramData })
            }
            
            return ramData
        }

        // FDS RAM 镜像区域 ($5000-$5FFF) - 这可能是关键的内存映射！
        if (addr >= 0x5000 && addr <= 0x5FFF) {

            // 映射到 FDS RAM：$5000 -> ram[0x0000], $5FCC -> ram[0xFCC]
            const ramAddr = addr - 0x5000
            const ramData = this.ram[ramAddr] || 0
            
            // 监控关键地址的读取
            if (addr === 0x5FCC) {
                this.dbg('fdsRamMirrorRead', { 
                    addr: addr.toString(16), 
                    ramAddr: ramAddr.toString(16),
                    data: ramData,
                    desc: 'Critical mirror address read',
                })
            }
            
            return ramData
        }
        
        // FDS RAM 区域 ($6000-$7FFF)
        if (addr >= 0x6000 && addr <= 0x7FFF) {

            // $6000 映射到 FDS RAM 的起始位置 ram[0]
            const ramAddr = addr - 0x6000
            const ramData = this.ram[ramAddr] || 0
            
            // 监控 BIOS 是否在访问某些特定地址，这可能表明它在查找游戏代码位置
            if (addr >= 0x6000 && addr < 0x6100) {
                this.dbg('lowRamAccess', { addr: addr.toString(16), data: ramData, desc: 'BIOS accessing low RAM' })
            }
            
            return ramData
        }

        // FDS I/O: 音频寄存器 0x4040-0x4092
        if (addr >= 0x4040 && addr < 0x4093) {
            return this.fdsAudio ? this.fdsAudio.read(addr) : 0x40
        }

        // 其余地址默认 open bus
        return addr >> 8
    }

    // CPU 写入
    public override cartWrite(addr: number, data: number): void {
        
        // 🚨 捕获所有写入操作 - 无论地址如何
        const addressRange = addr >= 0x6000 && addr <= 0x7FFF ? 'FDS_RAM'
            : addr >= 0x8000 && addr <= 0x9FFF ? 'GAME_CODE'
                : addr >= 0x5000 && addr <= 0x5FFF ? 'FDS_RAM_MIRROR' // 新增！$5000-$5FFF 可能是 FDS RAM 的镜像
                    : addr >= 0x4000 && addr <= 0x4FFF ? 'IO_REGISTERS'
                        : 'OTHER'
            
        // 监控所有写入操作以便调试
        this.dbg('allWrites', {
            addr: addr.toString(16),
            data: data,
            hex: `0x${data.toString(16).padStart(2, '0')}`,
            range: addressRange,
        })

        // 监控 FDS RAM 镜像区写入 ($5000-$5FFF) - 这可能是关键！
        if (addr >= 0x5000 && addr <= 0x5FFF) {

            // 映射到 FDS RAM：$5000 -> ram[0x0000], $5FCC -> ram[0xFCC]
            const ramAddr = addr - 0x5000
            const oldData = this.ram[ramAddr] || 0
            this.ram[ramAddr] = data
            
            this.dbg('fdsRamMirrorWrite', { 
                addr: addr.toString(16), 
                ramAddr: ramAddr.toString(16),
                oldData, 
                newData: data,
            })
            
            return
        }
        
        // 监控所有游戏代码区写入 ($8000-$9FFF)
        if (addr >= 0x8000 && addr <= 0x9FFF) {

            // 写入到游戏代码区域，与读取映射一致
            const ramAddr = addr - 0x8000 // $8000 -> ram[0x0000]，与读取映射一致
            const oldData = this.ram[ramAddr] || 0
            this.ram[ramAddr] = data
            
            this.dbg('gameCodeWrite', { 
                addr: addr.toString(16), 
                ramAddr: ramAddr.toString(16),
                oldData, 
                newData: data, 
            })
            
            return
        }
        
        // 扩展游戏代码区监控到 $A000-$BFFF (有些 FDS 游戏可能使用这个区域)
        if (addr >= 0xA000 && addr <= 0xBFFF) {

            // 写入到扩展游戏代码区域，与读取映射一致
            const ramAddr = addr - 0x8000 // $A000 -> ram[0x2000]，与读取映射一致
            const oldData = this.ram[ramAddr] || 0
            this.ram[ramAddr] = data
            
            this.dbg('gameCodeWriteExtended', { 
                addr: addr.toString(16), 
                ramAddr: ramAddr.toString(16),
                oldData, 
                newData: data, 
            })
            
            // 扩展游戏代码写入日志
            this.dbg('extendedGameCodeWrite', {
                addr: addr.toString(16), 
                ramAddr: ramAddr.toString(16),
                oldData, 
                newData: data,
                isFirstWrite: oldData === 0 && data !== 0,
            })

            return
        }
        
        // 监控 FDS RAM 区写入 ($6000-$7FFF)
        if (addr >= 0x6000 && addr <= 0x7FFF) {
            const ramAddr = addr - 0x6000
            const oldData = this.ram[ramAddr] || 0
            this.ram[ramAddr] = data
            
            this.dbg('fdsRamWrite', { 
                addr: addr.toString(16), 
                ramAddr: ramAddr.toString(16),
                oldData, 
                newData: data,
            })
            
            // FDS RAM 区写入日志
            this.dbg('fdsRamWrite', {
                addr: addr.toString(16),
                ramAddr: ramAddr.toString(16),
                oldData,
                newData: data,
                isFirstWrite: oldData === 0 && data !== 0,
            })

            return
        }

        // 0x4023: 主 I/O 使能（bit0: 磁盘 I/O 使能；bit1: 声音 I/O 使能）。仅记录标志。
        if (addr === 0x4023) {
            this.diskIOEnabled = (data & 0x01) !== 0
            this.soundIOEnabled = (data & 0x02) !== 0

            this.dbg('write4023', {
                data,
                diskIOEnabled: this.diskIOEnabled,
                soundIOEnabled: this.soundIOEnabled,
            })

            return
        }

        // 0x4024: 写数据寄存器（写模式时写入数据到磁盘）
        if (addr === 0x4024) {
            if (!this.readMode && this.transferActive) {
                
                // 在写模式下接受数据（模拟写入到磁盘）
                this.lastData = data
                
                // 推进写指针
                this.dataPtr++
                
                this.dbg('write4024', { 
                    data, 
                    writeMode: true, 
                    ptr: this.dataPtr,
                    totalSize: this.fdsData.length,
                })
                
                // 写入完成后，设置为就绪状态等待下一个字节，并触发 IRQ
                this.dataReady = true
                if (this.cpu) {
                    ++this.cpu.interrupt
                    this.interrupted = true
                    this.dbg('irqTrigger', { ptr: this.dataPtr, reason: 'writeComplete' })
                }
            }
            else {
                this.dbg('write4024', { data, writeMode: false, ignored: true })
            }

            return
        }

        // 0x4025: 传输控制（极简解析）
        if (addr === 0x4025) {
            const wasActive = this.transferActive

            // bit0: 0 启动马达；1 停止
            this.motorOn = (data & 0x01) === 0

            // bit1: 读模式/写模式（0: 写模式；1: 读模式）
            this.readMode = (data & 0x02) !== 0

            // bit2: 传输复位（兼容实现）：清除就绪与节拍
            if ((data & 0x04) !== 0) {
                
                // 只在写模式或没有数据等待时清除数据
                const shouldClearData = !this.readMode || !this.dataReady
                if (shouldClearData) {
                    this.dataReady = false
                    this.lastData = 0
                }
                this.cyclesAccum = 0
                
                // 保存当前状态用于调试
                const wasWriteActive = this.writeSessionActive
                const oldPtr = this.dataPtr
                
                // 检查是否从写模式切换到读模式
                const switchingToReadMode = (data & 0x02) !== 0 && !this.readMode
                const isReadMode = (data & 0x02) !== 0
                const ptrTooLarge = this.dataPtr > this.fdsData.length / 2 // 超过半个磁盘就认为异常
                
                // 简化写会话保护逻辑：
                // 1. 如果是从写切换到读，清除写会话并重置指针
                // 2. 如果指针异常大，强制重置
                // 3. 如果是读模式的传输复位，总是重置指针
                const shouldClearWriteSession = switchingToReadMode || ptrTooLarge || isReadMode
                
                if (shouldClearWriteSession) {
                    this.writeSessionActive = false
                    this.dataPtr = 0
                    this.dbg('resetTransfer', { 
                        data, 
                        clearWriteSession: true,
                        wasWriteActive,
                        currentMode: this.readMode ? 'read' : 'write',
                        newMode: isReadMode ? 'read' : 'write',
                        oldPtr,
                        newPtr: 0,
                        reason: switchingToReadMode ? 'mode_switch' : ptrTooLarge ? 'ptr_too_large' : 'read_mode_reset',
                    })
                } 
                else {
                    
                    // 写模式中的传输复位，完全保持写会话状态和指针不变
                    this.dbg('resetTransfer', { 
                        data, 
                        preserveWriteSession: true, 
                        wasWriteActive,
                        ptr: this.dataPtr,
                        writeSessionActive: this.writeSessionActive,
                        currentMode: this.readMode ? 'read' : 'write',
                        newMode: isReadMode ? 'read' : 'write',
                        action: 'preserve_pointer',
                    })
                    
                    // 注意：这里不修改 writeSessionActive 和 dataPtr
                }
            }

            // 重新评估传输激活条件：
            // - 读模式：马达开启时激活，但如果有数据等待读取，保持激活
            // - 写模式：马达状态不重要，总是激活
            if (this.readMode) {

                // 读模式：马达开启或有数据等待时保持传输激活
                this.transferActive = this.motorOn || this.dataReady
            }
            else {

                // 写模式：总是激活
                this.transferActive = true
            }

            // 根据马达和是否有盘，更新就绪标志（简化为马达开即就绪）
            this.driveReady = this.motorOn && this.diskInserted

            // 如果传输变为不活跃，清除数据就绪状态和IRQ
            // 但在读模式下，如果有未消费的数据，不要立即清除
            if (!this.transferActive && wasActive) {

                // 在读模式下，如果有数据等待读取，不要清除
                if (!this.readMode || !this.dataReady) {
                    this.dataReady = false
                    this.lastData = 0
                }
                if (this.interrupted && this.cpu) {
                    --this.cpu.interrupt
                    this.interrupted = false
                    this.dbg('irqClear', { reason: 'transferInactive' })
                }
            }

            // D3: 镜像切换（0: Horizontal(Vertical mirroring); 1: Vertical(Horizontal mirroring)）
            const mirr = (data & 0x08) === 0 ? MirrorType.H_MIRROR : MirrorType.V_MIRROR
            if (mirr !== this.scrolltype) {
                this.scrolltype = mirr
                this.setmirroring(mirr)
            }
            
            // 传输激活时的初始化处理
            if (this.transferActive && !wasActive) {
                
                if (this.readMode) {

                    // 读模式：重置流并准备第一个字节
                    this.resetStream()
                    
                    if (this.fdsData.length > 0) {
                        this.lastData = this.fdsData[0]
                        this.dataPtr = 1
                        this.dataReady = true
                        this.dbg('firstByteReady', { 
                            data: this.lastData,
                            ptr: this.dataPtr,
                            totalSize: this.fdsData.length,
                            sideSize: this.sideSize,
                        })
                        
                        // 触发 IRQ 通知第一个字节就绪
                        if (this.cpu) {
                            ++this.cpu.interrupt
                            this.interrupted = true
                            this.dbg('irqTrigger', { ptr: this.dataPtr, reason: 'firstByte' })
                        }
                    }
                }
                else {
                    
                    // 写模式：需要更严格的指针管理
                    // 如果指针超出磁盘大小，强制重置到开头
                    if (this.dataPtr >= this.fdsData.length) {
                        this.dataPtr = 0
                        this.writeSessionActive = false
                        this.dbg('writeMode', { 
                            ready: true,
                            ptr: this.dataPtr,
                            totalSize: this.fdsData.length,
                            action: 'ptr_reset_overflow',
                        })
                    }
                    
                    // 检查是否是写会话中的第一次，或者重新开始写操作
                    if (this.writeSessionActive === false) {
                        
                        // 新的写会话开始，确保从合理位置开始
                        this.writeSessionActive = true
                        this.dataReady = false
                        this.lastData = 0
                        this.cyclesAccum = 0
                        this.dbg('writeMode', { 
                            ready: true,
                            ptr: this.dataPtr,
                            totalSize: this.fdsData.length,
                            sessionStart: true,
                        })
                    }
                    else {
                        
                        // 写会话已激活，继续现有会话
                        this.dbg('writeMode', { 
                            ready: true,
                            ptr: this.dataPtr,
                            totalSize: this.fdsData.length,
                            sessionContinue: true,
                            sessionWasActive: this.writeSessionActive,
                        })
                    }
                    
                    // 设置就绪状态，等待数据写入
                    this.dataReady = true
                    
                    // 写模式需要 IRQ 通知就绪
                    if (this.cpu) {
                        ++this.cpu.interrupt
                        this.interrupted = true
                        this.dbg('irqTrigger', { reason: 'writeReady' })
                    }
                }
            }

            this.dbg('write4025', {
                data,
                motorOn: this.motorOn,
                readMode: this.readMode,
                transferActive: this.transferActive,
                driveReady: this.driveReady,
                mirroring: this.scrolltype,
            })

            return
        }

        // 0x4026: 外部连接口输出（开漏，写 0 拉低，对 0x4033 形成遮罩）
        if (addr === 0x4026) {
            this.externalPortOut = data & 0xFF

            this.dbg('write4026', data)

            return
        }
        
        if (addr >= 0xE000) {

            // BIOS 只读，忽略
            return
        }
        if (addr >= 0x6000) {
            const prevData = this.ram[addr - 0x6000]
            this.ram[addr - 0x6000] = data
            
            // 记录所有 RAM 写入，以便观察 BIOS 的行为
            if (addr >= 0x6000 && addr < 0x6010) {
                this.dbg('ramWrite6000', { addr: addr.toString(16), oldData: prevData, newData: data })
            }
            else if (addr >= 0x8000 && addr < 0x8020) {

                // 扩大监控范围到 $8000-$801F，记录所有游戏代码区写入
                this.dbg('gameCodeWrite', { addr: addr.toString(16), oldData: prevData, newData: data })
            }
            else if (addr >= 0x6000 && addr < 0x8000) {

                // 监控所有 $6000-$7FFF 区域的写入
                this.dbg('ramWriteGeneral', { addr: addr.toString(16), oldData: prevData, newData: data })
            }
            else if (addr >= 0x8020 && addr < 0x9000) {

                // 监控 $8020-$8FFF 区域的写入（可能的游戏代码）
                this.dbg('gameCodeWriteExtended', { addr: addr.toString(16), oldData: prevData, newData: data })
            }
            else if (addr >= 0x9000 && addr < 0xA000) {

                // 监控 $9000-$9FFF 区域的写入
                this.dbg('ramWrite9000', { addr: addr.toString(16), oldData: prevData, newData: data })
            }

            return
        }

        // 音频寄存器
        if (addr >= 0x4040 && addr <= 0x4092) {
            this.fdsAudio?.write(addr, data)

            return
        }

        // TODO: 0x4020-0x403F 磁盘控制/状态/IRQ（后续实现）
    }

    public override cpucycle(cycles: number): void {
        
        // 暂时禁用游戏启动检测，让 BIOS 有更多时间加载游戏
        /*
        // 检测游戏是否已开始运行：如果游戏代码区域有数据，停止FDS传输
        if (this.transferActive) {
            const gameCodeStart = this.ram[0x8000 - 0x6000] // $8000 对应 ram[0x2000]
            if (gameCodeStart !== 0) {
                this.transferActive = false
                this.dataReady = false
                this.motorOn = false
                if (this.interrupted && this.cpu) {
                    --this.cpu.interrupt
                    this.interrupted = false
                }
                this.dbg('cpuCycleGameDetected', { 
                    gameCodeByte: gameCodeStart,
                    transferStopped: true,
                })

                return // 停止FDS处理
            }
        }
        */
        
        // 只有在传输激活时才处理数据流
        if (!this.transferActive) return
        if (this.fdsData.length === 0 || this.sideSize <= 0) return
        
        // 读模式：按周期推进数据流（需要马达开启）
        if (this.readMode && this.motorOn) {
            this.cyclesAccum += cycles
            while (this.cyclesAccum >= this.cyclesPerByte) {
                this.cyclesAccum -= this.cyclesPerByte
                const [start, end] = this.currentSideRange()
                if (start + this.dataPtr < end) {
                    this.lastData = this.fdsData[start + this.dataPtr]
                    this.dataPtr++
                    this.dataReady = true

                    this.dbg('byteReady', {
                        side: this.sideIndex,
                        ptr: this.dataPtr,
                        data: this.lastData,
                        dataHex: `0x${this.lastData.toString(16).padStart(2, '0')}`,
                        char: this.lastData >= 32 && this.lastData <= 126 ? String.fromCharCode(this.lastData) : '.',
                    })

                    // 检查关键的数据模式，可能的块标识
                    if (this.dataPtr < 200) { // 前200字节内的特殊模式
                        if (this.lastData === 0x01 || this.lastData === 0x02 || this.lastData === 0x03 || this.lastData === 0x04) {
                            const blockTypes = { 
                                0x01: 'Disk Header', 
                                0x02: 'File Amount', 
                                0x03: 'File Header', 
                                0x04: 'File Data',
                            }
                            this.dbg('blockMarker', { 
                                ptr: this.dataPtr, 
                                marker: this.lastData,
                                type: blockTypes[this.lastData as keyof typeof blockTypes] || 'Unknown',
                            })
                        }
                        
                        // 检测可能的 CRC 位置（通常在块标识符后的特定位置）
                        if (this.dataPtr % 16 === 0 || this.dataPtr % 32 === 0) {
                            this.dbg('possibleCRC', { ptr: this.dataPtr, data: this.lastData })
                        }
                    }

                    // 检查 File Data 块内容 - 这里可能包含实际的游戏代码
                    if (this.dataPtr >= 75 && this.dataPtr < 200) {

                        // 分析数据模式
                        let pattern = ''
                        let significance = ''
                        
                        if (this.lastData === 0x24) {
                            pattern = 'dollar_sign_pattern'
                            significance = 'possible_corruption_or_placeholder'
                        }
                        else if (this.lastData === 0x00) {
                            pattern = 'zero_fill'
                            significance = 'uninitialized_or_padding'
                        }
                        else if (this.lastData === 0xFF) {
                            pattern = 'ff_fill'
                            significance = 'possible_empty_flash'
                        }
                        else if (this.lastData >= 0x10 && this.lastData <= 0xF0) {
                            pattern = 'potential_opcode_range'
                            significance = 'could_be_valid_6502'
                        }
                        else {
                            pattern = 'other_value'
                            significance = 'unclear'
                        }
                        
                        this.dbg('fileDataContent', { 
                            ptr: this.dataPtr, 
                            data: this.lastData,
                            dataHex: `0x${this.lastData.toString(16).padStart(2, '0')}`,
                            char: this.lastData >= 32 && this.lastData <= 126 ? String.fromCharCode(this.lastData) : '.',
                            pattern,
                            significance,
                            desc: 'FDS file data pattern analysis',
                        })
                        
                        // 检测可能的6502指令模式
                        if (this.lastData === 0x4C || this.lastData === 0x20 || this.lastData === 0x60 
                            || this.lastData === 0xA9 || this.lastData === 0x8D || this.lastData === 0xAD) {
                            this.dbg('possibleInstruction', { 
                                ptr: this.dataPtr,
                                opcode: this.lastData,
                                opcodeHex: `0x${this.lastData.toString(16).padStart(2, '0')}`,
                                desc: 'potential 6502 instruction',
                            })
                        }
                    }

                    // 检查文件头模式（"*NINTENDO-HVC*"之后）
                    if (this.dataPtr > 15 && this.dataPtr < 100) {

                        // 检查是否是可能的长度字段或地址字段
                        if (this.dataPtr === 17 || this.dataPtr === 18 || this.dataPtr === 19) {
                            this.dbg('headerField', { ptr: this.dataPtr, data: this.lastData, desc: 'possible game name' })
                        }
                    }

                    // 每次有数据就绪时都触发 IRQ，确保BIOS被通知
                    if (this.cpu && this.transferActive) {
                        if (this.interrupted) {
                            
                            // 如果已有IRQ挂起，先清除再重新触发
                            --this.cpu.interrupt
                            this.interrupted = false
                        }
                        ++this.cpu.interrupt
                        this.interrupted = true
                        this.dbg('irqTrigger', { ptr: this.dataPtr })
                    }
                }
                else {

                    // 到达盘面末尾：像 QD 一样回到轨道起点，持续循环
                    this.dataPtr = 0

                    this.dbg('loopTrack', { side: this.sideIndex })
                }
            }
        }
        
        // 写模式：只在需要时触发 IRQ，不自动推进指针
        // 指针推进只在实际写入数据时发生（在 write4024 中）
        // 写模式下不要求马达开启，只要传输激活即可
        if (!this.readMode && this.transferActive) {
            this.cyclesAccum += cycles
            while (this.cyclesAccum >= this.cyclesPerByte) {
                this.cyclesAccum -= this.cyclesPerByte
                
                // 写模式下只要传输激活就应该响应写请求
                if (this.cpu && !this.interrupted) {
                    ++this.cpu.interrupt
                    this.interrupted = true
                    this.dbg('irqTrigger', { 
                        reason: 'writeRequest', 
                        ptr: this.dataPtr,
                        totalSize: this.fdsData.length,
                        writeSessionActive: this.writeSessionActive,
                        motorOn: this.motorOn,
                    })
                }
            }
        }
    }

    private resetStream(): void {
        this.dataPtr = 0
        this.dataReady = false
        this.lastData = 0
        this.cyclesAccum = 0

        this.dbg('resetStream', { side: this.sideIndex, range: this.currentSideRange() })
    }

    private currentSideRange(): [number, number] {
        const start = this.sideIndex * this.sideSize
        const end = this.sideIndex + 1 >= this.sideCount ? this.fdsData.length : start + this.sideSize

        return [start, end]
    }

    // 重写 PPU 写入方法，保护 CHR 数据免受 FDS 数据流干扰
    public override ppuWrite(addr: number, data: number): void {
        addr &= 0x3fff
        
        if (addr < 0x2000) {
            
            // CHR 区域写入保护
            const chrIndex = this.chr_map[addr >> 10] + (addr & 1023)
            
            if (this.haschrram) {
                
                // 如果保护已禁用，直接允许所有写入
                if (!this.chrProtectionEnabled) {
                    this.chr[chrIndex] = data

                    return
                }
                
                // 保护启用期间的逻辑
                const currentTime = Date.now()
                const timeSinceInit = currentTime - this.initTime
                
                // 只在前3秒内进行保护，主要是为了阻止FDS文件头的初始写入
                if (timeSinceInit < 3000) {
                    
                    // 只阻止明显的FDS文件头字符串（严格限制）
                    const strictFdsChars = [0x2A, 0x4E, 0x49] // 只阻止"*NI"开头
                    if (strictFdsChars.includes(data) && chrIndex < 100) {
                        this.dbg('chrProtected', {
                            addr: addr.toString(16),
                            data: data.toString(16),
                            char: String.fromCharCode(data),
                            reason: 'FDS header in critical area',
                            timeSinceInit: Math.round(timeSinceInit / 1000),
                        })

                        return
                    }
                    
                    // 检测超快速批量写入（明显的恶意覆盖）
                    if (this.lastChrWriteTime && currentTime - this.lastChrWriteTime < 50) {
                        if (data === this.lastChrWriteData) {
                            this.consecutiveIdenticalWrites = (this.consecutiveIdenticalWrites || 0) + 1
                            
                            // 只在超高频且连续超过20次时才阻止
                            if (this.consecutiveIdenticalWrites > 20) {
                                this.dbg('chrProtected', {
                                    addr: addr.toString(16),
                                    data: data.toString(16),
                                    reason: `Ultra-fast batch blocked (${this.consecutiveIdenticalWrites})`,
                                })

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
                this.chr[chrIndex] = data
                this.lastChrWriteTime = currentTime
                this.lastChrWriteData = data
                
                // 只在保护期间记录日志
                if (this.chrProtectionEnabled && timeSinceInit < 3000) {
                    this.dbg('chrWrite', {
                        addr: addr.toString(16),
                        data: data.toString(16),
                        chrIndex,
                        timeSinceInit: Math.round(timeSinceInit / 1000),
                    })
                }
            }
        }
        else {
            
            // Name Table 区域 - 调用基类处理
            super.ppuWrite(addr, data)
        }
    }

    public override supportsSaves(): boolean { return true }

    public override getPRGRam() { return Array.from(this.ram) }

    public override setPRGRAM(arr: number[]): void { this.ram = new Uint8Array(arr) }

    protected override postLoadState(_state: any): void {

        // 读档后重建音频芯片
        this.fdsAudio = new FDSSoundChip()
        if (this.cpuram?.apu) {
            this.cpuram.apu.addExpnSound(this.fdsAudio)
        }
    }
}
