export interface NESOptions {
    rom: ArrayBuffer | Blob | Uint8Array | string
    autoStart?: boolean
    scale?: number
    smoothing?: boolean
    volume?: number
    clip8px?: boolean
    debugMode?: boolean
    mashingSpeed?: number
} 
