export interface EmulatorConfig {
    scale?: number;
    clip8px?: boolean;
    smoothing?: boolean;
    audioBufferSize?: number;
    audioSampleRate?: number;
    fillColor?: string | [number, number, number, number];
    player1KeyMap?: Record<string, string>;
    player2KeyMap?: Record<string, string>;
}

export type ROMInput = ArrayBuffer | Blob | Uint8Array | string

export interface NESOptions {
    rom: ROMInput;
    autoStart?: boolean;
    volume?: number;
    debugMode?: boolean;
    mashingSpeed?: number;
    emulatorConfig?: EmulatorConfig;
}

export interface NESComponentExpose {
    start: ()=> Promise<void>;
    reset: ()=> void;
    stop: ()=> void;
    pause: ()=> void;
    play: ()=> void;
    togglePlay: ()=> Promise<void>;
    save: ()=> Uint8Array;
    load: (data: Uint8Array)=> boolean;
    screenshot: (download?: boolean)=> string;
    downloadSaveState: ()=> void;
    uploadSaveState: ()=> Promise<void>;
    addCheat: (code: string)=> void;
    removeCheat: (code: string)=> void;
    toggleCheat: (code: string)=> void;
    clearAllCheats: ()=> void;
    getROMInfo: ()=> any;
    getDebugInfo: ()=> any;
    readonly isPlaying: boolean;
    readonly isLoading: boolean;
}
