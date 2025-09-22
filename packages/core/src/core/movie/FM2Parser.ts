import type { GamepadButtons, VideoData, VideoFrame, VideoParserInterface } from '../interfaces'

/**
 * FM2 (FCEU Movie) 格式解析器
 * 支持FCEUX模拟器的录像格式
 */
export class FM2Parser implements VideoParserInterface {

    /**
     * 获取支持的格式列表
     */
    public getSupportedFormats(): string[] {
        return ['fm2', 'FM2']
    }

    /**
     * 解析FM2录像文件
     */
    public parseMovie(content: string): VideoData {
        const lines = content.split('\n')
        let frameStartIndex = -1
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (line.startsWith('|')) {
                frameStartIndex = i
                break
            }
        }

        if (frameStartIndex === -1) {
            throw new Error('Invalid FM2 format: No frame data found')
        }

        // 解析帧数据
        const frames: Record<number, VideoFrame> = {}
        let frameNumber = 0
        let lastHasInput = false

        for (let i = frameStartIndex; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line || !line.startsWith('|')) {
                continue
            }

            try {
                const frame = this.parseFrameLine(line)
                if (frame?.reset) {
                    
                    // Reset帧也需要记录，但不包含输入数据
                    frames[frameNumber] = frame
                    frameNumber++
                    continue
                }
                if (frame) {
                    lastHasInput = true
                    frames[frameNumber] = frame
                }
                else if (lastHasInput) {
                    frames[frameNumber] = {
                        player1: Array.from({ length: 8 }, () => 0) as GamepadButtons,
                        player2: Array.from({ length: 8 }, () => 0) as GamepadButtons,
                    }
                    lastHasInput = false
                }
                frameNumber++
            }
            catch(error) {
                console.warn(`Failed to parse frame line ${i + 1}: ${line}`, error)
            }
        }

        return { frames, metadata: { format: 'FM2' }, lastFrameNumber: frameNumber }
    }

    /**
     * 解析帧数据行
     * FM2格式：|reset|player1_input|player2_input||
     * 输入格式：RLDUTSBA (Right, Left, Down, Up, sTart, Select, B, A)
     */
    private parseFrameLine(line: string): VideoFrame | null {

        // 移除开头和结尾的|符号
        const cleanLine = line.substring(1, line.length - 2)
        const parts = cleanLine.split('|')

        if (parts.length < 3) {
            throw new Error(`Invalid frame format: ${line}`)
        }

        const resetFlag = parts[0] === '1'
        const player1Input = parts[1] || '........'
        const player2Input = parts[2] || '........'

        if (player1Input === '........' && player2Input === '........' && !resetFlag) {
            return null
        }
        const movieFrame: VideoFrame = {}

        if (resetFlag) {
            movieFrame.reset = true
        }

        if (player1Input !== '........') {
            movieFrame.player1 = this.parseInputString(player1Input)
        }

        if (player2Input !== '........') {
            movieFrame.player2 = this.parseInputString(player2Input)
        }

        return movieFrame
    }

    /**
     * 解析输入字符串
     * 格式：RLDUTSBA (8个字符)
     * R = Right, L = Left, D = Down, U = Up
     * T = sTart, S = Select, B = B按钮, A = A按钮
     */
    private parseInputString(inputStr: string): GamepadButtons {
        const input = inputStr.padEnd(8, '.')

        // FM2格式：RLDUTSBA
        // 新枚举顺序：A=0, B=1, SELECT=2, START=3, UP=4, DOWN=5, LEFT=6, RIGHT=7
        return [
            input[7] === '.' ? 0 : 1, // A按钮
            input[6] === '.' ? 0 : 1, // B按钮  
            input[5] === '.' ? 0 : 1, // SELECT
            input[4] === '.' ? 0 : 1, // START
            input[3] === '.' ? 0 : 1, // UP
            input[2] === '.' ? 0 : 1, // DOWN
            input[1] === '.' ? 0 : 1, // LEFT
            input[0] === '.' ? 0 : 1, // RIGHT
        ] as GamepadButtons
    }

    /**
     * 序列化录像为FM2格式
     */
    public serializeMovie(movieData: VideoData): string {
        const lines: string[] = []
        const { frames } = movieData

        for (let i = 0; i <= movieData.lastFrameNumber; i++) {
            const frame = frames[i]
            if (frame) {
                const resetFlag = frame.reset ? '1' : '0'
                const player1Str = frame.player1 ? this.serializeInputButtons(frame.player1) : '........'
                const player2Str = frame.player2 ? this.serializeInputButtons(frame.player2) : '........'
                lines.push(`|${resetFlag}|${player1Str}|${player2Str}||`)
            }
            else {
                lines.push('|0|........|........||')
            }
        }

        return lines.join('\n')
    }

    /**
     * 序列化输入按钮为字符串
     */
    private serializeInputButtons(buttons: GamepadButtons): string {
        
        // FM2格式：RLDUTSBA
        // 新枚举顺序：A=0, B=1, SELECT=2, START=3, UP=4, DOWN=5, LEFT=6, RIGHT=7
        return [
            buttons[7] ? 'R' : '.', // RIGHT
            buttons[6] ? 'L' : '.', // LEFT
            buttons[5] ? 'D' : '.', // DOWN
            buttons[4] ? 'U' : '.', // UP
            buttons[3] ? 'T' : '.', // START
            buttons[2] ? 'S' : '.', // SELECT
            buttons[1] ? 'B' : '.', // B按钮
            buttons[0] ? 'A' : '.', // A按钮
        ].join('')
    }

    /**
     * 获取格式信息
     */
    public getFormatInfo(): { name: string; description: string; extensions: string[] } {
        return {
            name: 'FM2',
            description: 'FCEUX Movie Format',
            extensions: ['fm2'],
        }
    }
}
