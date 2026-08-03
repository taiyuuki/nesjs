---
layout: page
title: Netplay Demo
---

# Netplay Demo — Lockstep over a pluggable Transport

This page demonstrates how to build **two-player remote netplay** on top of `@nesjs/core`
without the library itself knowing anything about networking.

The key idea: `@nesjs/core` only exposes the *capability* (a frame-boundary hook), and
**all synchronization logic lives in your app** behind a `NetcodeTransport` interface.
Swap the Transport implementation and the same code goes from *local* → *real remote*
over WebRTC.

<NetcodeDemo />

## What `@nesjs/core` gives you

Two minimal additions make netplay possible:

| API | Where | Purpose |
|-----|-------|---------|
| `EmulatorEvents.onBeforeFrame(frame)` | `runFrame()` fires it **before** simulating a frame | Inject the remote player's input into `getGamepad(n).buttonStates` so this frame runs with correct inputs |
| `NES.getInput(player)` / `NES.setInput(player, byte)` | `NES` class | Pack/unpack a gamepad state into a single byte for cheap transport |

That's the entire surface. No WebRTC, no WebSockets, no rollback in the library — those
are application concerns.

## The Transport contract

```ts
interface NetcodeTransport {
    send(input: FrameInput): void
    onReceive(cb: (input: FrameInput) => void): void
    start(): void
    stop(): void
}
```

The lockstep scheduler depends **only** on this interface. So:

- `LocalTransport` (this demo) — in-process, zero latency
- Your `WebRTCTransport` — `send()` → `dataChannel.send()`, `onReceive` → `dataChannel.onmessage`
- Your `WebSocketTransport` / `WebTransport` — same shape, different wire

The scheduler code is identical in all cases.

## Going remote (checklist)

1. **Same ROM, same initial state** on both peers (exchange ROM hash, or share a URL).
2. **Signal a connection** — WebRTC needs a signaling server (WebSocket) to exchange
   SDP/ICE; after the handshake the data flows P2P.
3. **Open a DataChannel** (unordered, unreliable is fine for input), wrap it in a
   `NetcodeTransport`.
4. **Wire `onBeforeFrame`** to the lockstep scheduler exactly as this demo does.
5. **Drive `runFrame()`** with a fixed-timestep loop, gating each frame on the remote
   input arriving (or falling back to prediction).

::: tip Advanced: Rollback Netcode
For fighting/action games that can't tolerate input delay, upgrade from lockstep to
**rollback** (GGPO-style): keep a ring buffer of save states, predict remote inputs,
and when the truth arrives, restore the state from N frames ago and re-simulate.
`@nesjs/core` already exposes `createBinarySaveState()` / `loadBinarySaveState()` for
this — no extra API needed.
:::
