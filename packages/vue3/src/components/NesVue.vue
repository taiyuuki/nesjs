<script setup lang="ts">
import { NESEmulator } from '@nesjs/native'
import { Ref, onMounted, ref } from 'vue'

const cvs = ref() as Ref<HTMLCanvasElement>
let emulator: NESEmulator

function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    file?.arrayBuffer().then(buffer => {
        const romData = new Uint8Array(buffer)
        emulator.loadROM(romData)
        emulator.start()
    })
}

onMounted(() => {
    emulator = new NESEmulator(cvs.value)
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
</template>
