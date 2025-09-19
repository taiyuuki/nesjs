import type { AudioOutputInterface } from '@nesjs/core'

class WebNESAudioOutput implements AudioOutputInterface {
    sampleRate: number
    bufferSize: number
    audioContext: AudioContext | null
    gainNode: GainNode | null
    audioWorkletNode!: AudioWorkletNode | null
    audiobuf: number[]
    bufptr: number
    isInitialized: boolean
    isPlaying: boolean
    volume: number

    constructor(sampleRate = 44100, bufferSize = 1024) {
        this.sampleRate = sampleRate
        this.bufferSize = bufferSize
        this.audiobuf = []
        this.bufptr = 0
        this.isInitialized = false
        this.isPlaying = false
        this.volume = 0.5 

        const AudioContext = window.AudioContext
        this.audioContext = new AudioContext({
            sampleRate: this.sampleRate,
            latencyHint: 'interactive',
        })

        this.gainNode = this.audioContext.createGain()
        this.gainNode.gain.value = this.volume
        this.gainNode.connect(this.audioContext.destination)
    }

    async initialize() {
        if (this.isInitialized) return

        try {

            await this.setupAudioWorklet()

            this.isInitialized = true
        }
        catch (error) {
            console.error('Failed to initialize WebAudio:', error)
            throw error
        }
    }

    async setupAudioWorklet() {
        const workletCode = `
            class NESAudioProcessor extends AudioWorkletProcessor {
                constructor() {
                    super();
                    this.buffer = [];
                    this.frameCount = 0;
                    this.lastLogTime = 0;
                    this.maxBufferSize = 8192;
                    
                    this.port.onmessage = (event) => {
                        if (event.data.type === 'samples') {
                            this.lastDataTime = Date.now();
                            const newData = event.data.samples;
                            this.buffer.push(...newData);
                           
                            if (this.buffer.length > this.maxBufferSize) {
                                this.buffer.splice(0, this.buffer.length - this.maxBufferSize);
                            }
                        } 
                    };
                }
                
                process(inputs, outputs) {
                    const output = outputs[0];
                    const left = output[0];
                    const right = output[1];
                    
                    this.frameCount++;
                    const shouldOutput = this.buffer.length >= 2;
                    
                    for (let i = 0; i < left.length; i++) {
                        if (shouldOutput) {
                            left[i] = this.buffer.shift() || 0;
                            right[i] = this.buffer.shift() || 0;
                        } else {
                            left[i] = 0;
                            right[i] = 0;
                        }
                    }
                    
                    return true;
                }
            }
            
            registerProcessor('nes-audio-processor', NESAudioProcessor);
        `
        
        const blob = new Blob([workletCode], { type: 'application/javascript' })
        const workletUrl = URL.createObjectURL(blob)
        
        await this.audioContext!.audioWorklet.addModule(workletUrl)
        URL.revokeObjectURL(workletUrl)
        
        this.audioWorkletNode = new AudioWorkletNode(
            this.audioContext!, 
            'nes-audio-processor', 
            {
                outputChannelCount: [2],
                numberOfOutputs: 1,
            },
        )
        this.audioWorkletNode.connect(this.gainNode!)
    }

    outputSample(sample: number) {
        if (!this.isInitialized || !this.isPlaying) return
        const normalizedSample = sample / 0x7FFF

        this.audiobuf[this.bufptr] = normalizedSample
        this.audiobuf[this.bufptr + 1] = normalizedSample

        this.bufptr += 2
    }

    flushFrame() {
        if (this.bufptr > 0) {
            if (this.audioWorkletNode?.port) {
                const samples = this.audiobuf.slice(0, this.bufptr)
                this.audioWorkletNode.port.postMessage({
                    type: 'samples',
                    samples: samples,
                })
                
            }
            this.audiobuf.length = 0
            this.bufptr = 0
        }
    }

    async start() {
        if (!this.isInitialized) {
            await this.initialize()
        }
        
        if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume()
        }
        
        this.isPlaying = true
    }

    pause() {
        this.isPlaying = false
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend()
        }
    }

    resume() {
        this.isPlaying = true
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume()
        }
    }

    destroy() {
        this.isPlaying = false
        this.audiobuf = []
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.disconnect()
            this.audioWorkletNode = null
        }
        
        if (this.gainNode) {
            this.gainNode.disconnect()
            this.gainNode = null
        }
        
        if (this.audioContext) {
            this.audioContext.close()
            this.audioContext = null
        }
        
        this.isInitialized = false
    }

    // 音量控制
    setVolume(volume: number) {
        this.volume = Math.max(0, Math.min(1, volume))
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume
        }
    }

    getVolume() {
        return this.volume
    }

    getAudioContext() {
        return this.audioContext
    }
}

export { WebNESAudioOutput }
