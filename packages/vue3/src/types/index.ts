import type { EmulatorEvents, ROMInfo } from '@nesjs/core'
import type { NESEmulatorOptions } from '@nesjs/native'

/**
 * NES Vue options
 */
export interface NESOptions {

    /** ROM data */
    rom: ArrayBuffer | Blob | Uint8Array | string

    /** Whether to auto start the game */
    autoStart?: boolean

    /** Volume level (0-100) */
    volume?: number

    /** Whether to enable debug mode */
    debugMode?: boolean

    /** Mashing speed */
    mashingSpeed?: number

    /** Emulator configuration options */
    emulatorConfig?: NESEmulatorOptions
}

/**
 * NES Vue events
 */
export interface NESEvents extends EmulatorEvents {

    /** Game status change event */
    onStatusChange?: (status: 'paused' | 'running' | 'stopped')=> void

    /** Loading status change event */
    onLoadingChange?: (loading: boolean)=> void

    /** Component ready event */
    onReady?: ()=> void
}

/**
 * Component expose methods interface
 */
export interface NESComponentExpose {

    /** Start the game */
    start(): Promise<void>

    /** Reset the game */
    reset(): void

    /** Stop the game */
    stop(): void

    /** Pause the game */
    pause(): void

    /** Continue the game */
    play(): void

    /** Toggle play state */
    togglePlay(): Promise<void>

    /** Create save state */
    save(): Uint8Array

    /** Load save state */
    load(data: Uint8Array): boolean

    /** Take a screenshot */
    screenshot(download?: boolean): string

    /** Download save state */
    downloadSaveState(): void

    /** Upload save state */
    uploadSaveState(): Promise<void>

    /** Add a cheat code */
    addCheat(code: string): void

    /** Toggle a cheat code */
    toggleCheat(code: string): void

    /** Remove a cheat code */
    removeCheat(code: string): void

    /** Clear all cheat codes */
    clearAllCheats(): void

    /** Get ROM information */
    getROMInfo(): ROMInfo | null

    /** Get debug information */
    getDebugInfo(): any

    /** Whether the game is playing */
    readonly isPlaying: boolean

    /** Whether the game is loading */
    readonly isLoading: boolean
} 
