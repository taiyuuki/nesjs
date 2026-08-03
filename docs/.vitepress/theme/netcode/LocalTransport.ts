/**
 * Netcode demo —— 进程内 Transport 实现
 *
 * 把"对端"放在同一个页面里，用内存直传模拟一条网络链路。
 *
 * 配对方式：两端各 new 一个 LocalTransport，调用 link() 把彼此接上，
 * 任一端 send() 的数据就会（在可配置的延迟后）触发对端的 onReceive 回调。
 *
 * 这个实现存在的全部意义是：让你把链路换成 WebRTC 时，
 * 只需替换这一层，上层的锁步调度一字不改。
 */
import type { FrameInput, NetcodeTransport } from './types'

export interface LocalTransportOptions {

    /** 模拟网络单程延迟（毫秒），用于演示抖动对锁步的影响 */
    latencyMs?: number
}

export class LocalTransport implements NetcodeTransport {
    private peer:      LocalTransport | null = null
    private receiver:  ((input: FrameInput) => void) | null = null
    private latencyMs: number
    private timers:    ReturnType<typeof setTimeout>[] = []
    private started = false

    constructor(options: LocalTransportOptions = {}) {
        this.latencyMs = options.latencyMs ?? 0
    }

    /** 将两个 transport 互相连接（双向） */
    static link(a: LocalTransport, b: LocalTransport): void {
        a.peer = b
        b.peer = a
    }

    send(input: FrameInput): void {
        if (!this.peer) return

        // 经"网络"投递到对端：真实现里这里是 dataChannel.send(JSON/二进制)
        const deliver = () => this.peer?.receiver?.(input)

        if (this.latencyMs <= 0) {
            deliver()

            return
        }
        const timer = setTimeout(deliver, this.latencyMs)
        this.timers.push(timer)
    }

    onReceive(cb: (input: FrameInput) => void): void {
        this.receiver = cb
    }

    start(): void {
        this.started = true
    }

    stop(): void {
        this.started = false
        this.timers.forEach(clearTimeout)
        this.timers = []
        this.receiver = null

        // 注意：不清除 this.peer —— peer 是"连接关系"，与启停无关。
        // stop() 只解绑本端的接收回调；link() 建立的配对应当跨启停保留，
        // 否则暂停后再 start() 会丢失对端连接。
    }

    /** 运行时调整模拟延迟（配合 UI 滑块） */
    setLatency(ms: number): void {
        this.latencyMs = Math.max(0, ms)
    }
}
