# @nesjs/react - React NES Emulator Component

[![npm version](https://badge.fury.io/js/%40nesjs%2Fcore.svg)](https://badge.fury.io/js/%40nesjs%2Freact)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This page shows how to use the `@nesjs/react` component to embed the NES emulator in React apps.

## Installation

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

## Quick start

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
        onLoaded={() => console.log('ROM loaded')}
        onReady={() => console.log('Emulator ready')}
        onError={(e)=> console.error(e)}
      />
      <div style={{ marginTop: 8 }}>
        <button onClick={() => ref.current?.togglePlay()}>Play/Pause</button>
        <button onClick={() => ref.current?.reset()}>Reset</button>
        <button onClick={() => ref.current?.downloadSaveState()}>Save</button>
        <button onClick={() => ref.current?.uploadSaveState()}>Load</button>
      </div>
    </div>
  )
}
```

## Props

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

## Methods (ref)

- start, pause, resume(play), stop, togglePlay, reset
- save(): Uint8Array
- load(state: Uint8Array): boolean
- screenshot(download?: boolean): string
- downloadSaveState(), uploadSaveState()
- addCheat/removeCheat/toggleCheat/clearAllCheats
- getROMInfo(), getDebugInfo()

## Tips

- Audio may require a user gesture to start on browsers. The component auto wires a click/keydown/touchstart listener when autoStart is true to unlock audio.
- Use `fillColor` together with `clip8px` to get visual borders for the hidden 8px area.
