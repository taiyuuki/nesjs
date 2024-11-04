class Audio {
    context: AudioContext
    audioScriptProcessorNode: ScriptProcessorNode | null

    static SAMPLE_COUNT = 4 * 1024
    static SAMPLE_MASK = Audio.SAMPLE_COUNT - 1
    static AUDIO_BUFFERING = 512 // 音频缓冲区大小

    audioSamplesL = new Float32Array(Audio.SAMPLE_COUNT)
    audioSamplesR = new Float32Array(Audio.SAMPLE_COUNT)
    audioWriteCursor = 0
    audioReadCursor = 0
    gain = 1

    constructor() {
        this.context = new window.AudioContext()
        this.audioScriptProcessorNode = null
    }

    audioRemain() {
        return this.audioWriteCursor - this.audioReadCursor & Audio.SAMPLE_MASK
    }

    createAudioProgressor(cb: ()=> void) {
        this.audioScriptProcessorNode = this.context.createScriptProcessor(Audio.AUDIO_BUFFERING, 0, 2)
        this.audioScriptProcessorNode.addEventListener('audioprocess', event => {
            const outputBuffer = event.outputBuffer
            const len = outputBuffer.length
            const left = outputBuffer.getChannelData(0)
            const right = outputBuffer.getChannelData(1)
            if (this.audioRemain() < Audio.AUDIO_BUFFERING) {
                cb()
            }
            for (let i = 0; i < len; i++) {
                const srcIdx = this.audioReadCursor + i & Audio.SAMPLE_MASK
                left[i] = this.audioSamplesL[srcIdx] 
                right[i] = this.audioSamplesR[srcIdx]
            }
            this.audioReadCursor = this.audioReadCursor + len & Audio.SAMPLE_MASK
        })
        this.audioScriptProcessorNode.connect(this.context.destination)
    }

    pause() {
        this.context.suspend()
    }

    resume() {
        this.context.resume()
    }

    setVolume(volume: number) {
        this.gain = Math.max(0, Math.min(100, volume)) / 100
    }

    stop() {
        if (this.audioScriptProcessorNode) {
            this.audioScriptProcessorNode.onaudioprocess = null
            this.audioScriptProcessorNode.disconnect()
            this.audioScriptProcessorNode = null
        }
    }

    getSampleRate() {
        if (!window.AudioContext) {
            return 44100
        }
        const myCtx = new window.AudioContext()
        const sampleRate = myCtx.sampleRate
        myCtx.close()
    
        return sampleRate
    }

    onFrame(left: number, right: number) {
        this.audioSamplesL[this.audioWriteCursor] = left
        this.audioSamplesR[this.audioWriteCursor] = right
        this.audioWriteCursor = this.audioWriteCursor + 1 & Audio.SAMPLE_MASK
    }
}

export { Audio }
