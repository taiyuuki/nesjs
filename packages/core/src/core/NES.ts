
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
            A: this.buttonStates[NESControllerButton.A],
            B: this.buttonStates[NESControllerButton.B],
            SELECT: this.buttonStates[NESControllerButton.SELECT],
            START: this.buttonStates[NESControllerButton.START],
            UP: this.buttonStates[NESControllerButton.UP],
            DOWN: this.buttonStates[NESControllerButton.DOWN],
            LEFT: this.buttonStates[NESControllerButton.LEFT],
            RIGHT: this.buttonStates[NESControllerButton.RIGHT],
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

    // NES调色板 
    private static readonly NES_PALETTE = [
        0x606060, 0x09268e, 0x1a11bd, 0x3409b6, 0x5e0982, 0x790939, 0x6f0c09, 0x511f09, 
        0x293709, 0x0d4809, 0x094e09, 0x094b17, 0x093a5a, 0x000000, 0x000000, 0x000000, 
        0xb1b1b1, 0x1658f7, 0x4433ff, 0x7d20ff, 0xb515d8, 0xcb1d73, 0xc62922, 0x954f09, 
        0x5f7209, 0x28ac09, 0x099c09, 0x099032, 0x0976a2, 0x090909, 0x000000, 0x000000,
        0xffffff, 0x5dadff, 0x9d84ff, 0xd76aff, 0xff5dff, 0xff63c6, 0xff8150, 0xffa50d,
        0xccc409, 0x74f009, 0x54fc1c, 0x33f881, 0x3fd4ff, 0x494949, 0x000000, 0x000000,
        0xffffff, 0xc8eaff, 0xe1d8ff, 0xffccff, 0xffc6ff, 0xffcbfb, 0xffd7c2, 0xffe999, 
        0xf0f986, 0xd6ff90, 0xbdffaf, 0xb3ffd7, 0xb3ffff, 0xbcbcbc, 0x000000, 0x000000,
    ].map(color => color | 0xff000000) // 添加alpha通道

    // 核心组件
    private mapper?: Mapper
    private apu?: APU
    private cpu?: CPU
    private cpuram?: CPURAM
    private ppu?: PPU

    // 外部接口
    private renderer?: RendererInterface
    private gamepad1 = new NESGamepad()
    private gamepad2 = new NESGamepad()
    private controller1: ControllerAdapter
    private controller2: ControllerAdapter
    private audioInterface?: AudioOutputInterface

    // 性能统计
    public frameCount: number = 1
    public fps: number = 0

    // 配置和事件
    private config: Required<EmulatorConfig>
    private events: EmulatorEvents

    // 金手指
    private cheater: Cheater | null

    // 录像播放器
    // private videoPlayer: VideoPlayer | null

    constructor(config: EmulatorConfig = {}, events: EmulatorEvents = {}) {
        this.config = Object.assign({
            audioBufferSize: 1024,
            audioSampleRate: 44100,
            autoSaveInterval: 60 * 60,
            enableCheat: true,
        }, config)
        this.events = events
        
        // 初始化控制器适配器
        this.controller1 = new ControllerAdapter(this.gamepad1)
        this.controller2 = new ControllerAdapter(this.gamepad2)
        
        this.cheater = null

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

            // if (this.mapper.supportsSaves()) {
            //     this.loadSRAM()
            // }

            this.cpu.init()
            this.mapper.init()

            const romInfo: ROMInfo = {
                mapperNumber: loader.mappertype,
                prgSize: loader.prgsize,
                chrSize: loader.chrsize,
                hasSRAM: this.mapper.supportsSaves(),
                supportsSaves: this.mapper.supportsSaves(),
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
        catch (error) {
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
            this.mapper?.reset()
            this.cpu.reset()
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
            mapperNumber: this.mapper.getMapperType(),
            prgSize: this.mapper.getPRGSize(),
            chrSize: this.mapper.getCHRSize(),
            hasSRAM: this.mapper.supportsSaves(),
            supportsSaves: this.mapper.supportsSaves(),
        }
    }

    /**
     * 获取调试信息
     */
    public getDebugInfo(): DebugInfo {
        return {
            frameCount: this.frameCount,
            cpuCycles: this.cpu?.clocks || 0,
            ppuScanline: this.ppu?.scanline || 0,
            mapperInfo: this.getROMInfoString() || undefined,
            cpu: this.cpu ? {
                PC: this.cpu.getPC(),
                A: this.cpu.getA(),
                X: this.cpu.getX(),
                Y: this.cpu.getY(),
                SP: this.cpu.getS(),
                P: this.cpu.getP(),
                cycles: this.cpu.clocks,
            } : undefined,
            ppu: this.ppu ? {
                scanline: this.ppu.scanline,
                cycles: this.ppu.cycles,
                frame: this.frameCount,
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
        const index = (paletteIndex & 0x3F) % NES.NES_PALETTE.length
        
        return NES.NES_PALETTE[index]
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
        catch (error) {
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
                crc32: this.mapper.getCRC(),
                mapperType: this.mapper.getMapperType(),
            },
            cpu: {
                ...this.cpu.getCPUState(),
                ram: this.cpuram.getRAM(),
            },
            ppu: this.ppu.getPPUState(),
            apu: this.apu.getAPUState(),
            mapper: { state: this.mapper.getMapperState() },
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
        catch (error) {
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
