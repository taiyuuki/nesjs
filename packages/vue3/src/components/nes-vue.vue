<script setup lang="ts">
import { type Ref, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NESEmulator } from '@nesjs/native'
import type { NESComponentExpose, NESOptions } from '../types'

// 接收 props
const props = withDefaults(defineProps<NESOptions>(), {
    autoStart: false,
    volume: 50,
    debugMode: false,
    mashingSpeed: 16,
    emulatorConfig: () => ({
        scale: 2,
        clip8px: true,
        smoothing: false,
        audioBufferSize: 1024,
        audioSampleRate: 44100,
    }),
})

const emit = defineEmits<{ loaded: [void] }>()

const cvs = ref() as Ref<HTMLCanvasElement>

// Status
const isPlaying = ref(false)
const isLoading = ref(false)
const isReady = ref(false)
const errorMessage = ref<string | null>(null)

// Emulator instance
let emulator: NESEmulator | null = null

// Load ROM data
async function loadROMData(): Promise<void> {
    if (!emulator) {
        throw new Error('Emulator not initialized')
    }

    if (typeof props.rom === 'string') {
        const res = await fetch(props.rom)
        if (!res.ok) {
            throw new Error(`Failed to fetch ROM: ${res.status} ${res.statusText}`)
        }
        const buf = await res.arrayBuffer()
        await emulator.loadROM(new Uint8Array(buf))
    }
    else if (props.rom instanceof ArrayBuffer) {
        await emulator.loadROM(new Uint8Array(props.rom))
    }
    else if (props.rom instanceof Uint8Array) {
        await emulator.loadROM(props.rom)
    }
    else if (props.rom instanceof Blob) {
        const buf = await props.rom.arrayBuffer()
        await emulator.loadROM(new Uint8Array(buf))
        emit('loaded')
    }
    else {
        throw new Error('Invalid ROM format')
    }
}

watch(() => props.rom, async() => {
    if (emulator) {
        isLoading.value = true
        errorMessage.value = null
        isReady.value = false
        isPlaying.value = false

        try {
            await loadROMData()
            isReady.value = true

            if (props.autoStart) {
                await start()
            }
        }
        catch(error) {
            if (props.debugMode) {
                const err = error instanceof Error ? error : new Error(String(error))
                errorMessage.value = err.message
                console.error('Failed to load ROM:', err)
            }
        }
        finally {
            isLoading.value = false
        }
    }
}, { immediate: true })

// Listen for volume changes
watch(() => props.volume, newVolume => {
    if (emulator && typeof newVolume === 'number') {
        emulator.setVolume(Math.max(0, Math.min(100, newVolume)) / 100)
    }
})

// Listen for scale changes
watch(() => props.emulatorConfig?.scale, newScale => {
    if (emulator && typeof newScale === 'number') {
        emulator.setScale(Math.max(1, newScale))
    }
})

// Listen for smoothing setting changes
watch(() => props.emulatorConfig?.smoothing, newVal => {
    if (emulator && typeof newVal === 'boolean') {
        emulator.setSmoothing(newVal)
    }
})

// Listen for fill color changes
watch(() => props.emulatorConfig?.fillColor, newVal => {
    if (emulator && newVal !== undefined) {
        emulator.setFillColor(newVal)
    }
})

// Listen for player 1 key map changes
watch(() => props.emulatorConfig.player1KeyMap, newVal => {
    if (emulator && newVal !== undefined) {
        emulator.setupKeyboadController(1, newVal)
    }
})

// Listen for player 2 key map changes
watch(() => props.emulatorConfig.player2KeyMap, newVal => {
    if (emulator && newVal !== undefined) {
        emulator.setupKeyboadController(2, newVal)
    }
})

// Listen for clip 8px changes
watch(() => props.emulatorConfig.clip8px, newVal => {
    if (emulator && typeof newVal === 'boolean') {
        emulator.setClip8px(newVal)
    }
})

// Enable audio on user interaction
const enableAudioOnInteraction = async() => {
    if (emulator) {
        try {
            await emulator.enableAudio()

            // Remove event listeners
            document.removeEventListener('click', enableAudioOnInteraction)
            document.removeEventListener('keydown', enableAudioOnInteraction)
            document.removeEventListener('touchstart', enableAudioOnInteraction)
        }
        catch(error) {
            if (props.debugMode) {
                console.error('Audio context activation failed:', error)
            }
        }
    }
}

onMounted(async() => {
    isLoading.value = true
    errorMessage.value = null

    try {

        await nextTick() // Ensure DOM is rendered

        emulator = new NESEmulator(cvs.value, props.emulatorConfig)

        // Load ROM
        await loadROMData()

        // Set initial configuration
        emulator.setVolume(Math.max(0, Math.min(100, props.volume)) / 100)
        emulator.setScale(Math.max(1, props.emulatorConfig?.scale || 2))
        emulator.setSmoothing(props.emulatorConfig?.smoothing || false)

        isReady.value = true

        // Auto start
        if (props.autoStart) {

            // Add user interaction listeners to enable audio
            document.addEventListener('click', enableAudioOnInteraction)
            document.addEventListener('keydown', enableAudioOnInteraction)
            document.addEventListener('touchstart', enableAudioOnInteraction)
            await start()
        }
    }
    catch(error) {
        const err = error instanceof Error ? error : new Error(String(error))
        errorMessage.value = err.message
        if (props.debugMode) {
            console.error('Failed to initialize emulator:', err)
        }
    }
    finally {
        isLoading.value = false
    }
})

onBeforeUnmount(() => {
    if (emulator) {
        emulator.stop()
        emulator = null
    }

    document.removeEventListener('click', enableAudioOnInteraction)
    document.removeEventListener('keydown', enableAudioOnInteraction)
    document.removeEventListener('touchstart', enableAudioOnInteraction)
})

function setFDSBIOS(bios: Uint8Array) {
    if (!emulator) {
        throw new Error('Emulator not initialized')
    }
    emulator.setFDSBIOS(bios)
}

// Control functions
async function start(): Promise<void> {
    if (!emulator) {
        throw new Error('Emulator not initialized')
    }
    await emulator.start()
    isPlaying.value = true
}

function reset(): void {
    if (!emulator) return
    emulator.reset()
    isPlaying.value = false
}

function stop(): void {
    if (!emulator) return
    emulator.stop()
    isPlaying.value = false
}

function pause(): void {
    if (!emulator) return
    emulator.pause()
    isPlaying.value = false
}

function play(): void {
    if (!emulator) return
    emulator.resume()
    isPlaying.value = true
}

async function togglePlay(): Promise<void> {
    if (!emulator) return

    if (isPlaying.value) {
        pause()

        return
    }

    if (emulator.status === 0) { // 0 = STOPPED
        await start()
    }
    else {
        play()
    }
}

function save(): Uint8Array {
    if (!emulator) {
        throw new Error('Emulator not initialized')
    }

    return emulator.nes.createBinarySaveState()
}

function load(data: Uint8Array): boolean {
    if (!emulator) {
        throw new Error('Emulator not initialized')
    }

    return emulator.nes.loadBinarySaveState(data)
}

function screenshot(download = false): string {
    if (!cvs.value) {
        throw new Error('Canvas not available')
    }

    const src = cvs.value.toDataURL('image/png')
    if (download) {
        const link = document.createElement('a')
        link.href = src
        link.download = `nes-screenshot-${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return src
}

// Save state management
function downloadSaveState(): void {
    try {
        const saveData = save()
        const blob = new Blob([new Uint8Array(saveData.buffer as ArrayBuffer)], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `nes-save-${Date.now()}.sav`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }
    catch(error) {
        if (props.debugMode) {
            console.error('Failed to save state:', error)
        }
    }
}

async function uploadSaveState(): Promise<void> {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.sav'

        input.onchange = async e => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) {
                reject(new Error('No file selected'))

                return
            }

            try {
                const buffer = await file.arrayBuffer()
                const data = new Uint8Array(buffer)
                const success = load(data)
                if (success) {
                    resolve()
                }
                else {
                    reject(new Error('Failed to load save state'))
                }
            }
            catch(error) {
                reject(error)
            }
        }

        input.oncancel = () => {
            reject(new Error('File selection cancelled'))
        }

        document.body.appendChild(input)
        input.click()
        document.body.removeChild(input)
    })
}

function addCheat(code: string) {
    emulator?.addCheat(code)
}

function toggleCheat(code: string) {
    emulator?.toggleCheat(code)
}

function removeCheat(code: string) {
    emulator?.removeCheat(code)
}

function clearAllCheats() {
    emulator?.clearAllCheats()
}

function getROMInfo() {
    return emulator?.nes.getROMInfo() || null
}

function getDebugInfo() {
    return emulator?.nes.getDebugInfo()
}

function getNES() {
    return emulator?.nes || null
}

defineExpose<NESComponentExpose>({
    setFDSBIOS,
    getNES,
    start,
    reset,
    stop,
    pause,
    play,
    togglePlay,
    save,
    load,
    screenshot,
    downloadSaveState,
    uploadSaveState,
    addCheat,
    removeCheat,
    toggleCheat,
    clearAllCheats,
    getROMInfo,
    getDebugInfo,
    get isPlaying() { return isPlaying.value },
    get isLoading() { return isLoading.value },
})
</script>

<template>
  <canvas
    ref="cvs"
    width="256"
    height="240"
  />
</template>
