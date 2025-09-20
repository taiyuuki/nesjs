# NESJS

English | [中文](./README.zh-CN.md)

Monorepo for a modern NES (Nintendo Entertainment System) emulator written in TypeScript. It contains:

- @nesjs/core — framework-agnostic emulator core (CPU/PPU/APU, mappers, save states, cheats)
- @nesjs/native — browser-native runtime with Canvas/WebAudio/Keyboard/Gamepad
- @nesjs/vue3 — Vue 3 component wrapper powered by the native runtime

> Looking for package-level API docs and usage? Jump to: [core](./packages/core/README.md) · [native](./packages/native/README.md) · [vue3](./packages/vue3/README.md)

## Features

- Accurate NES emulation core (CPU, PPU, APU) with many mapper chips supported
- Renderer and audio interfaces decoupled from UI frameworks
- Save/Load state, SRAM, and cheat-code support
- Browser-native Canvas and WebAudio implementation
- Vue 3 component with reactive props and full TypeScript support

## Requirements

- Node.js 18+ (recommended)
- pnpm 8+

## Usage

- Vanilla/Browser: use @nesjs/native for a ready-to-use Canvas/WebAudio emulator. See [packages/native/README.md](./packages/native/README.md) for a full quick start and HTML example.
- Vue 3: drop the `<NesVue />` component into your app. See [packages/vue3/README.md](./packages/vue3/README.md) for props, methods, and examples.
- Library Integrators: embed the core via @nesjs/core if you need custom render/audio backends. See [packages/core/README.md](./packages/core/README.md).

## License

MIT — see individual package LICENSE files (e.g. [packages/core/LICENSE.md](./packages/core/LICENSE.md)).

## Related Packages

- @nesjs/core — emulator core
- @nesjs/native — browser-native implementation
- @nesjs/vue3 — Vue 3 component

