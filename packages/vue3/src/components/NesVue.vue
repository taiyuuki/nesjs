<script setup lang="ts">
import { NESEmulator } from '@nesjs/native'
import { Ref, onMounted, ref } from 'vue'

const cvs = ref() as Ref<HTMLCanvasElement>

let emulator: NESEmulator

onMounted(() => {
    emulator = new NESEmulator(cvs.value, {
        controller: {
            p1: {
                UP: 'KeyW',
                DOWN: 'KeyS',
                LEFT: 'KeyA',
                RIGHT: 'KeyD',
                A: 'KeyK',
                B: 'KeyJ',
                C: 'KeyO',
                D: 'KeyI',
                SELECT: 'Digit2',
                START: 'Digit1',
            },
        },
    })
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
