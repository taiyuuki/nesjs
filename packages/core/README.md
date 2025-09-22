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

```bash
npm install @nesjs/core
```

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

Refer to [document](https://nesjs.netlify.app/guide/core) for more details.