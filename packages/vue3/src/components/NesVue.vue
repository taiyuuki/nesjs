<script setup lang="ts">
import { NESEmulator } from '@nesjs/native'
import { Ref, onMounted, ref } from 'vue'

const cvs = ref() as Ref<HTMLCanvasElement>

let emulator: NESEmulator

let clip = false
let enableGamepad = true
onMounted(() => {
    emulator = new NESEmulator(cvs.value)
})

function start() {
    emulator.start('Super Mario Bros (JU).nes').then(() => {
        emulator.resizeScreen(800)
        const cheatCode = '079F-01-01'
        emulator.nes.cheat.onCheat(cheatCode)
    })
}

function stop() {
    emulator.stop()
}

function pause() {
    emulator.pause()
}

function play() {
    emulator.play()
}

function reset() {
    emulator.reset()
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
let saveState: ReturnType<NESEmulator['saveState']> | null = null
function save() {
    saveState = emulator.saveState()
}

function load() {
    if (!saveState) return
    emulator.loadState(saveState)
}
function toggleClip() {
    clip = !clip
    emulator.updateOptions({ clip })
}

function toggleGamepad() {
    enableGamepad = !enableGamepad
    emulator.updateOptions({ enableGamepad })
}
</script>

<template>
  <div>
    <canvas
      ref="cvs"
      width="256"
      height="240"
    />
  </div>
  <button @click="start">
    Start
  </button>
  <button @click="stop">
    Stop
  </button>
  <button @click="pause">
    Pause
  </button>
  <button @click="play">
    Play
  </button>
  <button @click="reset">
    Reset
  </button>
  <button @click="playVideo">
    Play FM2
  </button>
  <button @click="stopVideo">
    Stop FM2
  </button>
  <button @click="save">
    Save State
  </button>
  <button @click="load">
    Load State
  </button>
  <button @click="toggleClip">
    Clip
  </button>
  <button @click="toggleGamepad">
    Gamepad
  </button>
</template>
