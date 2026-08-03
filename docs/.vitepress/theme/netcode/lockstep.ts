/**
 * Netcode demo —— 锁步同步调度器（Deterministic Lockstep）
 *
 * 职责：让一个 NES 实例与远程对端保持帧级同步。
 *
 * 工作模型（每帧）：
 *   1. NES.runFrame() 在真正模拟前先回调 onBeforeFrame(frame)
 *   2. 调度器在此回调里：
 *      a) 采样本端当前输入（NES.getInput），打包经 Transport 发给对端
 *      b) 读取对端"若干帧前"发来的输入（frame - frameDelay）
 *      c) 写进本实例的对端 gamepad（NES.setInput）
 *   3. runFrame 继续，用"本端 + 对端"齐整的输入推进一帧
 *
 * 关键概念 —— frameDelay（帧补偿）：
 *   在帧 N 运行时，去读对端标记为 N - frameDelay 的输入。
 *   - frameDelay = 0：要求对端的"当下"输入立刻可得。本地直连(同步 Transport)
 *     下，先后运行两端会有一帧错位；真网络下极易"等不到"而触发预测。
 *   - frameDelay = 1（推荐默认）：读对端上一帧的输入。在共享循环里两端对称、
 *     严格同步（A 运行帧 N 时，B 早在帧 N-1 就发出了对应输入）。真网络下，
 *     只要单程延迟 < 1 帧(≈16ms)就不会卡顿。
 *   - frameDelay 越大，越能吸收网络抖动，代价是手感延迟越高。
 *
 * 预测（prediction）：
 *   若 frameDelay 不够大、对端某帧输入还没到，就用"最近一次已知输入"兜底
 *   （假设对方保持上一帧按键不变）。这是简化的预测：正确、不漂移，但可能
 *   一帧内用错输入。真正的 rollback netcode 会回滚重算——本 demo 不做。
 *
 * 本类只依赖传入的回调接口，不直接 import NES，便于复用与理解。
 */
import type { FrameInput, NetcodeTransport } from './types'

/** 调度器操作仿真器实例所需的最小接口（NES 天然满足） */
export interface LockstepEmulator {
    getInput(player: 1 | 2): number
    setInput(player: 1 | 2, input: number): void
    readonly frameCount: number
}

/** 本端扮演哪个玩家：本端是 P1，则本地键盘进 player1 槽，对端进 player2 */
export type LocalPlayer = 1 | 2

export interface LockstepOptions {
    transport:   NetcodeTransport
    emulator:    LockstepEmulator
    localPlayer: LocalPlayer

    /** 帧补偿：运行帧 N 时读取对端 N - frameDelay 的输入。默认 1 */
    frameDelay?: number
}

export class Lockstep {
    private transport:   NetcodeTransport
    private emu:         LockstepEmulator
    private localPlayer: LocalPlayer
    private frameDelay:  number

    /** 对端输入：按帧号索引 */
    private remoteInputs = new Map<number, number>()

    /** 最近一次已知的对端输入（用于预测兜底） */
    private lastKnownRemote = 0
    private running = false

    /** 诊断信息（供 UI 显示） */
    diagnostics = {
        localFrame:   0,
        remoteFrame:  0,
        missedFrames: 0, // 触发预测兜底的帧数（网络跟不上的信号）
    }

    constructor(opts: LockstepOptions) {
        this.transport = opts.transport
        this.emu = opts.emulator
        this.localPlayer = opts.localPlayer
        this.frameDelay = opts.frameDelay ?? 1
    }

    /** 注入到 NES 构造的 EmulatorEvents.onBeforeFrame */
    onBeforeFrame = (frame: number): void => {
        if (!this.running) return

        // (a) 采样本端输入并发送
        const localInput = this.emu.getInput(this.localPlayer)
        this.sendInput(frame, localInput)

        // (b)(c) 读取对端输入并写入对应槽位
        const remotePlayer = this.localPlayer === 1 ? 2 : 1
        const remoteInput = this.readRemote(frame - this.frameDelay)

        this.emu.setInput(remotePlayer, remoteInput)
        this.diagnostics.localFrame = frame
    }

    private sendInput(frame: number, input: number): void {
        const packet: FrameInput = {
            frame,
            player1: this.localPlayer === 1 ? input : 0,
            player2: this.localPlayer === 2 ? input : 0,
        }
        this.transport.send(packet)
    }

    /**
     * 取出某帧的对端输入；没有则用 lastKnownRemote 兜底（预测），并记一次 miss。
     * Map 里取出后即删除，避免无限增长。
     */
    private readRemote(frame: number): number {
        const cached = this.remoteInputs.get(frame)

        if (cached !== undefined) {
            this.remoteInputs.delete(frame)
            this.lastKnownRemote = cached

            return cached
        }

        this.diagnostics.missedFrames++

        return this.lastKnownRemote
    }

    /** Transport 收到对端输入时调用（由 start() 绑定） */
    private handleRemote = (input: FrameInput): void => {
        const remotePlayer = this.localPlayer === 1 ? 2 : 1
        const value = remotePlayer === 1 ? input.player1 : input.player2

        this.remoteInputs.set(input.frame, value)
        this.diagnostics.remoteFrame = input.frame

        // 清理过旧的缓存条目（保留最近 64 帧，防止内存增长）
        if (this.remoteInputs.size > 64) {
            const cutoff = input.frame - 64

            for (const key of this.remoteInputs.keys()) {
                if (key < cutoff) this.remoteInputs.delete(key)
            }
        }
    }

    start(): void {
        this.running = true
        this.transport.onReceive(this.handleRemote)
        this.transport.start()
    }

    stop(): void {
        this.running = false
        this.transport.stop()
        this.remoteInputs.clear()
    }

    setFrameDelay(delay: number): void {
        this.frameDelay = Math.max(0, delay)
    }
}
