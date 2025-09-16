class CanvasRenderer {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    scale: number
    nesWidth: number
    nesHeight: number

    constructor(canvas: HTMLCanvasElement, scale = 2) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!
        this.scale = scale
        this.nesWidth = 256
        this.nesHeight = 240

        this.updateCanvasSize()
    }

    updateCanvasSize() {
        this.canvas.width = this.nesWidth
        this.canvas.height = this.nesHeight
        this.canvas.style.width = `${this.nesWidth * this.scale}px`
        this.canvas.style.height = `${this.nesHeight * this.scale}px`
        this.ctx.imageSmoothingEnabled = false
    }

    renderFrame(imageData: Uint8Array) {
        const imgData = this.ctx.createImageData(256, 240)
        imgData.data.set(imageData)
        this.ctx.putImageData(imgData, 0, 0)
    }

    setScale(newScale: number) {
        this.scale = newScale
        this.updateCanvasSize()
    }
}

export { CanvasRenderer }
