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

## API Reference

### NESEmulator Class

#### Constructor

```typescript
new NESEmulator(canvas: HTMLCanvasElement, options?: NESEmulatorOptions)
```

**Configuration Options (NESEmulatorOptions):**

```typescript
interface NESEmulatorOptions {
    // Rendering options
    scale?: number                           // Scale multiplier, default 2
    clip8px?: boolean                        // Clip 8px border, default false
    fillColor?: string | [number, number, number, number]  // Fill color
    smoothing?: boolean                      // Image smoothing, default false
    
    // Core emulator options
    audioBufferSize?: number                 // Audio buffer size, default 1024
    audioSampleRate?: number                 // Audio sample rate, default 44100
    autoSaveInterval?: number                // Auto save interval, default 3600
    enableCheat?: boolean                    // Enable cheats, default true
    
    // Controller key mapping
    player1KeyMap?: Record<string, string>   // Player 1 key mapping
    player2KeyMap?: Record<string, string>   // Player 2 key mapping
}
```

#### Core Methods

##### loadROM(romData: Uint8Array): Promise\<void>
Load ROM file data.

##### start(): Promise\<void>
Start the emulator. If paused, resume running.

##### pause(): void
Pause the emulator.

##### resume(): void
Resume paused emulator.

##### stop(): void
Completely stop emulator and clean up resources.

##### reset(): void
Reset game to initial state.

#### Audio Control

##### enableAudio(): Promise\<boolean>
Enable audio output.

##### disableAudio(): void
Disable audio output.

##### setVolume(volume: number): void
Set volume (0.0 - 1.0).

#### Visual Settings

##### setScale(scale: number): void
Set screen scaling multiplier.

##### setSmoothing(smoothing: boolean): void
Set image smoothing on/off.

#### Cheat Functionality

##### addCheat(code: string): boolean
Add cheat code.

##### toggleCheat(code: string): void
Toggle cheat enabled state.

##### removeCheat(code: string): void
Remove cheat.

##### clearAllCheats(): void
Clear all cheats.

#### Controller Configuration

##### setupKeyboadController(player: 1 | 2, keyMap: Record<string, string>): void
Set keyboard control mapping.

## Controller Configuration

### Default Key Mapping

**Player 1 (WASD + KJ):**
```typescript
const P1_DEFAULT = {
    UP: 'KeyW',      // W - Up
    DOWN: 'KeyS',    // S - Down  
    LEFT: 'KeyA',    // A - Left
    RIGHT: 'KeyD',   // D - Right
    A: 'KeyK',       // K - A button
    B: 'KeyJ',       // J - B button
    C: 'KeyI',       // I - A rapid-fire
    D: 'KeyU',       // U - B rapid-fire
    SELECT: 'Digit2', // 2 - SELECT
    START: 'Digit1'   // 1 - START
}
```

**Player 2 (Arrow keys + Numpad):**
```typescript
const P2_DEFAULT = {
    UP: 'ArrowUp',       // ↑ - Up
    DOWN: 'ArrowDown',   // ↓ - Down
    LEFT: 'ArrowLeft',   // ← - Left  
    RIGHT: 'ArrowRight', // → - Right
    A: 'Numpad2',        // Numpad2 - A button
    B: 'Numpad1',        // Numpad1 - B button
    C: 'Numpad5',        // Numpad5 - A rapid-fire
    D: 'Numpad4',        // Numpad4 - B rapid-fire
    SELECT: 'NumpadDecimal', // Numpad. - SELECT
    START: 'NumpadEnter'     // NumpadEnter - START
}
```

### Custom Key Mapping

```typescript
// Custom player 1 keys
emulator.setupKeyboadController(1, {
    UP: 'KeyI',
    DOWN: 'KeyK', 
    LEFT: 'KeyJ',
    RIGHT: 'KeyL',
    A: 'Space',
    B: 'ShiftLeft',
    SELECT: 'KeyQ',
    START: 'KeyE'
})
```

### Gamepad Support

The emulator automatically detects and supports standard gamepads:

- **Button Mapping**: Automatically maps Xbox/PlayStation controller buttons
- **Rapid-fire**: B and Y buttons support rapid-fire by default
- **Analog Support**: Left stick controls direction
- **Plug & Play**: No additional configuration needed, auto-detects when connected

## Advanced Usage

### Display Settings

```typescript
// Create pixel-perfect display
const emulator = new NESEmulator(canvas, {
    scale: 3,              // 3x scaling
    smoothing: false,      // Disable smoothing
    clip8px: true,         // Clip edges
    fillColor: '#000000'   // Black fill
})

// Runtime adjustments
emulator.setScale(4)
emulator.setSmoothing(true)
```

### Audio Configuration

```typescript
const emulator = new NESEmulator(canvas, {
    audioSampleRate: 48000,  // High quality audio
    audioBufferSize: 512     // Low latency buffer
})

// Audio control
await emulator.enableAudio()
emulator.setVolume(0.8)       // 80% volume
emulator.disableAudio()       // Mute
```

### Cheat Code Usage

```typescript
// Add common cheat codes
emulator.addCheat('079F-01-01')

// Manage cheats
emulator.toggleCheat('079F-01-01')  // Toggle enabled state
emulator.removeCheat('079F-01-01')  // Remove
emulator.clearAllCheats()         // Clear all
```

### State Management

```typescript
// Create save state
const saveState = emulator.saveState()

// Load save state
const savedState = emulator.loadState(savedState)

// Get debug info
const debug = nes.getDebugInfo()
console.log(`Frame: ${debug.frameCount}, CPU: ${debug.cpuCycles}`)
```

## Browser Compatibility

- **Chrome 66+** - Full support
- **Firefox 60+** - Full support  
- **Safari 11.1+** - Full support
- **Edge 79+** - Full support

**Required APIs:**
- Canvas 2D Context
- Web Audio API
- Gamepad API (optional)
- ArrayBuffer/Uint8Array

## Performance Optimization

### Recommended Configuration

```typescript
// Performance priority
const emulator = new NESEmulator(canvas, {
    scale: 2,
    smoothing: false,        // Disable smoothing to reduce GPU load
    audioBufferSize: 2048,   // Larger buffer to reduce audio stuttering
})

// Quality priority  
const emulator = new NESEmulator(canvas, {
    scale: 4,
    smoothing: true,         // Smooth scaling
    audioSampleRate: 48000,  // High audio quality
    audioBufferSize: 512,    // Low latency
})
```

## Troubleshooting

### Common Issues

**Audio not playing:**
```typescript
// Make sure to enable audio after user interaction
const enableAudioOnInteraction = async() => {
    await emulator.enableAudio()

    // Remove event listeners
    document.removeEventListener('click', enableAudioOnInteraction)
    document.removeEventListener('keydown', enableAudioOnInteraction)
    document.removeEventListener('touchstart', enableAudioOnInteraction)
}

document.addEventListener('click', enableAudioOnInteraction)
document.addEventListener('keydown', enableAudioOnInteraction)
document.addEventListener('touchstart', enableAudioOnInteraction)
```

**Blurry display:**
```typescript
// Make sure smoothing is off and set CSS
emulator.setSmoothing(false)
canvas.style.imageRendering = 'pixelated'
```

**Performance issues:**
```typescript
// Check frame rate
let frameCount = 0
setInterval(() => {
    const debug = emulator.nes.getDebugInfo()
    console.log(`FPS: ${debug.frameCount - frameCount}`)
    frameCount = debug.frameCount
}, 1000)
```