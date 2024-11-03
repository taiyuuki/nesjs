class Animation {
    static WIDTH = 256
    static HEIGHT = 240
    static RATIO = Animation.WIDTH / Animation.HEIGHT
    animationframeID: number
    framebuffer_u8: Uint8ClampedArray
    framebuffer_u32: Uint32Array
    imageData = new ImageData(Animation.WIDTH, Animation.HEIGHT)
    cvs: HTMLCanvasElement
    ctx: CanvasRenderingContext2D

    constructor(cvs: HTMLCanvasElement) {
        this.cvs = cvs
        this.ctx = cvs.getContext('2d')!
        this.animationframeID = 0
        const buffer = new ArrayBuffer(this.imageData.data.length)
        this.framebuffer_u8 = new Uint8ClampedArray(buffer)
        this.framebuffer_u32 = new Uint32Array(buffer)
    }

    onFrame(frameBuffer: number[]) {
        for (let i = 0; i < 256 * 240; i += 1) {
            this.framebuffer_u32[i] = 0xFF000000 | frameBuffer[i]
        }
        this.imageData.data.set(this.framebuffer_u8)
        this.ctx.putImageData(this.imageData, 0, 0)
    }

    resize(width: number, height?: number) {
        if (height) {
            const ratio = width / height
            if (ratio > Animation.RATIO) {
                this.cvs.style.width = `${width}px`
                this.cvs.style.height = `${Math.round(width / Animation.RATIO)}px`
            }
            else {
                this.cvs.style.height = `${height}px`
                this.cvs.style.width = `${Math.round(height * Animation.RATIO)}px`
            }
        }
        else {
            height = Math.round(width / Animation.RATIO)
            this.cvs.style.width = `${width}px`
            this.cvs.style.height = `${height}px`
        }
    }
}

export { Animation }
