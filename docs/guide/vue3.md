# @nesjs/vue3 - Vue 3 NES Emulator Component

[![npm version](https://badge.fury.io/js/%40nesjs%2Fvue3.svg)](https://badge.fury.io/js/%40nesjs%2Fvue3)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Vue 3 component wrapper for [@nesjs/native](./native), providing a ready-to-use NES emulator Vue component.

## Features

- 🎮 Complete NES emulation functionality based on `@nesjs/native`
- ⚡ Vue 3 Composition API support
- 📦 Out of the box, single component solution
- 🎯 Full TypeScript support
- 🎨 Reactive configuration and state management
- 🔧 Rich API and event callbacks
- 📱 Mobile device adaptation support
- 🎵 Automatic audio activation handling

## Installation

::: code-group
```bash [npm]
npm install @nesjs/vue3
```

```bash [yarn]
yarn add @nesjs/vue3
```

```bash [pnpm]
pnpm add @nesjs/vue3
```
:::

## Quick Start

### Basic Usage

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { NesVue } from '@nesjs/vue3'
import type { NESComponentExpose } from '@nesjs/vue3'

const nesRef = ref<NESComponentExpose>()
const romUrl = '/path/to/your/game.nes'

// Emulator configuration
const emulatorConfig = {
  scale: 2,
  smoothing: false,
  clip8px: true,
  audioBufferSize: 1024,
  audioSampleRate: 44100
}

const isPlaying = computed(() => nesRef.value?.isPlaying || false)

const togglePlay = async () => {
  await nesRef.value?.togglePlay()
}

const reset = () => {
  nesRef.value?.reset()
}

const screenshot = () => {
  nesRef.value?.screenshot(true) // true = auto download
}

const downloadSave = () => {
  nesRef.value?.downloadSaveState()
}
</script>

<template>
  <div class="nes-container">
    <NesVue 
      ref="nesRef"
      :rom="romUrl" 
      :volume="80"
      :auto-start="false"
      :emulator-config="emulatorConfig"
      class="nes-emulator"
    />
    <div class="controls">
      <button @click="togglePlay">{{ isPlaying ? 'Pause' : 'Start' }}</button>
      <button @click="reset">Reset</button>
      <button @click="screenshot">Screenshot</button>
      <button @click="downloadSave">Download Save</button>
    </div>
  </div>
</template>

<style scoped>
.nes-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.nes-emulator {
  border: 2px solid #333;
  border-radius: 8px;
}

.controls {
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f0f0f0;
  cursor: pointer;
  color: #000;
}

button:hover {
  background: #e0e0e0;
}
</style>
```

### Global Registration

```typescript
// main.ts
import { createApp } from 'vue'
import NesVuePlugin from '@nesjs/vue3'
import App from './App.vue'

const app = createApp(App)

// Register component globally
app.use(NesVuePlugin)

app.mount('#app')
```

```vue
<!-- Use directly in any component -->
<template>
  <NesVue :rom="romData" :scale="3" />
</template>
```

## API Reference

### Props (Configuration Options)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rom` | `string` \| `Uint8Array` \| `ArrayBuffer` \| `Blob` | - | ROM data source (required) |
| `autoStart` | `boolean` | `false` | Auto start the game |
| `volume` | `number` | `50` | Volume level (0-100) |
| `debugMode` | `boolean` | `false` | Enable debug mode |
| `mashingSpeed` | `number` | `16` | Mashing speed for rapid button presses |
| `emulatorConfig` | `EmulatorConfigOptions` | See below | Emulator configuration object |

### EmulatorConfig Options

The `emulatorConfig` prop accepts an object with the following properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `scale` | `number` | `2` | Screen scaling multiplier |
| `smoothing` | `boolean` | `false` | Enable image smoothing |
| `clip8px` | `boolean` | `true` | Clip 8px border |
| `fillColor` | `string | [number, number, number, number]` | - | Fill color |
| `audioBufferSize` | `number` | `1024` | Audio buffer size |
| `audioSampleRate` | `number` | `44100` | Audio sample rate |
| `autoSaveInterval` | `number` | - | Auto save (SRAM) interval in frames |
| `enableCheat` | `boolean` | - | Enable cheat codes |
| `player1KeyMap` | `Record<string, string>` | - | Player 1 key mapping |
| `player2KeyMap` | `Record<string, string>` | - | Player 2 key mapping |

#### Important Note: autoStart & Audio Playback

If you enable `autoStart` in your configuration, please note:

**Audio will not play until the user interacts with the page (such as clicking, pressing a key, or touching). Before any user gesture, browsers will block audio playback, so there will be no sound output.**

This is a browser security policy to prevent auto-playing audio. The emulator graphics and game logic will run normally, but sound will only be activated after the user's first interaction.

It is recommended to show a prompt in your UI to let users know they need to interact with the page to enable sound.

### Methods (Via ref)

#### Game Control

```typescript
// Start game
await nesRef.value?.start()

// Pause game  
nesRef.value?.pause()

// Resume game
nesRef.value?.play()

// Toggle play state
await nesRef.value?.togglePlay()

// Reset game
nesRef.value?.reset()

// Stop game
nesRef.value?.stop()

// Add cheat
nesRef.value?.addCheat('07FA-01-01')

// Remove cheat
nesRef.value?.removeCheat('07FA-01-01')

// Toggle cheat state
nesRef.value?.toggleCheat('07FA-01-01')

// Remove all cheats
nesRef.value?.clearAllCheats()
```

#### Save System

```typescript
// Create save data
const saveData = nesRef.value?.save() // Uint8Array

// Load save data
const success = nesRef.value?.load(saveData)

// Download save file
nesRef.value?.downloadSaveState()

// Upload save file
await nesRef.value?.uploadSaveState()
```

#### Screenshot

```typescript
// Get screenshot data URL
const dataUrl = nesRef.value?.screenshot()

// Auto download screenshot
nesRef.value?.screenshot(true)
```

#### Information

```typescript
// Get ROM info
const romInfo = nesRef.value?.getROMInfo()
console.log(romInfo?.mapperNumber) // Mapper number

// Get debug info
const debug = nesRef.value?.getDebugInfo()
console.log(debug?.frameCount) // Frame count

// Get game state
const isPlaying = nesRef.value?.isPlaying // Is playing
const isLoading = nesRef.value?.isLoading // Is loading
```

## Advanced Usage

### Custom Key Mapping

```vue
<script setup>
// Custom player 1 keys
const customKeyMap = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown', 
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  A: 'Space',
  B: 'ShiftLeft',
  SELECT: 'KeyQ',
  START: 'KeyE'
}
</script>

<template>
  <NesVue 
    :rom="romUrl"
    :emulator-config="{ player1KeyMap: customKeyMap }"
  />
</template>
```

### Reactive Configuration

```vue
<script setup>
import { reactive, ref } from 'vue'

const volume = ref(70)
const emulatorConfig = reactive({
  scale: 2,
  smoothing: false,
  clip8px: true,
  audioBufferSize: 1024,
  audioSampleRate: 44100
})
const romUrl = '/games/mario.nes'
</script>

<template>
  <div>
    <!-- Config panel -->
    <div class="config-panel">
      <label>
        Volume: {{ volume }}
        <input v-model.number="volume" type="range" min="0" max="100">
      </label>
      
      <label>
        Scale: {{ emulatorConfig.scale }}x
        <input v-model.number="emulatorConfig.scale" type="range" min="1" max="5">
      </label>
      
      <label>
        <input v-model="emulatorConfig.smoothing" type="checkbox"> Image Smoothing
      </label>
    </div>
    
    <!-- Emulator component -->
    <NesVue 
      :rom="romUrl"
      :volume="volume"
      :emulator-config="emulatorConfig"
    />
  </div>
</template>
```

### Multiple ROM Source Support

```vue
<script setup>
import { ref } from 'vue'

const romData = ref(null)
const romUrl = ref('')

// File upload
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (file) {
    romData.value = await file.arrayBuffer()
  }
}

// URL loading
const loadFromUrl = () => {
  if (romUrl.value) {
    romData.value = romUrl.value
  }
}
</script>

<template>
  <div>
    <!-- File upload -->
    <input type="file" @change="handleFileUpload" accept=".nes">
    
    <!-- Load from URL -->
    <input v-model="romUrl" placeholder="Enter ROM URL">
    <button @click="loadFromUrl">Load from URL</button>
    
    <!-- Emulator -->
    <NesVue v-if="romData" :rom="romData" />
  </div>
</template>
```

### Game State Management

```vue
<template>
  <div>
    <div class="status-bar">
      <span v-if="isLoading">Loading...</span>
      <span v-else-if="isPlaying">Game Running</span>
      <span v-else>Game Paused</span>
      
      <span v-if="romInfo">
        | Mapper: {{ romInfo.mapperNumber }}
        | PRG: {{ romInfo.prgSize }}KB
        | CHR: {{ romInfo.chrSize }}KB
      </span>
    </div>
    
    <NesVue ref="nesRef" :rom="romUrl" />
    
    <div class="debug-panel" v-if="debugMode">
      <h3>Debug Info</h3>
      <pre>{{ JSON.stringify(debugInfo, null, 2) }}</pre>
    </div>
  </div>
</template>
```

### Mobile Adaptation

```vue
<script setup>
import { ref, computed } from 'vue'
import { NESControllerButton } from '@nesjs/core'

const nesRef = ref()

const isMobile = computed(() => {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
})

const pressButton = (button) => {
  const gamepad = nesRef.value?.emulator?.getGamepad(1)
  gamepad?.setButton(NESControllerButton[button], 1)
}

const releaseButton = (button) => {
  const gamepad = nesRef.value?.emulator?.getGamepad(1)  
  gamepad?.setButton(NESControllerButton[button], 0)
}
</script>

<template>
  <div class="mobile-container">
    <NesVue 
      ref="nesRef"
      :rom="romUrl"
      :scale="isMobile ? 1 : 2"
      class="mobile-emulator"
    />
    
    <!-- Virtual controls -->
    <div v-if="isMobile" class="virtual-controls">
      <div class="dpad">
        <button @touchstart="pressButton('UP')" @touchend="releaseButton('UP')">↑</button>
        <div class="dpad-middle">
          <button @touchstart="pressButton('LEFT')" @touchend="releaseButton('LEFT')">←</button>
          <button @touchstart="pressButton('RIGHT')" @touchend="releaseButton('RIGHT')">→</button>
        </div>
        <button @touchstart="pressButton('DOWN')" @touchend="releaseButton('DOWN')">↓</button>
      </div>
      
      <div class="action-buttons">
        <button @touchstart="pressButton('B')" @touchend="releaseButton('B')">B</button>
        <button @touchstart="pressButton('A')" @touchend="releaseButton('A')">A</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.virtual-controls {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 400px;
  margin-top: 20px;
}

.dpad {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  gap: 2px;
}

.dpad button {
  width: 50px;
  height: 50px;
  border: 2px solid #333;
  background: #f0f0f0;
  font-size: 16px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.action-buttons button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid #333;
  background: #f0f0f0;
  font-weight: bold;
}
</style>
```

## Troubleshooting

### Audio Not Playing

Due to browser security policies, audio requires user interaction to activate. The component handles this automatically, but if issues persist, you can manually handle it:

```vue
<script setup>
const audioEnabled = ref(false)

const enableAudio = async () => {
  await nesRef.value?.emulator?.enableAudio()
  audioEnabled.value = true
}
</script>

<template>
  <div>
    <button v-if="!audioEnabled" @click="enableAudio">Enable Audio</button>
    <NesVue ref="nesRef" :rom="romUrl" />
  </div>
</template>
```

### ROM File Loading Failed

Ensure ROM file path is correct and server supports appropriate MIME types:

```javascript
// vite.config.js or webpack config
export default {
  server: {
    // Add MIME type support for .nes files
    mimeTypes: {
      'application/octet-stream': ['nes']
    }
  }
}
```

### Performance Optimization

For low-end devices, adjust configuration to improve performance:

```vue
<NesVue 
  :rom="romUrl"
  :emulator-config="{
    scale: 1,
    smoothing: false,
    audioBufferSize: 2048
  }"
/>
```

## Browser Support

- Chrome 66+ ✅
- Firefox 60+ ✅  
- Safari 11.1+ ✅
- Edge 79+ ✅
