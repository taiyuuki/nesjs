<script setup lang="ts">
import { NESEmulator } from '@nesjs/native'
import { Ref, onMounted, ref } from 'vue'

const cvs = ref() as Ref<HTMLCanvasElement>
let emulator: NESEmulator

function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    file?.arrayBuffer().then(async buffer => {
        const romData = new Uint8Array(buffer)
        await emulator.loadROM(romData)
        await emulator.start()
    })
}

function cheatCode(code: string) {
    emulator.addCheat(code)
}

onMounted(() => {
    emulator = new NESEmulator(cvs.value, { clip8px: true })
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
  <input
    type="file"
    @change="handleFileChange"
  >
  <button @click="cheatCode('079F-01-01')">
    无限星星
  </button>
</template>
