import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import { NESEmulator } from '@nesjs/native'
import type {
    NESComponentExpose,
    NESOptions,
    ROMInput,
} from '../types'

export interface NESEmulatorReactProps extends NESOptions {
    onLoaded?: ()=> void
    onError?: (error: Error)=> void
    onReady?: ()=> void // canvas+emulator实例创建完成，但未必加载ROM
}

const NESEmulatorReact = forwardRef<
    NESComponentExpose,
    NESEmulatorReactProps
>((props, ref) => {
    const {
        rom,
        autoStart = false,
        volume = 50,
        debugMode = false,
        emulatorConfig = {
            scale: 2,
            clip8px: true,
            smoothing: false,
            audioBufferSize: 1024,
            audioSampleRate: 44100,
        },
        onLoaded,
        onError,
        onReady,
    } = props

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const emulatorRef = useRef<NESEmulator | null>(null)
    const audioUnlockedRef = useRef(false)

    const unlockAudioOnInteraction = async() => {
        const emu = emulatorRef.current
        if (!emu || audioUnlockedRef.current) return
        await emu.enableAudio()
        audioUnlockedRef.current = true

        document.removeEventListener('click', unlockAudioOnInteraction)
        document.removeEventListener('keydown', unlockAudioOnInteraction)
        document.removeEventListener('touchstart', unlockAudioOnInteraction)
    }

    useEffect(() => {
        return () => {
            if (emulatorRef.current) {
                emulatorRef.current.stop()
                emulatorRef.current = null
            }
            document.removeEventListener('click', unlockAudioOnInteraction)
            document.removeEventListener('keydown', unlockAudioOnInteraction)
            document.removeEventListener('touchstart', unlockAudioOnInteraction)
            audioUnlockedRef.current = false
        }
    }, [])

    const [isPlaying, setIsPlaying] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const loadROMData = async(emu: NESEmulator, data: ROMInput) => {
        if (typeof data === 'string') {
            const res = await fetch(data)
            if (!res.ok) throw new Error(`Failed to fetch ROM: ${res.status} ${res.statusText}`)
            const buf = await res.arrayBuffer()
            await emu.loadROM(new Uint8Array(buf))
        }
        else if (data instanceof ArrayBuffer) {
            await emu.loadROM(new Uint8Array(data))
        }
        else if (data instanceof Uint8Array) {
            await emu.loadROM(data)
        }
        else if (data instanceof Blob) {
            const buf = await data.arrayBuffer()
            await emu.loadROM(new Uint8Array(buf))
        }
        else {
            throw new Error('Invalid ROM format')
        }
        onLoaded?.()
    }

    useEffect(() => {
        if (!rom || !canvasRef.current) return
        const emu = new NESEmulator(canvasRef.current, emulatorConfig)
        emulatorRef.current = emu
        onReady?.()

        const bootstrap = async() => {
            setIsLoading(true)
            setErrorMessage(null)
            try {
                await loadROMData(emu, rom)
                emu.setVolume(Math.max(0, Math.min(100, volume)) / 100)
                emu.setScale(Math.max(1, emulatorConfig.scale ?? 2))
                emu.setSmoothing(emulatorConfig.smoothing ?? false)
                const anyEmu = emu as any
                if (typeof emulatorConfig.clip8px === 'boolean') {
                    anyEmu.setClip8px?.(emulatorConfig.clip8px)
                }
                const fillColor = (emulatorConfig as any).fillColor
                if (fillColor !== undefined) {
                    anyEmu.setFillColor?.(fillColor)
                }

                if (autoStart) {
                    await emu.start() // 立即启动，画面正常
                    setIsPlaying(true)

                    /* 挂交互监听，只用于解锁音频 */
                    document.addEventListener('click', unlockAudioOnInteraction)
                    document.addEventListener('keydown', unlockAudioOnInteraction)
                    document.addEventListener('touchstart', unlockAudioOnInteraction)
                }
            }
            catch(e) {
                const msg = e instanceof Error ? e.message : String(e)
                setErrorMessage(msg)
                if (debugMode) console.error('Bootstrap failed:', e)
                if (e instanceof Error) onError?.(e)
            }
            finally {
                setIsLoading(false)
            }
        }
        bootstrap()

        return () => {
            emu.stop()
            emulatorRef.current = null
        }
    }, [rom])

    useEffect(() => {
        const emu = emulatorRef.current
        if (!emu) return
        emu.setVolume(Math.max(0, Math.min(100, volume)) / 100)
    }, [volume])

    useEffect(() => {
        const emu = emulatorRef.current
        if (!emu) return
        emu.setScale(Math.max(1, emulatorConfig.scale ?? 2))
    }, [emulatorConfig.scale])

    useEffect(() => {
        const emu = emulatorRef.current
        if (!emu) return
        emu.setSmoothing(emulatorConfig.smoothing ?? false)
    }, [emulatorConfig.smoothing])

    useEffect(() => {
        const emu = emulatorRef.current
        if (!emu) return
        const anyEmu = emu as any
        if (typeof emulatorConfig.clip8px === 'boolean') {
            anyEmu.setClip8px?.(emulatorConfig.clip8px)
        }
        const fillColor = (emulatorConfig as any).fillColor
        if (fillColor !== undefined) {
            anyEmu.setFillColor?.(fillColor)
        }
    }, [emulatorConfig.clip8px, (emulatorConfig as any).fillColor])

    const start = async(emu = emulatorRef.current!) => {
        if (!emu) return
        await emu.start()
        setIsPlaying(true)
    }
    const reset = () => {
        emulatorRef.current?.reset()
        setIsPlaying(false)
    }
    const stop = () => {
        emulatorRef.current?.stop()
        setIsPlaying(false)
    }
    const pause = () => {
        emulatorRef.current?.pause()
        setIsPlaying(false)
    }
    const resume = () => {
        emulatorRef.current?.resume()
        setIsPlaying(true)
    }
    const togglePlay = async() => {
        const emu = emulatorRef.current
        if (!emu) return
        if (isPlaying) return pause()
        if (emu.status === 0) return start(emu)

        return resume()
    }

    const save = (): Uint8Array => {
        const emu = emulatorRef.current
        if (!emu) throw new Error('Emulator not initialized')

        return emu.nes.createBinarySaveState()
    }
    const loadSave = (data: Uint8Array): boolean => {
        const emu = emulatorRef.current
        if (!emu) throw new Error('Emulator not initialized')

        return emu.nes.loadBinarySaveState(data)
    }

    const screenshot = (download = false): string => {
        const cvs = canvasRef.current
        if (!cvs) throw new Error('Canvas not available')
        const url = cvs.toDataURL('image/png')
        if (download) {
            const a = document.createElement('a')
            a.href = url
            a.download = `nes-screenshot-${Date.now()}.png`
            a.click()
        }

        return url
    }

    const downloadSaveState = () => {
        try {
            const saveData = save()
            const blob = new Blob([new Uint8Array(saveData.buffer as ArrayBuffer)], { type: 'application/octet-stream' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `nes-save-${Date.now()}.sav`
            a.click()
            URL.revokeObjectURL(url)
        }
        catch(e) {
            if (debugMode) console.error('Save state failed:', e)
        }
    }

    const uploadSaveState = (): Promise<void> =>
        new Promise((resolve, reject) => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.sav'
            input.onchange = async e => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (!file) return reject(new Error('No file selected'))
                try {
                    const buf = await file.arrayBuffer()
                    const ok = loadSave(new Uint8Array(buf))

                    return ok ? resolve() : reject(new Error('Failed to load save'))
                }
                catch(err) {
                    reject(err)
                }
            }
            input.click()
        })

    const addCheat = (code: string) => emulatorRef.current?.addCheat(code)
    const removeCheat = (code: string) => emulatorRef.current?.removeCheat(code)
    const toggleCheat = (code: string) => emulatorRef.current?.toggleCheat(code)
    const clearAllCheats = () => emulatorRef.current?.clearAllCheats()
    const getROMInfo = () => emulatorRef.current?.nes.getROMInfo() || null
    const getDebugInfo = () => emulatorRef.current?.nes.getDebugInfo()

    useImperativeHandle(ref, () => ({
        start: () => start(emulatorRef.current!),
        reset,
        stop,
        pause,
        play: resume,
        togglePlay,
        save,
        load: loadSave,
        screenshot,
        downloadSaveState,
        uploadSaveState,
        addCheat,
        removeCheat,
        toggleCheat,
        clearAllCheats,
        getROMInfo,
        getDebugInfo,
        get isPlaying() {
            return isPlaying
        },
        get isLoading() {
            return isLoading
        },
    }))

    return (
        <>
            <canvas ref={canvasRef} width={256} height={240} role="img" aria-label="NES Screen" />
            {errorMessage && debugMode 
                && <pre style={{ color: 'red' }}>{errorMessage}</pre>
            }
        </>
    )
})

NESEmulatorReact.displayName = 'NESEmulatorReact'

export { NESEmulatorReact }
