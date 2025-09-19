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

// Canvas 引用
const cvs = ref() as Ref<HTMLCanvasElement>

// 状态管理
const isPlaying = ref(false)
const isLoading = ref(false)
const isReady = ref(false)
const errorMessage = ref<string | null>(null)

// 模拟器实例
let emulator: NESEmulator | null = null

// 监听音量变化
watch(() => props.volume, newVolume => {
    if (emulator && typeof newVolume === 'number') {
        emulator.setVolume(Math.max(0, Math.min(100, newVolume)) / 100)
    }
})

// 监听缩放变化
watch(() => props.emulatorConfig?.scale, newScale => {
    if (emulator && typeof newScale === 'number') {
        emulator.setScale(Math.max(1, newScale))
    }
})

// 监听平滑设置变化
watch(() => props.emulatorConfig?.smoothing, newVal => {
    if (emulator && typeof newVal === 'boolean') {
        emulator.setSmoothing(newVal)
    }
})

// 用户交互检测
const enableAudioOnInteraction = async() => {
    if (emulator) {
        try {
            await emulator.enableAudio()
        }
        catch (error) {
            if (props.debugMode) {
                console.error('Audio context activation failed:', error)
            }
        }
    }

    // 移除事件监听器
    document.removeEventListener('click', enableAudioOnInteraction)
    document.removeEventListener('keydown', enableAudioOnInteraction)
    document.removeEventListener('touchstart', enableAudioOnInteraction)
}

// 初始化模拟器
onMounted(async() => {
    isLoading.value = true
    errorMessage.value = null

    try {

        await nextTick() // 确保DOM已渲染

        emulator = new NESEmulator(cvs.value, props.emulatorConfig)

        // 加载 ROM
        await loadROMData()

        // 设置初始配置
        emulator.setVolume(Math.max(0, Math.min(100, props.volume)) / 100)
        emulator.setScale(Math.max(1, props.emulatorConfig?.scale || 2))
        emulator.setSmoothing(props.emulatorConfig?.smoothing || false)

        isReady.value = true

        // 自动开始
        if (props.autoStart) {
            await start()
            
            // 添加用户交互监听器用于激活音频
            document.addEventListener('click', enableAudioOnInteraction)
            document.addEventListener('keydown', enableAudioOnInteraction)
            document.addEventListener('touchstart', enableAudioOnInteraction)
        }
    }
    catch (error) {
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

// 组件销毁时清理
onBeforeUnmount(() => {
    if (emulator) {
        emulator.stop()
        emulator = null
    }

    // 清理事件监听器
    document.removeEventListener('click', enableAudioOnInteraction)
    document.removeEventListener('keydown', enableAudioOnInteraction)
    document.removeEventListener('touchstart', enableAudioOnInteraction)
})

// 加载 ROM 数据
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
    }
    else {
        throw new Error('Invalid ROM format')
    }
}

// 控制函数
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

// 存档管理
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
    catch (error) {
        if (props.debugMode) {
            console.error('Failed to save state:', error)
        }
    }
}

// 上传存档文件
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
            catch (error) {
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

// 获取游戏信息
function getROMInfo() {
    return emulator?.nes.getROMInfo() || null
}

// 获取调试信息
function getDebugInfo() {
    return emulator?.nes.getDebugInfo()
}

// 暴露组件方法
defineExpose<NESComponentExpose>({
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
