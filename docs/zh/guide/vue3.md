# @nesjs/vue3 - Vue 3 NES 模拟器组件

[![npm version](https://badge.fury.io/js/%40nesjs%2Fvue3.svg)](https://badge.fury.io/js/%40nesjs%2Fvue3) 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

基于 [@nesjs/native](./native) 的 Vue 3 组件封装，提供开箱即用的 NES 模拟器 Vue 组件。

## 特性

- 🎮 基于 `@nesjs/native` 的完整 NES 模拟功能
- ⚡ Vue 3 Composition API 支持
- 📦 开箱即用，一个组件搞定
- 🎯 TypeScript 完整支持
- 🎨 响应式配置和状态管理
- 🔧 丰富的 API 和事件回调
- 📱 移动端适配支持
- 🎵 自动音频激活处理

## 安装

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

## 快速开始

### 基础使用示例

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { NesVue } from '@nesjs/vue3'
import type { NESComponentExpose } from '@nesjs/vue3'

const nesRef = ref<NESComponentExpose>()
const romUrl = '/path/to/your/game.nes'

// 模拟器配置
const emulatorConfig = {
  scale: 2,
  smoothing: false,
  clip8px: true,
  audioBufferSize: 1024,
  audioSampleRate: 44100
}

const isPlaying = computed(() => nesRef.value?.isPlaying || false)

const togglePlay = async() => {
    await nesRef.value?.togglePlay()
}

const reset = () => {
    nesRef.value?.reset()
}

const screenshot = () => {
    nesRef.value?.screenshot(true) // true = 自动下载
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
      <button @click="togglePlay">{{ isPlaying ? '暂停' : '开始' }}</button>
      <button @click="reset">重置</button>
      <button @click="screenshot">截图</button>
      <button @click="downloadSave">下载存档</button>
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

### 全局注册

```typescript
// main.ts
import { createApp } from 'vue'
import NesVuePlugin from '@nesjs/vue3'
import App from './App.vue'

const app = createApp(App)

// 全局注册组件
app.use(NesVuePlugin)

app.mount('#app')
```

```vue
<!-- 在任意组件中直接使用 -->
<template>
  <NesVue :rom="romData" :scale="3" />
</template>
```

## API 参考

### Props (配置选项)

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `rom` | `string` \| `Uint8Array` \| `ArrayBuffer` \| `Blob` | - | ROM 数据源（必需）|
| `autoStart` | `boolean` | `false` | 是否自动开始游戏 |
| `volume` | `number` | `50` | 音量大小 (0-100) |
| `debugMode` | `boolean` | `false` | 是否开启调试模式 |
| `mashingSpeed` | `number` | `16` | 连发速度 |
| `emulatorConfig` | `EmulatorConfigOptions` | 见下方 | 模拟器配置对象 |

### 模拟器配置选项 (EmulatorConfig)

`emulatorConfig` 属性接受一个包含以下属性的对象：

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `scale` | `number` | `2` | 画面缩放倍数 |
| `smoothing` | `boolean` | `false` | 是否启用图像平滑 |
| `clip8px` | `boolean` | `true` | 是否裁剪边框8像素 |
| `fillColor` | `string | [number, number, number, number]` | - | 裁剪区域的填充颜色 |
| `audioBufferSize` | `number` | `1024` | 音频缓冲区大小 |
| `audioSampleRate` | `number` | `44100` | 音频采样率 |
| `autoSaveInterval` | `number` | - | SRAM存档自动保存间隔（帧数） |
| `enableCheat` | `boolean` | - | 是否启用金手指 |
| `player1KeyMap` | `Record<string, string>` | - | 玩家1键位映射 |
| `player2KeyMap` | `Record<string, string>` | - | 玩家2键位映射 |

#### 注意事项：autoStart 与音频播放

如果你在配置中启用了 `autoStart`，请注意：

**在用户与页面进行交互（如点击、按键、触摸）之前，浏览器不会允许音频播放，因此在此之前不会有声音输出。**

这是浏览器的安全策略，旨在防止自动播放音频。模拟器画面和游戏逻辑会正常运行，但声音会在用户首次交互后才激活。

建议在界面上适当提示用户需要操作页面以启用声音。

### 方法 (通过 ref 调用)

#### 游戏控制

```typescript
// 开始游戏
await nesRef.value?.start()

// 暂停游戏  
nesRef.value?.pause()

// 继续游戏
nesRef.value?.play()

// 切换播放状态
await nesRef.value?.togglePlay()

// 重置游戏
nesRef.value?.reset()

// 停止游戏
nesRef.value?.stop()

// 添加金手指
nesRef.value?.addCheat('07FA-01-01')

// 移除金手指
nesRef.value?.removeCheat('07FA-01-01')

// 切换金手指状态
nesRef.value?.toggleCheat('07FA-01-01')

// 移除所有金手指
nesRef.value?.clearAllCheats()
```

#### 存档系统

```typescript
// 创建存档数据
const saveData = nesRef.value?.save() // Uint8Array

// 你可以将其保存到任意地方，例如 localStorage 
localStorage.setItem('nes-save', JSON.stringify(Array.from(saveData)))

// 加载存档数据
const data = localStorage.getItem('nes-save')
const success = nesRef.value?.load(new Uint8Array(JSON.parse(data)))

// 下载存档文件
nesRef.value?.downloadSaveState()

// 上传存档文件
await nesRef.value?.uploadSaveState()
```

#### 截图功能

```typescript
// 获取截图数据URL
const dataUrl = nesRef.value?.screenshot()

// 自动下载截图
nesRef.value?.screenshot(true)
```

#### 信息获取

```typescript
// 获取ROM信息
const romInfo = nesRef.value?.getROMInfo()
console.log(romInfo?.mapperNumber) // Mapper编号

// 获取调试信息
const debug = nesRef.value?.getDebugInfo()
console.log(debug?.frameCount) // 帧数

// 获取游戏状态
const isPlaying = nesRef.value?.isPlaying // 是否在游戏中
const isLoading = nesRef.value?.isLoading // 是否在加载中
```

## 高级用法

### 自定义键位映射

```vue
<script setup>
// 自定义玩家1键位
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

### 响应式配置

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
const romUrl = '/games/your-rom.nes'
</script>

<template>
  <div>
    <!-- 配置面板 -->
    <div class="config-panel">
      <label>
        音量: {{ volume }}
        <input v-model.number="volume" type="range" min="0" max="100">
      </label>
      
      <label>
        缩放: {{ emulatorConfig.scale }}x
        <input v-model.number="emulatorConfig.scale" type="range" min="1" max="5">
      </label>
      
      <label>
        <input v-model="emulatorConfig.smoothing" type="checkbox"> 图像平滑
      </label>
    </div>
    
    <!-- 模拟器组件 -->
    <NesVue 
      :rom="romUrl"
      :volume="volume"
      :emulator-config="emulatorConfig"
    />
  </div>
</template>
```

### 多种 ROM 数据源支持

```vue
<script setup>
import { ref } from 'vue'

const romData = ref(null)
const romUrl = ref('')

// 文件上传
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (file) {
    romData.value = await file.arrayBuffer()
  }
}

// URL加载
const loadFromUrl = () => {
  if (romUrl.value) {
    romData.value = romUrl.value
  }
}
</script>

<template>
  <div>
    <!-- 文件上传 -->
    <input type="file" @change="handleFileUpload" accept=".nes">
    
    <!-- 从URL加载 -->
    <input v-model="romUrl" placeholder="输入ROM URL">
    <button @click="loadFromUrl">从URL加载</button>
    
    <!-- 模拟器 -->
    <NesVue v-if="romData" :rom="romData" />
  </div>
</template>
```

### 游戏状态管理示例

```vue
<script setup>
import { ref, computed } from 'vue'

const nesRef = ref()
const debugMode = ref(false)

const isLoading = computed(() => nesRef.value?.isLoading)
const isPlaying = computed(() => nesRef.value?.isPlaying) 
const romInfo = computed(() => nesRef.value?.getROMInfo())
const debugInfo = computed(() => nesRef.value?.getDebugInfo())
</script>

<template>
  <div>
    <div class="status-bar">
      <span v-if="isLoading">加载中...</span>
      <span v-else-if="isPlaying">游戏运行中</span>
      <span v-else>游戏已暂停</span>
      
      <span v-if="romInfo">
        | Mapper: {{ romInfo.mapperNumber }}
        | PRG: {{ romInfo.prgSize }}KB
        | CHR: {{ romInfo.chrSize }}KB
      </span>
    </div>
    
    <NesVue ref="nesRef" :rom="romUrl" />
    
    <div class="debug-panel" v-if="debugMode">
      <h3>调试信息</h3>
      <pre>{{ JSON.stringify(debugInfo, null, 2) }}</pre>
    </div>
  </div>
</template>
```

### 移动端适配示例

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
    
    <!-- 虚拟按键 -->
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

## 常见问题

### 音频无法播放

由于浏览器安全策略，音频需要用户交互后才能激活。组件已自动处理这个问题，但如果仍有问题，可以手动处理：

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
    <button v-if="!audioEnabled" @click="enableAudio">启用音频</button>
    <NesVue ref="nesRef" :rom="romUrl" />
  </div>
</template>

```

### ROM 文件加载失败

确保 ROM 文件路径正确，且服务器支持相应的 MIME 类型：

```javascript
// vite.config.js 或 webpack 配置
export default {
  server: {
    // 添加 .nes 文件的 MIME 类型支持
    mimeTypes: {
      'application/octet-stream': ['nes']
    }
  }
}
```

### 性能优化

对于低端设备，可以调整配置以提升性能：

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

## 浏览器支持

- Chrome 66+ ✅
- Firefox 60+ ✅  
- Safari 11.1+ ✅
- Edge 79+ ✅
