<script setup lang="ts">
import { NESEmulator } from '@nesjs/native'
import { Ref, onMounted, ref } from 'vue'

const props = defineProps<{
    rom: string | ArrayBuffer | Uint8Array | Blob
    autoStart?: boolean
    scale?: number
    label?: string
    gain?: number
    noClip?: boolean
    storage?: boolean
    debugger?: boolean
    turbo?: number
    dbName?: string
}>()

const cvs = ref() as Ref<HTMLCanvasElement>
let emulator: NESEmulator

onMounted(async() => {
    emulator = new NESEmulator(cvs.value, { clip8px: true })
    if (typeof props.rom === 'string') {
        const res = await fetch(props.rom)
        const buf = await res.arrayBuffer()
        await emulator.loadROM(new Uint8Array(buf))
    }
    else if (props.rom instanceof ArrayBuffer) {
        emulator.loadROM(new Uint8Array(props.rom))
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
    if (props.autoStart) {
        await emulator.start()
    }
})

function start() {
    emulator.start()
}

function reset() {
    emulator.reset()
}

function stop() {
    emulator.stop()
}

function pause() {
    emulator.pause()
}

function play() {
    emulator.resume()
}

function save() {
    return emulator.nes.createBinarySaveState()
}

function load(data: Uint8Array) {
    emulator.nes.loadBinarySaveState(data)
}

function loadSavedData(data: Uint8Array) {
    return emulator.nes.loadBinarySaveState(data)
}

function getCurrentData() {
    return emulator.nes.createBinarySaveState()
}

function screenshot(download = false) {
    const src = cvs.value.toDataURL('image/png')
    if (download) {
        const link = document.createElement('a')
        link.href = src
        link.download = `${Date.now().toLocaleString()}.png`
        link.click()
    }

    return src
}

defineExpose({
    start,
    reset,
    stop,
    pause,
    play,
    save,
    load,
    loadSavedData,
    getCurrentData,
    screenshot,
})
</script>

<template>
  <div>
    <canvas
      ref="cvs"
      width="256"
      height="240"
    />
  </div>
</template>
