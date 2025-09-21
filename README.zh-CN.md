# NESJS

[English](./README.md) | 中文

[文档](https://nesjs.netlify.app/zh/)

TypeScript 实现的现代 NES（红白机）模拟器 Monorepo，包含：

- @nesjs/core — 与 UI 框架无关的模拟器核心（CPU/PPU/APU、各类 Mapper、存档、金手指）
- @nesjs/native — 浏览器原生运行时（Canvas/WebAudio/键盘/手柄）
- @nesjs/vue3 — 基于原生运行时的 Vue 3 组件封装

> 需要查看各包的使用与 API？请前往： [core](./packages/core/README.zh-CN.md) · [native](./packages/native/README.zh-CN.md) · [vue3](./packages/vue3/README.zh-CN.md), 或者查看[完整文档](https://nesjs.netlify.app/zh/)

## 功能

- 准确的 NES 模拟核心（CPU、PPU、APU），支持众多 Mapper
- 渲染与音频接口与 UI 解耦，可自由集成到任意框架
- 存档/读档、SRAM、金手指支持
- 浏览器原生实现：Canvas 渲染 + WebAudio 音频 + 键盘/手柄控制
- Vue 3 组件，响应式属性 + 完整 TypeScript 类型

## ROM 兼容性

支持的 Mapper: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 16, 18, 19, 21, 22, 23, 24, 25, 26, 31, 33, 34, 36, 38, 39, 41, 47, 48, 58, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 78, 79, 85, 86, 88, 87, 89, 92, 93, 94, 97, 107, 112, 113, 115, 118, 119, 129, 140, 152, 154, 169, 180, 182, 184, 185, 195, 200, 201, 203, 206, 212, 213, 225, 226, 228, 229, 231, 240, 241, 242, 244, 245, 246, 248, 249, 255

## 环境要求

- Node.js 18+（推荐）
- pnpm 8+

## 使用

- 原生网页：使用 @nesjs/native，开箱即用的 Canvas/WebAudio 模拟器。详见 [packages/native/README.zh-CN.md](./packages/native/README.zh-CN.md)，包含完整示例。
- Vue 3 应用：直接使用 `<NesVue />` 组件。详见 [packages/vue3/README.zh-CN.md](./packages/vue3/README.zh-CN.md) 获取 Props/方法与示例。
- 库集成：若需自定义渲染/音频后端，可直接集成 @nesjs/core。见 [packages/core/README.zh-CN.md](./packages/core/README.zh-CN.md)。

## 许可证

MIT — 请参阅各包内的 LICENSE（例如 [packages/core/LICENSE.md](./packages/core/LICENSE.md)）。
