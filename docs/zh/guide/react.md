# @nesjs/react React NES模拟器组件

[![npm version](https://badge.fury.io/js/%40nesjs%2Fcore.svg)](https://badge.fury.io/js/%40nesjs%2Freact)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

本页展示如何在 React 应用中使用 `@nesjs/react` 组件嵌入 NES 模拟器。

## 安装

::: code-group
```bash [npm]
npm i @nesjs/react
```

```bash [yarn]
yarn add @nesjs/react
```

```bash [pnpm]
pnpm add @nesjs/react
```
:::

## 快速开始

```tsx
import React, { useRef } from 'react'
import { NESEmulatorReact } from '@nesjs/react'
import type { NESComponentExpose } from '@nesjs/react'

export default function Demo() {
  const ref = useRef<NESComponentExpose>(null)

  return (
    <div>
      <NESEmulatorReact
        ref={ref}
        rom="/your-game.nes"
        autoStart
        volume={60}
        emulatorConfig={{ scale: 2, smoothing: false, clip8px: true }}
        onLoaded={() => console.log('ROM 加载完成')}
        onReady={() => console.log('模拟器已就绪')}
        onError={(e)=> console.error(e)}
      />
      <div style={{ marginTop: 8 }}>
        <button onClick={() => ref.current?.togglePlay()}>播放/暂停</button>
        <button onClick={() => ref.current?.reset()}>复位</button>
        <button onClick={() => ref.current?.downloadSaveState()}>保存进度</button>
        <button onClick={() => ref.current?.uploadSaveState()}>载入进度</button>
      </div>
    </div>
  )
}
```

## 属性（Props）

- rom: string | ArrayBuffer | Uint8Array | Blob
- autoStart?: boolean
- volume?: number (0 ~ 100)
- debugMode?: boolean
- emulatorConfig?:
  - scale?: number
  - clip8px?: boolean
  - smoothing?: boolean
  - audioBufferSize?: number
  - audioSampleRate?: number
  - fillColor?: string | [r,g,b,a]
  - player1KeyMap?: Record<string,string>
  - player2KeyMap?: Record<string,string>
- onLoaded?: () => void
- onError?: (err: Error) => void
- onReady?: () => void

## 方法（ref）

- start, pause, resume(play), stop, togglePlay, reset
- save(): Uint8Array
- load(state: Uint8Array): boolean
- screenshot(download?: boolean): string
- downloadSaveState(), uploadSaveState()
- addCheat/removeCheat/toggleCheat/clearAllCheats
- getROMInfo(), getDebugInfo()

## 小贴士

- 浏览器通常需要用户手势才能启用音频。开启 autoStart 时组件会自动挂载 click/keydown/touchstart 监听，以解锁音频。
- 配合 `clip8px` 可使用 `fillColor` 指定被裁切边框的颜色。
