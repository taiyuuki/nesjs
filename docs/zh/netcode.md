---
title: 联机示例
---

# 联机示例 —— 可插拔 Transport 上的锁步同步

这个页面演示如何在 `@nesjs/core` 之上构建**双人远程联机**，而库本身不需要知道
任何网络细节。

核心思想：`@nesjs/core` 只暴露 *能力*（一个帧边界 hook），**全部同步逻辑都在你的
应用里**，藏在一个 `NetcodeTransport` 接口后面。换一个 Transport 实现，同样的代码
就从*本地*变成了基于 WebRTC 的*真·远程*。

<NetcodeDemo />

## `@nesjs/core` 给了你什么

两处最小改动让联机成为可能：

| API | 位置 | 作用 |
|-----|------|------|
| `EmulatorEvents.onBeforeFrame(frame)` | `runFrame()` 在**模拟一帧之前**触发 | 在此把远程玩家的输入写入 `getGamepad(n).buttonStates`，让本帧用正确的输入推进 |
| `NES.getInput(player)` / `NES.setInput(player, byte)` | `NES` 类 | 把手柄状态打包/解包成单字节，便于廉价传输 |

这就是全部对外接口。库里没有 WebRTC、没有 WebSocket、没有回滚——这些都是应用层的事。

## Transport 契约

```ts
interface NetcodeTransport {
    send(input: FrameInput): void
    onReceive(cb: (input: FrameInput) => void): void
    start(): void
    stop(): void
}
```

锁步调度器**只**依赖这个接口。所以：

- `LocalTransport`（本 demo）—— 进程内直连，零延迟
- 你的 `WebRTCTransport` —— `send()` → `dataChannel.send()`，`onReceive` → `dataChannel.onmessage`
- 你的 `WebSocketTransport` / `WebTransport` —— 形状相同，传输介质不同

无论哪种，调度代码完全一致。

## 上远程（清单）

1. **两端用同一 ROM、同一初始状态**（交换 ROM 哈希，或共享一个 URL）。
2. **信令握手** —— WebRTC 需要一个信令服务器（WebSocket）来交换 SDP/ICE；握手成功后数据走 P2P。
3. **开一条 DataChannel**（无序、不可靠即可，传输入足够），用一个 `NetcodeTransport` 包起来。
4. **把 `onBeforeFrame` 接到锁步调度器**，和本 demo 完全一样。
5. **用固定步长循环驱动 `runFrame()`**，每一帧门控在"对端输入到达"（或退化为预测）。

::: tip 进阶：回滚网络代码（Rollback Netcode）
对延迟零容忍的格斗/动作游戏，可从锁步升级为**回滚**（GGPO 风格）：维护一个存档
环形缓冲、预测对端输入，真实输入到达后从 N 帧前恢复状态重新模拟。`@nesjs/core`
已提供 `createBinarySaveState()` / `loadBinarySaveState()`，无需额外 API。
:::
