import type { Cheater } from './Cheater'

/**
 * 渲染器接口 - 抽象化UI渲染
 * 允许不同平台实现自己的渲染逻辑
 */
export interface RendererInterface {

    /**
     * 渲染一帧图像数据
     * @param imageData 图像数据 (RGBA格式)
     */
    renderFrame(imageData: Uint8Array): void
}

/** * 扩展音频芯片接口
 * 用于处理扩展音频芯片的时钟和读写操作
 */
export interface ExpansionSoundChip {
    clock(cycles: number): void
    write(register: number, data: number): void
    getval(): number
}

/**
 * 游戏手柄按键枚举
 */
export enum GamepadButton {
    A = 0,
    B = 1,
    SELECT = 2,
    START = 3,
    UP = 4,
    DOWN = 5,
    LEFT = 6,
    RIGHT = 7,
}

/**
 * 按键状态对象
 */
export type GamepadButtonState = 0 | 1
export type GamepadButtons = number[] & Record<GamepadButton, GamepadButtonState>

/**
 * 控制器接口
 */
export interface GamepadInterface {

    buttonStates: GamepadButtons

    /**
     * 设置按键状态
     * @param button 按键类型
     * @param pressed 按键状态 (0或1)
     */
    setButton(button: GamepadButton, pressed: GamepadButtonState): void
    
    /**
     * 批量设置按键状态
     * @param buttons 按键状态对象
     */
    setButtons(buttons: GamepadButtonState[]): void
    
    /**
     * 获取当前按键状态
     */
    getButtonStates(): {
        A: number
        B: number
        SELECT: number
        START: number
        UP: number
        DOWN: number
        LEFT: number
        RIGHT: number
    }
    
    /**
     * 重置所有按键
     */
    reset(): void
}

/**
 * 音频输出接口
 */
export interface AudioOutputInterface {

    /** 输出音频采样 */
    outputSample(sample: number): void

    /** 结束帧 */
    flushFrame(): void
}

/**
 * 调试信息接口
 */
export interface DebugInfo {
    frameCount: number
    cpuCycles: number
    ppuScanline: number
    romName?: string
    mapperInfo?: string
    cpu?: {
        PC: number
        A: number
        X: number
        Y: number
        SP: number
        P: number
        cycles: number
    }
    ppu?: {
        scanline: number
        cycles: number
        frame: number
    }
}

/**
 * 模拟器配置接口
 */
export interface EmulatorConfig {
    
    /** 音频缓冲区大小 */
    audioBufferSize?: number
    
    /** 音频采样率 */
    audioSampleRate?: number
    
    /** 自动保存间隔（帧数） */
    autoSaveInterval?: number

    /** 启用金手指功能 */
    enableCheat?: boolean

    /** 启用录像播放器功能 */
    // enableVideoPlayer?: boolean
}

/**
 * ROM信息接口
 */
export interface ROMInfo {
    mapperNumber: number
    prgSize: number
    chrSize: number
    hasSRAM: boolean
    supportsSaves: boolean
}

export interface SaveControllerState {
    buttonState: number // 控制器状态字节
    strobeState: boolean // 锁存状态
    buttonIndex: number // 按键索引
}

/**
 * 存档数据接口
 */
export interface SaveStateData {

    /** 存档版本号 */
    version: number
    
    /** ROM信息 */
    romInfo: {
        crc32: number
        mapperType: number
    }
    
    /** CPU状态 */
    cpu: {
        PC: number // 程序计数器
        A: number // 累加器
        X: number // X寄存器
        Y: number // Y寄存器
        SP: number // 栈指针
        P: number // 状态标志
        cycles: number // CPU周期数
        ram: number[] // CPU RAM (2KB)
    }
    
    /** PPU状态 */
    ppu: {
        registers: number[] // PPU寄存器
        palette: number[] // 调色板 (32字节)
        oam: number[] // OAM (256字节)
        vram: number[] // VRAM/Nametables
        scanline: number // 当前扫描线
        cycle: number // 当前周期
    }
    
    /** APU状态 */
    apu: any // APU完整状态数据
    
    /** Mapper状态 */
    mapper: { state?: any }
    
    /** 控制器状态 */
    controllers: {
        player1: SaveControllerState
        player2: SaveControllerState
    }
    
    /** 帧计数 */
    frameCount: number
}

/**
 * 存档管理接口
 */
export interface SaveStateInterface {

    /** 创建存档 */
    createSaveState(): SaveStateData
    
    /** 加载存档 */
    loadSaveState(saveData: SaveStateData): boolean
    
    /** 验证存档兼容性 */
    validateSaveState(saveData: SaveStateData): boolean
}

/**
 * 模拟器事件接口
 */
export interface EmulatorEvents {
    onFrameComplete?: (frameCount: number)=> void
    onROMLoaded?: (romInfo: ROMInfo)=> void
    onError?: (error: Error)=> void
}

export enum IRQMETHOD {
    IRQ_HSYNC = 0,
    IRQ_CLOCK = 1,
}

/**
 * 录像帧数据
 */
export interface VideoFrame {

    /** 玩家1输入 */
    player1?: GamepadButtons

    /** 玩家2输入 */
    player2?: GamepadButtons

    /** 是否重置标志 */
    reset?: boolean
}

/**
 * 录像元数据
 */
export interface VideoMetadata {

    /** 录像格式 */
    format: string
}

/**
 * 录像数据结构
 */
export interface VideoData {

    /** 元数据 */
    metadata: VideoMetadata

    /** 帧数据 */
    frames: Record<number, VideoFrame>

    /** 最后一帧 */
    lastFrameNumber: number
}

/**
 * 录像解析器接口
 */
export interface VideoParserInterface {

    /** 支持的格式列表 */
    getSupportedFormats(): string[]
    
    /** 解析录像文件 */
    parseMovie(content: string): VideoData
    
    /** 序列化录像文件 */
    serializeMovie(movieData: VideoData): string
}

export type CheaterInstance = Cheater
