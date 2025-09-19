<script setup lang="ts">
import { NESEmulator } from '@nesjs/native'
import { NESOptions } from 'src/types'
import { type Ref, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<NESOptions>(), {
    autoStart: false,
    scale: 1,
    volume: 50,
    clip8px: true,
    debugMode: false,
    mashingSpeed: 16,
})

const cvs = ref() as Ref<HTMLCanvasElement>

// 状态管理
const isPlaying = ref(false)
const isLoading = ref(false)

let emulator: NESEmulator

// 监听音量变化
watch(() => props.volume, () => {

    // 设置模拟器音量 (0-100 转换为 0-1)
    if (emulator) {
        emulator.setVolume(props.volume / 100)
    }
})

// 监听缩放变化
watch(() => props.scale, () => {

    // 设置模拟器缩放
    if (emulator) {
        emulator.setScale(props.scale)
    }
})

watch(() => props.smoothing, newVal => {
    if (emulator) {
        emulator.setSmoothing(newVal)
    }
})

// 初始化模拟器
onMounted(async() => {
    isLoading.value = true
    try {
        emulator = new NESEmulator(cvs.value, { clip8px: props.clip8px })
        
        await loadROMData()
        
        // 设置初始音量
        emulator.setVolume(props.volume / 100)

        // 设置初始缩放
        emulator.setScale(props.scale)

        // 设置抗锯齿
        emulator.setSmoothing(props.smoothing)

        if (props.autoStart) {
            await start()
        }
    }
    catch (error) {
        console.error('Failed to initialize emulator:', error)
    }
    finally {
        isLoading.value = false
    }
})

// 加载 ROM 数据
async function loadROMData() {
    if (typeof props.rom === 'string') {
        const res = await fetch(props.rom)
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
async function start() {
    await emulator.start()
    isPlaying.value = true
}

function reset() {
    emulator.reset()
    isPlaying.value = false
}

function stop() {
    emulator.stop()
    isPlaying.value = false
}

function pause() {
    emulator.pause()
    isPlaying.value = false
}

function play() {
    emulator.resume()
    isPlaying.value = true
}

function togglePlay() {
    if (isPlaying.value) {
        pause()

        return
    }

    if (emulator.status === 0) { // 0 = STOPPED
        start()
    }
    else {
        play()
    }
}

function save() {
    return emulator.nes.createBinarySaveState()
}

function load(data: Uint8Array) {
    emulator.nes.loadBinarySaveState(data)
}

function screenshot(download = false) {
    const src = cvs.value.toDataURL('image/png')
    if (download) {
        const link = document.createElement('a')
        link.href = src
        link.download = `nes-screenshot-${Date.now()}.png`
        link.click()
    }

    return src
}

// 存档管理
function downloadSaveState() {
    try {
        const saveData = save()
        const blob = new Blob([new Uint8Array(saveData.buffer as ArrayBuffer)], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `nes-save-${Date.now()}.sav`
        link.click()
        URL.revokeObjectURL(url)
    }
    catch (error) {
        console.error('Failed to save state:', error)
    }
}

defineExpose({
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
    isPlaying,
})
</script>

<template>
  <canvas
    ref="cvs"
    width="256"
    height="240"
  />
</template>
