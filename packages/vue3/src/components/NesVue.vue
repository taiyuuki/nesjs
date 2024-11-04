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

function playVideo() {
    emulator.playVideo({
        type: 'fm2',
        URL: 'happylee-supermariobros,warped.fm2',
    })
}

function stopVideo() {
    emulator.stopVideo()
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
  <button @click="playVideo">
    Play FM2
  </button>
  <button @click="stopVideo">
    Stop FM2
  </button>
</template>
