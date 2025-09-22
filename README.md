# NESJS

English | [中文](./README.zh-CN.md)

[documentation](https://nesjs.netlify.app/)

Monorepo for a modern NES (Nintendo Entertainment System) emulator written in TypeScript. It contains:

- @nesjs/core — framework-agnostic emulator core (CPU/PPU/APU, mappers, save states, cheats)
- @nesjs/native — browser-native runtime with Canvas/WebAudio/Keyboard/Gamepad
- @nesjs/vue3 — Vue 3 component wrapper powered by the native runtime
- @nesjs/react — React component wrapper powered by the native runtime

> Looking for package-level API docs and usage? Jump to: [core](./packages/core/README.md) · [native](./packages/native/README.md) · [vue3](./packages/vue3/README.md), [documentation](https://nesjs.netlify.app/)

## Features

- Accurate NES emulation core (CPU, PPU, APU) with many mapper chips supported
- Renderer and audio interfaces decoupled from UI frameworks
- Save/Load state, SRAM, and cheat-code support
- Browser-native Canvas and WebAudio implementation
- Vue 3 component with reactive props and full TypeScript support

## ROM Compatibility

Supported Mappers: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 16, 18, 19, 21, 22, 23, 24, 25, 26, 31, 33, 34, 36, 38, 39, 41, 47, 48, 58, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 78, 79, 85, 86, 88, 87, 89, 92, 93, 94, 97, 107, 112, 113, 115, 118, 119, 129, 140, 152, 154, 169, 180, 182, 184, 185, 195, 200, 201, 203, 206, 212, 213, 225, 226, 228, 229, 231, 240, 241, 242, 244, 245, 246, 248, 249, 255.

## Requirements

- Node.js 18+ (recommended)
- pnpm 8+

## Usage

- Vanilla/Browser: use @nesjs/native for a ready-to-use Canvas/WebAudio emulator. See [packages/native/README.md](./packages/native/README.md) for a full quick start and HTML example.
- Vue 3: drop the `<NesVue />` component into your app. See [packages/vue3/README.md](./packages/vue3/README.md) for props, methods, and examples.
- Library Integrators: embed the core via @nesjs/core if you need custom render/audio backends. See [packages/core/README.md](./packages/core/README.md).

## License

MIT — see individual package LICENSE files (e.g. [packages/core/LICENSE.md](./packages/core/LICENSE.md)).


