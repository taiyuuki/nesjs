import type { EmulatorEvents, ROMInfo } from '@nesjs/core'
import type { NESEmulatorOptions } from '@nesjs/native'

/**
 * NES Vue 组件配置选项
 */
export interface NESOptions {

    /** ROM 数据源，支持多种格式 */
    rom: ArrayBuffer | Blob | Uint8Array | string

    /** 是否自动开始游戏 */
    autoStart?: boolean

    /** 音量大小 (0-100) */
    volume?: number

    /** 是否开启调试模式 */
    debugMode?: boolean

    /** 连发速度 */
    mashingSpeed?: number

    /** 模拟器配置参数 */
    emulatorConfig?: NESEmulatorOptions
}

/**
 * NES Vue 组件事件
 */
export interface NESEvents extends EmulatorEvents {

    /** 游戏状态变化事件 */
    onStatusChange?: (status: 'paused' | 'running' | 'stopped')=> void

    /** 加载状态变化事件 */
    onLoadingChange?: (loading: boolean)=> void

    /** 组件初始化完成事件 */
    onReady?: ()=> void
}

/**
 * 组件暴露的方法接口
 */
export interface NESComponentExpose {

    /** 开始游戏 */
    start(): Promise<void>

    /** 重置游戏 */
    reset(): void

    /** 停止游戏 */
    stop(): void

    /** 暂停游戏 */
    pause(): void

    /** 继续游戏 */
    play(): void

    /** 切换播放状态 */
    togglePlay(): Promise<void>

    /** 创建存档 */
    save(): Uint8Array

    /** 加载存档 */
    load(data: Uint8Array): boolean

    /** 截图 */
    screenshot(download?: boolean): string

    /** 下载存档文件 */
    downloadSaveState(): void

    /** 上传存档文件 */
    uploadSaveState(): Promise<void>

    /** 获取游戏信息 */
    getROMInfo(): ROMInfo | null

    /** 获取调试信息 */
    getDebugInfo(): any

    /** 是否正在游戏 */
    readonly isPlaying: boolean

    /** 是否正在加载 */
    readonly isLoading: boolean
} 
