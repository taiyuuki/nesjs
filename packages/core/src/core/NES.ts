
import type { Mapper } from './mappers/Mapper'
import { APU } from './APU'
import { CPU } from './CPU'
import { CPURAM } from './CPURAM'
import { PPU } from './PPU'
import { ROMLoader } from './ROMLoader'
import { getMapper } from './mappers/MapperFactory'
import type {
    AudioOutputInterface,
    DebugInfo,
    EmulatorConfig,
    EmulatorEvents,
    GamepadButtonState,
    GamepadButtons,
    GamepadInterface,
    PaletteColors,
    ROMInfo,
    RendererInterface,
    SaveControllerState,
    SaveStateData,
} from './interfaces'
import { NESControllerButton } from './interfaces'
import { ControllerAdapter } from './ControllerAdapter'
import { BinarySaveState } from './BinarySaveState'
import type { Cheater } from './Cheater'
import type { TVType } from './types'
import type FDSMapper from './mappers/MapperList/FDSMapper'
import { hexToPalette } from './utils'

/**
 * 游戏手柄实现
 */
export class NESGamepad implements GamepadInterface {
    buttonStates: GamepadButtons = Array(8).fill(0) as GamepadButtons

    public setButton(button: NESControllerButton, pressed: GamepadButtonState): void {
        this.buttonStates[button] = pressed
    }

    public setButtons(buttons: GamepadButtonState[]): void {
        Object.assign(this.buttonStates, buttons)
    }

    public getButtonStates() {
        return {
            A:      this.buttonStates[NESControllerButton.A],
            B:      this.buttonStates[NESControllerButton.B],
            SELECT: this.buttonStates[NESControllerButton.SELECT],
            START:  this.buttonStates[NESControllerButton.START],
            UP:     this.buttonStates[NESControllerButton.UP],
            DOWN:   this.buttonStates[NESControllerButton.DOWN],
            LEFT:   this.buttonStates[NESControllerButton.LEFT],
            RIGHT:  this.buttonStates[NESControllerButton.RIGHT],
        }
    }

    public reset(): void {
        this.buttonStates.fill(0)
    }
}

/**
 * NES 模拟器核心类
 * 不依赖特定UI框架，通过接口与外部交互
 */
export class NES {

    // 默认调色板
    private defaultPalette = hexToPalette('74747424188c0000a844009c8c0074a80010a400007c0800402c00004400005000003c14183c5c000000000000000000bcbcbc0070ec2038ec8000f0bc00bce40058d82800c84c0c88700000940000a800009038008088000000000000000000fcfcfc3cbcfc5c94fccc88fcf478fcfc74b4fc7460fc9838f0bc3c80d0104cdc4858f89800e8d8787878000000000000fcfcfca8e4fcc4d4fcd4c8fcfcc4fcfcc4d8fcbcb0fcd8a8fce4a0e0fca0a8f0bcb0fccc9cfcf0c4c4c4000000000000')
    private palette: number[]

    // 核心组件
    private mapper?: Mapper
    private apu?:    APU
    private cpu?:    CPU
    private cpuram?: CPURAM
    private ppu?:    PPU

    // 外部接口
    private renderer?:       RendererInterface
    private gamepad1 = new NESGamepad()
    private gamepad2 = new NESGamepad()
    private controller1:     ControllerAdapter
    private controller2:     ControllerAdapter
    private audioInterface?: AudioOutputInterface

    // 性能统计
    public frameCount: number = 1
    public fps:        number = 0

    // 配置和事件
    private config: Required<EmulatorConfig>
    private events: EmulatorEvents

    // 金手指
    private cheater: Cheater | null

    // 录像播放器
    // private videoPlayer: VideoPlayer | null

    // FDS BIOS数据
    private fdsBiosData: Uint8Array | null = null

    constructor(config: EmulatorConfig = {}, events: EmulatorEvents = {}) {
        this.config = Object.assign({
            audioBufferSize:  1024,
            audioSampleRate:  44100,
            autoSaveInterval: 60 * 60,
            enableCheat:      true,
        }, config)
        this.events = events
        
        // 初始化控制器适配器
        this.controller1 = new ControllerAdapter(this.gamepad1)
        this.controller2 = new ControllerAdapter(this.gamepad2)
        
        this.cheater = null

        // 设置默认调色板
        this.palette = this.defaultPalette

        // this.videoPlayer = null
    }

    /**
     * 设置渲染器
     */
    public setRenderer(renderer: RendererInterface): void {
        this.renderer = renderer
    }

    /**
     * 设置音频接口
     */
    public setAudioInterface(audioInterface: AudioOutputInterface): void {
        this.audioInterface = audioInterface
        if (this.apu) {
            this.apu.setAudioInterface(audioInterface)
        }

    // 注入音频接口
    }

    /**
     * 加载FDS BIOS文件
     * @param biosData FDS BIOS数据 (必须是8KB)
     */
    public setFDSBIOS(biosData: Uint8Array): void {
        if (biosData.length !== 8192) {
            throw new Error(`Invalid FDS BIOS size: ${biosData.length} bytes, expected 8192 bytes`)
        }
        
        this.fdsBiosData = new Uint8Array(biosData)
        
        // 如果已经加载了FDS ROM，立即设置BIOS
        if (this.mapper?.getMapperType() === -2) {
            (this.mapper as FDSMapper).setBIOS(this.fdsBiosData)
        }
    }

    /**
     * 获取游戏手柄引用
     */
    public getGamepad(player: 1 | 2): GamepadInterface {
        return player === 1 ? this.gamepad1 : this.gamepad2
    }

    /**
     * 获取CPU引用
     */
    public getCPU(): CPU | undefined {

        return this.cpu
    }

    /**
     * 获取CPURAM引用
     */
    public getCPURAM(): CPURAM | undefined {
        return this.cpuram
    }

    public getController1(): ControllerAdapter {
        return this.controller1
    }

    public getController2(): ControllerAdapter {
        return this.controller2
    }

    public getTVType(): TVType | undefined {
        if (this.ppu) {
            return this.mapper?.getTVType()
        }

        return void 0
    }

    /**
     * 加载ROM文件
     */
    public async loadROM(romData: Uint8Array): Promise<void> {
        
        try {

            // 加载ROM
            const loader = new ROMLoader(romData)
            loader.parseHeader()

            const newMapper = await getMapper(loader)
            newMapper.loadROM()
            
            this.saveSRAM()
            this.mapper?.destroy()

            this.mapper = newMapper
            
            this.cpuram = new CPURAM(newMapper)
            this.cpu = new CPU(this.cpuram)
            this.ppu = new PPU(newMapper)
            this.apu = new APU(this.config.audioSampleRate, this.cpu, this.cpuram, this)

            if (this.audioInterface) {
                this.apu.setAudioInterface(this.audioInterface)
            }

            if (this.cpuram && this.apu) {
                this.cpuram.setAPU(this.apu)
            }
            if (this.cpuram && this.ppu) {
                this.cpuram.setPPU(this.ppu)
            }

            this.mapper.nes = this
            this.mapper.cpu = this.cpu
            this.mapper.cpuram = this.cpuram  
            this.mapper.ppu = this.ppu
            this.frameCount = 1

            // 如果是FDS ROM且已加载BIOS，设置BIOS
            if (loader.isFDS && this.fdsBiosData) {
                if (this.mapper.getMapperType() === -2) {
                    (this.mapper as FDSMapper).setBIOS(this.fdsBiosData)
                }
            }
            else if (loader.isFDS && !this.fdsBiosData) {
                console.warn('FDS ROM detected but no BIOS loaded. Please call loadFDSBIOS() before loading FDS ROMs.')
            }

            this.cpu.init()
            this.mapper.init()
            this.mapper.reset()

            const romInfo: ROMInfo = {
                mapperNumber:  loader.mappertype,
                submapper:     loader.submapper,
                prgSize:       loader.prgsize,
                chrSize:       loader.chrsize,
                hasSRAM:       this.mapper.supportsSaves(),
                supportsSaves: this.mapper.supportsSaves(),
                crc:           this.mapper.getCRC(),
            }

            this.events.onROMLoaded?.(romInfo)

            if (this.config.enableCheat && !this.cheater) {
                const { Cheater } = await import('./Cheater')
                this.cheater = new Cheater(this)
            }

            // if (this.config.enableVideoPlayer && !this.videoPlayer) {
            //     const { VideoPlayer } = await import('./movie/VideoPlayer')
            //     this.videoPlayer = new VideoPlayer(this)
            // }
        }
        catch(error) {
            const err = error instanceof Error ? error : new Error(String(error))
            this.events.onError?.(err)
            throw err
        }
    }

    /**
     * 重置模拟器
     */
    public reset(): void {
        if (this.cpu) {
            this.cpu.reset() // 先重置CPU（这会禁用APU）
            this.mapper?.reset() // 然后重置mapper（NSF会重新配置音频）
            
            // 最后确保APU状态正确，特别是对NSF重要
            if (this.apu && this.cpuram) {

                // 彻底清理APU寄存器，避免长鸣声
                for (let i = 0x4000; i <= 0x4013; ++i) {
                    this.cpuram.write(i, 0)
                }
                this.cpuram.write(0x4015, 0x00) // 先彻底禁用所有通道
                this.cpuram.write(0x4017, 0x40) // 重置帧计数器
                this.cpuram.write(0x4015, 0x0f) // 重新启用基础通道
            }
            
            this.frameCount = 1
        }
    }

    /**
     * 获取ROM信息字符串
     */
    public getROMInfoString(): string | null {
        const romInfo = this.getROMInfo()
        if (!romInfo) {
            return null
        }

        return `(Mapper ${romInfo.mapperNumber})`
    }

    /**
     * 获取ROM信息对象
     */
    public getROMInfo(): ROMInfo | null {
        if (!this.mapper) {
            return null
        }
        
        return {
            mapperNumber:  this.mapper.getMapperType(),
            submapper:     this.mapper.getSubMapperType(),
            prgSize:       this.mapper.getPRGSize(),
            chrSize:       this.mapper.getCHRSize(),
            hasSRAM:       this.mapper.supportsSaves(),
            supportsSaves: this.mapper.supportsSaves(),
            crc:           this.mapper.getCRC(),
        }
    }

    /**
     * 获取调试信息
     */
    public getDebugInfo(): DebugInfo {
        return {
            frameCount:  this.frameCount,
            cpuCycles:   this.cpu?.clocks || 0,
            ppuScanline: this.ppu?.scanline || 0,
            mapperInfo:  this.getROMInfoString() || undefined,
            cpu:         this.cpu ? {
                PC:     this.cpu.getPC(),
                A:      this.cpu.getA(),
                X:      this.cpu.getX(),
                Y:      this.cpu.getY(),
                SP:     this.cpu.getS(),
                P:      this.cpu.getP(),
                cycles: this.cpu.clocks,
            } : undefined,
            ppu: this.ppu ? {
                scanline: this.ppu.scanline,
                cycles:   this.ppu.cycles,
                frame:    this.frameCount,
            } : undefined,
        }
    }

    /**
     * 运行一帧
     */
    public runFrame(): void {
        if (!this.ppu || !this.apu || !this.cpu) {
            return
        }

        // 播放录像
        // this.videoPlayer?.playFrame(this.frameCount)

        // 应用金手指
        this.cheater?.applyCheats()

        // 运行PPU一帧
        this.ppu.runFrame()

        // 帧结束处理
        this.apu.finishframe()
        this.cpu.modcycles()

        // 渲染帧
        this.renderFrame()

        this.frameCount++

        // 帧节奏统计日志已移除

        // 自动保存
        if ((this.frameCount & this.config.autoSaveInterval! - 1) === 0) {
            this.saveSRAM()
        }
        this.events.onFrameComplete?.(this.frameCount)
    }

    /**
     * 获取NES调色板颜色
     * @param paletteIndex 调色板索引 (0-63)
     * @param _emphasis 颜色强调值 (0-7) - 暂未使用
     * @returns RGB颜色值
     */
    private getNESColor(paletteIndex: number, _emphasis: number): number {
        const index = paletteIndex & 0x3F

        return this.palette[index] ?? 0
    }

    /**
     * 设置自定义调色板
     * @param palette 64色 RGBA 格式的调色板数组
     */
    public setPalette(palette: PaletteColors): void {
        if (palette.length !== 64) {
            throw new Error('调色板必须包含64种颜色')
        }
        this.palette = [...palette]
    }

    /**
     * 重置为默认调色板
     */
    public resetPalette(): void {
        this.palette = this.defaultPalette
    }

    /**
     * 获取当前调色板
     * @returns 当前使用的64色调色板
     */
    public getPalette(): PaletteColors {
        return [...this.palette]
    }

    /**
     * 从 .pal 文件数据解析调色板
     * @param buffer .pal 文件的二进制数据 (192字节)
     * @returns 64色 RGBA 格式的调色板数组
     */
    public static parsePALFile(buffer: Uint8Array): PaletteColors {
        if (buffer.length < 192) {
            throw new Error(`无效的PAL文件：需要192字节，实际${buffer.length}字节`)
        }

        const palette: PaletteColors = []
        for (let i = 0; i < 64; i++) {
            const r = buffer[i * 3]
            const g = buffer[i * 3 + 1]
            const b = buffer[i * 3 + 2]

            // 转换为 ARGB 格式 (0xAARRGGBB)
            palette.push(r << 16 | g << 8 | b | 0xFF000000)
        }

        return palette
    }

    /**
     * 渲染帧
     */
    private renderFrame(): void {
        if (this.ppu && this.renderer) {

            // 创建像素数据缓冲区  
            const pixelData = new Uint8Array(256 * 240 * 4)
            const bitmap = this.ppu.getBitmap()

            // 将bitmap数据转换为RGBA格式
            for (let i = 0; i < bitmap.length && i < 61440; i++) {
                const pixelIndex = i * 4
                const paletteIndex = bitmap[i]
                        
                // 使用NES调色板转换
                const color = this.getNESColor(paletteIndex, 0)
                        
                pixelData[pixelIndex] = color >> 16 & 0xFF // R
                pixelData[pixelIndex + 1] = color >> 8 & 0xFF // G 
                pixelData[pixelIndex + 2] = color & 0xFF // B
                pixelData[pixelIndex + 3] = 255 // A
            }
            
            this.renderer.renderFrame(pixelData)
        }
        else {
            console.error('Cannot render frame: Missing Renderer.')
        }
    }

    /**
     * 保存SRAM
     */
    public saveSRAM() {
        if (this.mapper?.supportsSaves()) {

            return this.mapper.getPRGRam()
        }
    }

    /**
     * 加载SRAM
     */
    public loadSRAM(prgram: number[]): void {
        if (this.mapper?.supportsSaves()) {
            this.mapper.setPRGRAM(prgram)
        }
    }

    /**
     * 开启cheat功能
     */
    public async enableCheat() {
        if (!this.cheater) {
            const { Cheater } = await import('./Cheater')
            this.cheater = new Cheater(this)
            this.config.enableCheat = true
        }
    }

    /**
     * 获取控制器存档状态
     */
    private getControllerSaveState(controller: ControllerAdapter): SaveControllerState {

        // 使用适配器的状态获取方法
        return controller.getControllerState()
    }

    /**
     * 设置控制器存档状态
     */
    private setControllerSaveState(controller: ControllerAdapter, state: SaveControllerState): void {

        // 使用适配器的状态设置方法
        controller.setControllerState(state)
    }

    getCheater(): Cheater | null {
        return this.cheater
    }

    // getVideoPlayer(): VideoPlayer | null {
    //     return this.videoPlayer
    // }

    /**
     * 创建二进制格式的存档状态（更小的文件大小）
     */
    public createBinarySaveState(): Uint8Array {
        const saveData = this.createSaveState()

        return BinarySaveState.serialize(saveData)
    }

    /**
     * 从二进制格式加载存档状态
     */
    public loadBinarySaveState(binaryData: Uint8Array): boolean {
        try {
            const saveData = BinarySaveState.deserialize(binaryData)

            return this.loadSaveState(saveData)
        }
        catch(error) {
            console.error('Failed to load binary save state:', error)

            return false
        }
    }

    /**
     * 创建存档状态
     */
    public createSaveState(): SaveStateData {
        if (!this.cpu || !this.ppu || !this.apu || !this.cpuram || !this.mapper) {
            throw new Error('Cannot create save state: emulator not properly initialized')
        }

        const saveData: SaveStateData = {
            version: 1,
            romInfo: {
                crc32:      this.mapper.getCRC(),
                mapperType: this.mapper.getMapperType(),
            },
            cpu: {
                ...this.cpu.getCPUState(),
                ram: this.cpuram.getRAM(),
            },
            ppu:         this.ppu.getPPUState(),
            apu:         this.apu.getAPUState(),
            mapper:      { state: this.mapper.getMapperState() },
            controllers: {
                player1: this.getControllerSaveState(this.controller1),
                player2: this.getControllerSaveState(this.controller2),
            },
            frameCount: this.frameCount,
        }

        return saveData
    }

    /**
     * 加载存档状态
     */
    public loadSaveState(saveData: SaveStateData): boolean {

        this.reset()
        try {
            if (!this.validateSaveState(saveData)) {
                throw new Error('Invalid save state data')
            }

            if (!this.cpu || !this.ppu || !this.apu || !this.cpuram || !this.mapper) {
                throw new Error('Cannot load save state: emulator not properly initialized')
            }

            // 恢复CPU状态
            this.cpu.setCPUState(saveData.cpu)
            this.cpuram.setRAM(saveData.cpu.ram)
            
            if (saveData.mapper.state) {
                this.mapper.setMapperState(saveData.mapper.state)
            }

            // 然后恢复PPU状态
            this.ppu.setPPUState(saveData.ppu)

            // 恢复APU状态
            if (saveData.apu) {
                this.apu.setAPUState(saveData.apu)
            }

            if (saveData.controllers) {
                this.setControllerSaveState(this.controller1, saveData.controllers.player1)
                this.setControllerSaveState(this.controller2, saveData.controllers.player2)
            }

            this.frameCount = saveData.frameCount || 1

            // 重新渲染一帧以更新显示，但不要覆盖PPU的状态！
            if (this.ppu && this.renderer) {
                this.renderFrame()
            }

            return true
        } 
        catch(error) {
            console.error('Failed to load save state:', error)

            return false
        }
    }

    /**
     * 验证存档兼容性
     */
    public validateSaveState(saveData: SaveStateData): boolean {
        if (!saveData || typeof saveData !== 'object') {
            return false
        }

        // 检查版本号
        if (!saveData.version || saveData.version > 1) {
            console.error('Unsupported save state version:', saveData.version)

            return false
        }

        // CRC 校验
        const currentCRC = this.mapper?.getCRC()
        const saveCRC = saveData.romInfo?.crc32
        if (currentCRC !== undefined && saveCRC !== undefined && currentCRC !== saveCRC) {
            throw new Error(`CRC mismatch: save=${saveCRC}, current=${currentCRC}`)
        }

        // 检查ROM兼容性
        if (!this.mapper) {
            console.error('No mapper initialized for save state validation')

            return false
        }

        if (saveData.romInfo.mapperType !== this.mapper.getMapperType()) {
            console.error('Mapper type mismatch:', saveData.romInfo.mapperType, 'vs', this.mapper.getMapperType())

            return false
        }

        // 检查必要的数据结构
        if (!saveData.cpu || !saveData.ppu || !saveData.mapper) {
            console.error('Incomplete save state data')

            return false
        }

        if (!saveData.cpu.ram || saveData.cpu.ram.length !== 2048) {
            console.error('Invalid CPU RAM size:', saveData.cpu.ram.length)

            return false
        }

        return true
    }
}
