/**
 * Netcode demo —— 类型定义
 *
 * 这是教学样板的类型层，不属于 @nesjs/core 库本身。
 * 它示范了"可插拔 Transport"的接口契约：换一个 Transport 实现，
 * 锁步调度逻辑完全不变，即可从本地直连切换到 WebRTC / WebSocket 远程。
 */

/**
 * 一帧的输入。
 *
 * 每个 NES 手柄状态压成一个字节（位序见 @nesjs/core 的 NES.getInput）：
 * bit0=A, bit1=B, bit2=SELECT, bit3=START, bit4=UP, bit5=DOWN, bit6=LEFT, bit7=RIGHT。
 */
export interface FrameInput {

    /** 该输入对应的逻辑帧号（NES.frameCount） */
    frame: number

    /** 玩家1手柄字节 */
    player1: number

    /** 玩家2手柄字节 */
    player2: number
}

/**
 * 网络传输层接口。
 *
 * 锁步调度器只依赖这个抽象：把本端输入发出去，把对端输入收回来。
 * 实现可以是：
 *  - LocalTransport —— 进程内直连（本 demo 用，零延迟）
 *  - WebRTCTransport —— 基于 RTCDataChannel 的真·远程对战
 *  - WebSocketTransport —— 走中转服务器
 *  - WebTransport —— 基于 QUIC
 *
 * 只要满足该接口，上层调度代码无需任何改动。
 */
export interface NetcodeTransport {

    /**
     * 发送一帧输入到对端。
     * 实现负责序列化与投递（本地直传 / DataChannel.send / ws.send 等）。
     */
    send(input: FrameInput): void

    /**
     * 注册接收回调。当对端的输入到达时触发。
     * 一个 Transport 通常只连一个回调。
     */
    onReceive(cb: (input: FrameInput) => void): void

    /** 启用传输（绑定监听等） */
    start(): void

    /** 关闭传输（解绑监听、关闭通道等） */
    stop(): void
}
