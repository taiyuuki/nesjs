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

```bash
npm install @nesjs/vue3
```

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

Refer to [document](https://nesjs.netlify.app/guide/vue3) for more details.