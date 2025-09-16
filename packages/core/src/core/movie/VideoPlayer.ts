import type { VideoData, VideoParserInterface } from '../interfaces'
import type { NES } from '../NES'

/**
 * 录像格式工厂
 * 用于管理不同的录像格式解析器
 */
export class VideoPlayer {

    private parsers: Map<string, VideoParserInterface> = new Map()
    private nes: NES
    private enabled: boolean = false
    private debug: boolean = false
    
    public videoData: VideoData | null = null

    constructor(nes: NES) {
        this.nes = nes
    }

    /**
     * 注册解析器
     * @param type 解析器类型，如'FM2'
     */
    public async registerParser(type: string) {
        if (this.parsers.has(type)) {
            return 
        }
        switch (type.toUpperCase()) {
            case 'FM2': {
                const { FM2Parser } = await import('./FM2Parser')
                this.parsers.set('FM2', new FM2Parser())
                break
            }
        }

        return this
    }

    /**
     * 注册多个解析器
     * @param types 解析器类型列表
     */
    public async registerParsers(types: string[]) {
        return Promise.all(types.map(type => this.registerParser(type)))
    }

    /**
     * 获取支持的格式列表
     */
    public getSupportedFormats(): string[] {
        const formats = new Set<string>()
        for (const parser of this.parsers.values()) {
            parser.getSupportedFormats().forEach(format => formats.add(format))
        }

        return Array.from(formats)
    }

    /**
     * 根据类型获取解析器
     */
    public getParser(type: string): VideoParserInterface | null {
        const parser = this.parsers.get(type.toUpperCase())
        if (parser) {
            return parser
        }

        return null
    }

    /**
     * 解析录像文件
     */
    public parseVideoFile(type: string, content: string) {
        const parser = this.getParser(type)
        if (!parser) {
            console.warn(`No parser found for file: ${type}`)

            return null
        }

        try {
            this.videoData = parser.parseMovie(content)
        }
        catch (error) {
            console.error(`Failed to parse movie file ${type}:`, error)

            return null
        }
    }

    /**
     * 序列化录像数据
     */
    public serializeMovie(movieData: VideoData): string | null {
        const videoType = movieData.metadata.format.toUpperCase()
        const parser = this.getParser(videoType)
        
        if (!parser) {
            console.warn(`No parser found for format: ${videoType}`)

            return null
        }

        try {
            return parser.serializeMovie(movieData)
        }
        catch (error) {
            console.error('Failed to serialize movie data:', error)

            return null
        }
    }

    public playFrame(frameNumber: number) {
        const fixFrame = frameNumber
        if (this.enabled && this.videoData?.frames[fixFrame]) {
            const frame = this.videoData.frames[fixFrame]
            
            // 处理重置标志
            if (frame.reset) {
                this.nes.reset()
                
                return
            }
            
            // 清除所有输入状态
            const gampad1 = this.nes.getGamepad(1)
            const gampad2 = this.nes.getGamepad(2)
            gampad1.buttonStates.fill(0)
            gampad2.buttonStates.fill(0)
            
            // 应用录像中的输入
            if (frame.player1) {
                Object.assign(gampad1.buttonStates, frame.player1)
            }
            if (frame.player2) {
                Object.assign(gampad2.buttonStates, frame.player2)
            }
        }
        else if (this.enabled) {
            
            // 没有录像数据的帧，清除所有输入
            const gampad1 = this.nes.getGamepad(1)
            const gampad2 = this.nes.getGamepad(2)
            gampad1.buttonStates.fill(0)
            gampad2.buttonStates.fill(0)
        }
    }

    public play() {
        this.nes.reset()
        this.enabled = true
    }

    public stop() {
        this.enabled = false
    }

    public isPlaying(): boolean {
        return this.enabled
    }

    public setDebug(enabled: boolean) {
        this.debug = enabled
    }

    /**
     * 获取当前帧的同步信息，用于调试
     */
    public getSyncInfo(frameNumber: number) {
        if (!this.videoData) {
            return null
        }
        
        return {
            frameNumber,
            hasFrameData: !!this.videoData.frames[frameNumber],
            frameData: this.videoData.frames[frameNumber],
            totalFrames: this.videoData.lastFrameNumber,
            isPlaying: this.enabled,
        }
    }
    
}

