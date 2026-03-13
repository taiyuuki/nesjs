# @nesjs/core - NES 模拟器核心库

[![npm version](https://badge.fury.io/js/%40nesjs%2Fcore.svg)](https://badge.fury.io/js/%40nesjs%2Fcore) 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

NES (Nintendo Entertainment System) 模拟器核心库，提供完整的 NES 硬件仿真功能，与 UI 框架无关。

## 特性

- 🎮 完整的 NES 硬件仿真 (CPU, PPU, APU)
- 🎯 支持多种 Mapper (映射器)
- 🎵 音频输出支持
- 🕹️ 双手柄控制
- 💾 存档/读档功能
- 🔧 金手指支持
- 🎨 可自定义渲染器和音频接口
- 📝 TypeScript 支持

## ROM 兼容性

支持的 Mapper: 0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 15, 16, 18, 19, 21, 22, 23, 24, 25, 26, 30, 31, 33, 34, 36, 38, 39, 41, 47, 48, 58, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 78, 79, 85, 86, 88, 87, 89, 92, 93, 94, 97, 107, 112, 113, 115, 118, 119, 129, 140, 152, 154, 162, 163, 164, 169, 176, 180, 182, 184, 185, 195, 200, 201, 203, 206, 212, 213, 214, 225, 226, 228, 229, 231, 240, 241, 242, 244, 245, 246, 248, 249, 255.

## 安装

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

## 快速开始

### 基础使用

```typescript
import { NES } from '@nesjs/core'

// 创建 NES 实例
const nes = new NES({
    audioSampleRate: 44100,
    audioBufferSize: 1024,
    enableCheat: true
})

// 实现渲染器接口
class MyRenderer {
    renderFrame(imageData: Uint8Array) {
        // 处理 256x240 RGBA 图像数据
        console.log('渲染帧数据:', imageData.length) // 245760 bytes
    }
}

// 实现音频接口
class MyAudioOutput {
    outputSample(sample: number) {
        // 处理音频采样数据
    }
    
    flushFrame() {
        // 刷新音频帧
    }
}

// 设置接口
nes.setRenderer(new MyRenderer())
nes.setAudioInterface(new MyAudioOutput())

// 加载 ROM
const romData = new Uint8Array(/* ROM 文件数据 */)
await nes.loadROM(romData)

// 运行模拟器
function gameLoop() {
    nes.runFrame()
    requestAnimationFrame(gameLoop)
}
gameLoop()
```

### 控制器操作

```typescript
import { NESControllerButton } from '@nesjs/core'

// 获取玩家手柄
const gamepad = nes.getGamepad(1) // 玩家1
const gamepad2 = nes.getGamepad(2) // 玩家2

// 设置按键
gamepad.setButton(NESControllerButton.A, 1) // 按下 A 键
gamepad.setButton(NESControllerButton.A, 0) // 释放 A 键

// 批量设置按键
gamepad.setButtons([1, 0, 0, 0, 0, 0, 0, 0]) // 只按下 A 键

// 获取按键状态
const buttonStates = gamepad.getButtonStates()
console.log('A 键状态:', buttonStates.A)
```

### 存档系统

```typescript
// 创建存档
const saveData = nes.createSaveState()

// 加载存档  
const success = nes.loadSaveState(saveData)

// 二进制存档（文件更小）
const binaryData = nes.createBinarySaveState()
const loadSuccess = nes.loadBinarySaveState(binaryData)

// SRAM 存档
const sramData = nes.saveSRAM()
if (sramData) {
    // 保存 SRAM 数据到文件
    localStorage.setItem('sram', JSON.stringify(sramData))
}

// 加载 SRAM
const savedSram = localStorage.getItem('sram')
if (savedSram) {
    nes.loadSRAM(JSON.parse(savedSram))
}
```

### 金手指功能

```typescript
// 启用金手指
await nes.enableCheat()

const cheater = nes.getCheater()
if (cheater) {
    // 添加金手指代码
    cheater.addCheat('079F-01-01')
    
    // 启用/禁用金手指
    cheater.setCheatEnabled('079F-01-01', true)
    
    // 获取金手指信息
    const cheat = cheater.getCheat('079F-01-01')
    
    // 清除所有金手指
    cheater.clearCheats()
}
```

## API 参考

### NES 类

#### 构造函数

```typescript
new NES(config?: EmulatorConfig, events?: EmulatorEvents)
```

**配置选项 (EmulatorConfig):**

- `audioBufferSize?: number` - 音频缓冲区大小，默认 1024
- `audioSampleRate?: number` - 音频采样率，默认 44100
- `autoSaveInterval?: number` - 自动保存间隔（帧数），默认 3600
- `enableCheat?: boolean` - 启用金手指，默认 true

**事件回调 (EmulatorEvents):**

- `onFrameComplete?: (frameCount: number) => void` - 帧完成回调
- `onROMLoaded?: (romInfo: ROMInfo) => void` - ROM 加载完成回调  
- `onError?: (error: Error) => void` - 错误回调

#### 核心方法

##### setRenderer(renderer: RendererInterface)
设置渲染器接口。

```typescript
interface RendererInterface {
    renderFrame(imageData: Uint8Array): void
}
```

##### setAudioInterface(audioInterface: AudioOutputInterface)  
设置音频接口。

```typescript
interface AudioOutputInterface {
    outputSample(sample: number): void
    flushFrame(): void
}
```

##### loadROM(romData: Uint8Array): Promise\<void>
加载 ROM 文件。

##### runFrame(): void
运行一帧模拟。

##### reset(): void  
重置模拟器。

##### getGamepad(player: 1 | 2): GamepadInterface
获取指定玩家的手柄接口。

##### getDebugInfo(): DebugInfo
获取调试信息。

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

### GamepadInterface 接口

#### setButton(button: NESControllerButton, pressed: GamepadButtonState)
设置单个按键状态。

#### setButtons(buttons: GamepadButtonState[])
批量设置按键状态。

#### getButtonStates()
获取当前所有按键状态。

#### reset()
重置所有按键。

### 按键常量

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

## 接口实现指南

### 实现渲染器

```typescript
class CanvasRenderer implements RendererInterface {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!
        
        // NES 分辨率
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

### 实现音频输出

```typescript
class WebAudioOutput implements AudioOutputInterface {
    
    constructor() {
        this.audioCtx = new AudioContext();
        this.sampleRate = this.audioCtx.sampleRate;
        this.samples = [];
    }
    
    outputSample(sample: number): void {
        // 将样本添加到缓冲区
        this.samples.push(sample / 0x7FFF) // 归一化到 [-1, 1]
    }
    
    flushFrame(): void {
        // 将缓冲区数据发送到音频上下文
        // 具体实现取决于您的音频架构
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
