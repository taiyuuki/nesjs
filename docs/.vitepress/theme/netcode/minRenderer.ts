/**
 * Netcode demo —— 极简画布渲染器
 *
 * 实现 @nesjs/core 的 RendererInterface。这里不引入 @nesjs/native 的
 * CanvasRenderer（那会改变库的导出面），而是用最朴素的方式把一帧 RGBA
 * 写进 ImageData 再 putImageData 上画布，恰好够演示用。
 *
 * 一个实例对应一个 <canvas>，互不干扰，也就不存在键盘/画布冲突。
 */
import type { RendererInterface } from '@nesjs/core'

export class MinRenderer implements RendererInterface {
    private canvas:    HTMLCanvasElement
    private ctx:       CanvasRenderingContext2D
    private imageData: ImageData

    constructor(canvas: HTMLCanvasElement, scale = 2) {
        this.canvas = canvas
        this.canvas.width = 256
        this.canvas.height = 240
        this.canvas.style.width = `${256 * scale}px`
        this.canvas.style.height = `${240 * scale}px`
        this.canvas.style.imageRendering = 'pixelated'

        this.ctx = canvas.getContext('2d')!
        this.ctx.imageSmoothingEnabled = false
        this.imageData = this.ctx.createImageData(256, 240)
    }

    renderFrame(imageData: Uint8Array): void {

        // NES 核心吐出的是 256*240*4 的 RGBA 数据，直接拷进 ImageData 即可
        this.imageData.data.set(imageData)
        this.ctx.putImageData(this.imageData, 0, 0)
    }
}
