export interface CanvasRendererOptions {
    scale?: number
    clip8px?: boolean
}

class CanvasRenderer {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    scale: number
    clip8px: boolean
    NES_Width = 256
    NEX_Height = 240
    private clipBounds: { startX: number; startY: number; width: number; height: number } | null = null

    constructor(canvas: HTMLCanvasElement, options?: CanvasRendererOptions) {
        const cfg = Object.assign({
            scale: 2,
            clip8px: false,
        }, options)
        
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!
        this.scale = cfg.scale
        this.clip8px = cfg.clip8px

        this.updateClipBounds()
        this.updateCanvasSize()
    }

    private updateClipBounds() {
        if (this.clip8px) {
            this.clipBounds = {
                startX: 8,
                startY: 8,
                width: this.NES_Width - 16,
                height: this.NEX_Height - 16,
            }
        }
        else {
            this.clipBounds = null
        }
    }

    updateCanvasSize() {
        this.canvas.width = this.NES_Width
        this.canvas.height = this.NEX_Height
        this.canvas.style.width = `${this.NES_Width * this.scale}px`
        this.canvas.style.height = `${this.NEX_Height * this.scale}px`
        this.ctx.imageSmoothingEnabled = false
    }

    renderFrame(imageData: Uint8Array) {
        const imgData = this.ctx.createImageData(256, 240)
        
        if (this.clipBounds) {
            const { startX, startY, width, height } = this.clipBounds
            const sourceWidth = this.NES_Width

            const data = imgData.data
            
            for (let y = 0; y < startY; y++) {
                const rowStart = y * sourceWidth * 4
                for (let i = rowStart; i < rowStart + sourceWidth * 4; i += 4) {
                    data[i] = 0 // R
                    data[i + 1] = 0 // G
                    data[i + 2] = 0 // B
                    data[i + 3] = 255 // A
                }
            }
            
            for (let y = startY + height; y < this.NEX_Height; y++) {
                const rowStart = y * sourceWidth * 4
                for (let i = rowStart; i < rowStart + sourceWidth * 4; i += 4) {
                    data[i] = 0 // R
                    data[i + 1] = 0 // G
                    data[i + 2] = 0 // B
                    data[i + 3] = 255 // A
                }
            }
            
            for (let y = 0; y < height; y++) {
                const sourceY = y + startY
                const rowStart = sourceY * sourceWidth * 4
                const gameRowStart = sourceY * sourceWidth * 4
                
                for (let i = rowStart; i < rowStart + startX * 4; i += 4) {
                    data[i] = 0 // R
                    data[i + 1] = 0 // G
                    data[i + 2] = 0 // B
                    data[i + 3] = 255 // A
                }
                
                const gameStart = gameRowStart + startX * 4
                const gameEnd = gameStart + width * 4
                data.set(imageData.subarray(gameStart, gameEnd), gameStart)
                
                const rightStart = rowStart + (startX + width) * 4
                const rightEnd = rowStart + sourceWidth * 4
                for (let i = rightStart; i < rightEnd; i += 4) {
                    data[i] = 0 // R
                    data[i + 1] = 0 // G
                    data[i + 2] = 0 // B
                    data[i + 3] = 255 // A
                }
            }
        }
        else {

            imgData.data.set(imageData)
        }
        
        this.ctx.putImageData(imgData, 0, 0)
    }

    setScale(newScale: number) {
        this.scale = newScale
        this.updateCanvasSize()
    }

    setClip8px(clip: boolean) {
        this.clip8px = clip
        this.updateClipBounds()
    }
}

export { CanvasRenderer }
