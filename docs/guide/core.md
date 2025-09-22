# @nesjs/core - NES Emulator Core Library

[![npm version](https://badge.fury.io/js/%40nesjs%2Fcore.svg)](https://badge.fury.io/js/%40nesjs%2Fcore)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A complete NES (Nintendo Entertainment System) emulator core library that provides full NES hardware emulation functionality, UI framework agnostic.

## Features

- 🎮 Complete NES hardware emulation (CPU, PPU, APU)
- 🎯 Support for multiple Mappers
- 🎵 Audio output support
- 🕹️ Dual controller support
- 💾 Save/Load state functionality
- 🔧 Cheat code support
- 🎨 Customizable renderer and audio interfaces
- 📝 TypeScript support

## ROM Compatibility

Supported Mappers: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 16, 18, 19, 21, 22, 23, 24, 25, 26, 31, 33, 34, 36, 38, 39, 41, 47, 48, 58, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 78, 79, 85, 86, 88, 87, 89, 92, 93, 94, 97, 107, 112, 113, 115, 118, 119, 129, 140, 152, 154, 169, 180, 182, 184, 185, 195, 200, 201, 203, 206, 212, 213, 225, 226, 228, 229, 231, 240, 241, 242, 244, 245, 246, 248, 249, 255.

## Installation

::: code-group
```bash [npm]
npm install @nesjs/core
```

```bash [yarn]
yarn add @nesjs/core
```

```bash [pnpm]
pnpm add @nesjs/core
```
:::

## Quick Start

### Basic Usage

```typescript
import { NES } from '@nesjs/core'

// Create NES instance
const nes = new NES({
    audioSampleRate: 44100,
    audioBufferSize: 1024,
    enableCheat: true
})

// Implement renderer interface
class MyRenderer {
    renderFrame(imageData: Uint8Array) {
        // Handle 256x240 RGBA image data
        console.log('Frame data:', imageData.length) // 245760 bytes
    }
}

// Implement audio interface
class MyAudioOutput {
    outputSample(sample: number) {
        // Handle audio sample data
    }
    
    flushFrame() {
        // Flush audio frame
    }
}

// Set interfaces
nes.setRenderer(new MyRenderer())
nes.setAudioInterface(new MyAudioOutput())

// Load ROM
const romData = new Uint8Array(/* ROM file data */)
await nes.loadROM(romData)

// Run emulator
function gameLoop() {
    nes.runFrame()
    requestAnimationFrame(gameLoop)
}
gameLoop()
```

### Controller Input

```typescript
import { NESControllerButton } from '@nesjs/core'

// Get player gamepads
const gamepad = nes.getGamepad(1) // Player 1
const gamepad2 = nes.getGamepad(2) // Player 2

// Set button states
gamepad.setButton(NESControllerButton.A, 1) // Press A button
gamepad.setButton(NESControllerButton.A, 0) // Release A button

// Set multiple buttons
gamepad.setButtons([1, 0, 0, 0, 0, 0, 0, 0]) // Only A button pressed

// Get button states
const buttonStates = gamepad.getButtonStates()
console.log('A button state:', buttonStates.A)
```

### Save State System

```typescript
// Create save state
const saveData = nes.createSaveState()

// Load save state  
const success = nes.loadSaveState(saveData)

// Binary save state (smaller file size)
const binaryData = nes.createBinarySaveState()
const loadSuccess = nes.loadBinarySaveState(binaryData)

// SRAM save
const sramData = nes.saveSRAM()
if (sramData) {
    // Save SRAM data to file
    localStorage.setItem('sram', JSON.stringify(sramData))
}

// Load SRAM
const savedSram = localStorage.getItem('sram')
if (savedSram) {
    nes.loadSRAM(JSON.parse(savedSram))
}
```

### Cheat Code Support

```typescript
// Enable cheat functionality
await nes.enableCheat()

const cheater = nes.getCheater()
if (cheater) {
    // Add cheat code
    cheater.addCheat('079F-01-01')
    
    // Enable/disable cheat
    cheater.setCheatEnabled('079F-01-01', true)
    
    // Get cheat info
    const cheat = cheater.getCheat('079F-01-01')
    
    // Clear all cheats
    cheater.clearCheats()
}
```

## API Reference

### NES Class

#### Constructor

```typescript
new NES(config?: EmulatorConfig, events?: EmulatorEvents)
```

**Configuration Options (EmulatorConfig):**

- `audioBufferSize?: number` - Audio buffer size, default 1024
- `audioSampleRate?: number` - Audio sample rate, default 44100
- `autoSaveInterval?: number` - Auto save interval (frames), default 3600
- `enableCheat?: boolean` - Enable cheat functionality, default true

**Event Callbacks (EmulatorEvents):**

- `onFrameComplete?: (frameCount: number) => void` - Frame completion callback
- `onROMLoaded?: (romInfo: ROMInfo) => void` - ROM loaded callback  
- `onError?: (error: Error) => void` - Error callback

#### Core Methods

##### setRenderer(renderer: RendererInterface)
Set the renderer interface.

```typescript
interface RendererInterface {
    renderFrame(imageData: Uint8Array): void
}
```

##### setAudioInterface(audioInterface: AudioOutputInterface)  
Set the audio interface.

```typescript
interface AudioOutputInterface {
    outputSample(sample: number): void
    flushFrame(): void
}
```

##### loadROM(romData: Uint8Array): Promise\<void>
Load ROM file.

##### runFrame(): void
Run one emulation frame.

##### reset(): void  
Reset the emulator.

##### getGamepad(player: 1 | 2): GamepadInterface
Get the gamepad interface for specified player.

##### getDebugInfo(): DebugInfo
Get debug information.

```typescript
interface DebugInfo {
    frameCount: number
    cpuCycles: number  
    ppuScanline: number
    mapperInfo?: string
    cpu?: {
        PC: number, A: number, X: number, Y: number
        SP: number, P: number, cycles: number
    }
    ppu?: {
        scanline: number, cycles: number, frame: number
    }
}
```

### GamepadInterface

#### setButton(button: NESControllerButton, pressed: GamepadButtonState)
Set individual button state.

#### setButtons(buttons: GamepadButtonState[])
Set multiple button states.

#### getButtonStates()
Get current state of all buttons.

#### reset()
Reset all buttons.

### Button Constants

```typescript
enum NESControllerButton {
    A = 0,
    B = 1, 
    SELECT = 2,
    START = 3,
    UP = 4,
    DOWN = 5,
    LEFT = 6,
    RIGHT = 7
}
```

## Implementation Guide

### Implementing a Renderer

```typescript
class CanvasRenderer implements RendererInterface {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!
        
        // NES resolution
        canvas.width = 256
        canvas.height = 240
    }
    
    renderFrame(imageData: Uint8Array): void {
        const imgData = this.ctx.createImageData(256, 240)
        imgData.data.set(imageData)
        this.ctx.putImageData(imgData, 0, 0)
    }
}
```

### Implementing Audio Output

```typescript
class WebAudioOutput implements AudioOutputInterface {
    private audioContext: AudioContext
    private buffer: number[] = []
    
    constructor() {
        this.audioCtx = new AudioContext();
        this.sampleRate = this.audioCtx.sampleRate;
        this.samples = [];
    }
    
    outputSample(sample: number): void {
        // Add sample to buffer
        this.samples.push(sample / 0x7FFF) // Normalize to [-1, 1]
    }
    
    flushFrame(): void {
        // Send buffer data to audio context
        // Implementation depends on your audio architecture
        if (this.samples.length > 0) {
            const buffer = this.audioCtx.createBuffer(1, this.samples.length, this.sampleRate);
            buffer.getChannelData(0).set(this.samples);
            const source = this.audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioCtx.destination);
            source.start();
            this.samples.length = 0;
        }
    }
}
```