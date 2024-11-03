<script setup lang="ts">
import { NesEmulator } from '@nesjs/native'
import { Ref, onMounted, ref } from 'vue'

const cvs = ref() as Ref<HTMLCanvasElement>

let emulator: NesEmulator

onMounted(() => {
    emulator = new NesEmulator(cvs.value)
})

function start() {
    emulator.start('Super Mario Bros (JU).nes')
    emulator.animation.resize(500)

}

function playFM2() {
    emulator.playFM2('happylee-supermariobros,warped.fm2')
}
</script>

<template>
  <canvas
    ref="cvs"
    width="256"
    height="240"
  />
  <button @click="start">
    Start
  </button>
  <button @click="playFM2">
    Play FM2
  </button>
</template>
