import type { NES } from './nes'

type Player = 1 | 2

type HasJSON = { JSON_PROPERTIES: string[] }

type From<O extends HasJSON, K extends string = O['JSON_PROPERTIES'][number]> = { 
    [key in K]: any
} & { JSON_PROPERTIES: K[] }

type To<O extends HasJSON, K extends string = From<O>['JSON_PROPERTIES'][number]> = {
    [key in K]: From<O>[key]
}

type NESOption = {
    onFrame: (frameBuffer: number[])=> void
    onAudioSample?: (left: number, right: number)=> void
    onStatusUpdate?: ()=> void
    onBatteryRamWrite?: (address: number, value: number)=> void
    preferredFrameRate?: number
    emulateSound?: boolean
    sampleRate?: number
}

// type NESOptionParams = Partial<NESOption>

type Mapper = {
    nes: NES
    zapperX: number
    zapperY: number
    zapperFired: boolean 
    joy1StrobeState: number
    joy2StrobeState: number
    joypadLastWrite: number
    reset(): void
    regWrite(address: number, value: number): void
    regLoad(address: number): number
    joy1Read(): number
    joy2Read(): number
    loadPRGROM(): void
    write(address: number, value: number): void
    load(address: number): number
    writelow(address: number, value: number): void
    loadROM(): void
    loadCHRROM(): void
    loadBatteryRam(): void
    loadRomBank(bank: number, address: number): void
    loadVromBank(bank: number, address: number): void
    load32kRomBank(bank: number, address: number): void
    load8kVromBank(bank4kStart: number, address: number): void
    load1kVromBank(bank1k: number, address: number): void
    load2kVromBank(bank2k: number, address: number): void
    load8kRomBank(bank8k: number, address: number): void
    clockIrqCounter(): void
    latchAccess(address: number): void
    toJSON(): any
    fromJSON(s: Mapper): void
}

type MappersType = { [key: number]: new(nes: NES)=> Mapper }

type CheatCodeMap = Record<number, number>

export type {
    Player,
    HasJSON,
    From,
    To,
    NESOption,
    Mapper,
    MappersType,
    CheatCodeMap,
}
