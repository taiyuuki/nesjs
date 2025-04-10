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
        this.reset()
    }

    onFrame(frameBuffer: number[]) {
        for (let i = 0; i < 256 * 240; i += 1) {
            this.framebuffer_u32[i] = 0xFF000000 | frameBuffer[i]
        }
        this.imageData.data.set(this.framebuffer_u8)
        this.ctx.putImageData(this.imageData, 0, 0)
    }

    resize(width: number | string, height?: number | string) {
        let wUnit = 'px'
        let hUnit = 'px'
        const reg = /^\d+(\.\d+)?(%|px|em|rem|vw|vh|vmin|vmax)?$/
        if (typeof width === 'string') {
            const match = width.match(reg)
            if (!match) {
                throw new Error(`[@nesjs/native] Invalid width value: ${width}.`)
            }
            wUnit = match[2] || 'px'
            width = Number.parseFloat(width)
        }
        if (height) {
            if (typeof height === 'string') {
                const match = height.match(reg)
                if (!match) {
                    throw new Error(`[@nesjs/native] Invalid height value: ${height}.`)
                }
                hUnit = match[2] || 'px'
                height = Number.parseFloat(height)
            }
        
            const ratio = width / height
            if (ratio > Animation.RATIO) {
                this.cvs.style.width = `${width}${wUnit}`
                this.cvs.style.height = `${Math.round(width / Animation.RATIO)}${hUnit}`
            }
            else {
                this.cvs.style.height = `${height}${wUnit}`
                this.cvs.style.width = `${Math.round(height * Animation.RATIO)}${hUnit}`
            }
        }
        else {
            height = Math.round(width / Animation.RATIO)
            this.cvs.style.width = `${width}${wUnit}`
            this.cvs.style.height = `${height}${hUnit}`
        }
    }

    reset() {
        this.ctx.strokeStyle = 'black'
        this.ctx.fillStyle = 'black'
        this.ctx.fillRect(0, 0, Animation.WIDTH, Animation.HEIGHT)
    }
}

export { Animation }
