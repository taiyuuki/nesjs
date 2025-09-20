# @nesjs/native - Browser Native NES Emulator


[![npm version](https://badge.fury.io/js/%40nesjs%2Fnative.svg)](https://badge.fury.io/js/%40nesjs%2Fnative)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A browser-native implementation built on `@nesjs/core`, providing ready-to-use Canvas rendering, Web Audio API audio output, and keyboard/gamepad controller support.

## Features

- 🎮 Complete NES emulation based on `@nesjs/core`
- 🖼️ Canvas 2D renderer with scaling and image smoothing support
- 🎵 Web Audio API audio output with low-latency playback
- ⌨️ Customizable keyboard control mapping
- 🎯 Gamepad (Gamepad API) support with rapid-fire functionality
- 🔧 Cheat code support
- 🎨 Configurable visual effects (scaling, smoothing, border clipping, etc.)
- 📱 Responsive design, adapts to different screen sizes

## Installation

```bash
npm install @nesjs/native
```

## Quick Start

### Basic Usage

```typescript
import { NESEmulator } from '@nesjs/native'

// Get Canvas element
const canvas = document.getElementById('nes-canvas') as HTMLCanvasElement

// Create emulator instance
const emulator = new NESEmulator(canvas, {
    scale: 2,                    // 2x scaling
    smoothing: false,            // No smoothing for pixel art
    audioSampleRate: 44100,      // Audio sample rate
    enableCheat: true            // Enable cheat codes
})

// Load ROM file
const response = await fetch('path/to/game.nes')
const romData = new Uint8Array(await response.arrayBuffer())

await emulator.loadROM(romData)

// Start emulator
await emulator.start()
```

### HTML Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>NES Emulator</title>
    <style>
        #nes-canvas {
            border: 2px solid #333;
            image-rendering: pixelated; /* Keep pixel perfect */
        }
        .controls {
            margin-top: 10px;
        }
        button {
            margin: 5px;
            padding: 10px 15px;
        }
    </style>
</head>
<body>
    <canvas id="nes-canvas"></canvas>
    <div class="controls">
        <button onclick="emulator.start()">Start</button>
        <button onclick="emulator.pause()">Pause</button>
        <button onclick="emulator.reset()">Reset</button>
        <input type="file" id="rom-input" accept=".nes">
    </div>

    <script type="module">
        import { NESEmulator } from '@nesjs/native'
        
        const canvas = document.getElementById('nes-canvas')
        const emulator = new NESEmulator(canvas)
        
        // ROM file loading
        document.getElementById('rom-input').addEventListener('change', async (e) => {
            const file = e.target.files[0]
            if (file) {
                const romData = new Uint8Array(await file.arrayBuffer())
                await emulator.loadROM(romData)
            }
        })
        
        // Expose to global scope for button usage
        window.emulator = emulator
    </script>
</body>
</html>
```

Refer to [document](https://nesjs.netlify.app/guide/native) for more details.