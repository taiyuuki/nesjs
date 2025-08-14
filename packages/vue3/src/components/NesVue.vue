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
    emulator.start('248/Bao Qing Tian by KaSing (ChS).nes').then(() => {

        emulator.resizeScreen(800)
    })
}

function stop() {
    emulator.stop()
}

function play() {
    emulator.toggle()
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

function save() {
    emulator.saveState('mario')
}

function load() {
    emulator.loadState('mario')
}
function toggleClip() {
    clip = !clip
    emulator.updateOptions({ clip })
}

function toggleGamepad() {
    enableGamepad = !enableGamepad
    emulator.updateOptions({ enableGamepad })
}

function addCheat() {
    emulator.setCheat('079F-01-01')
}

function removeCheat() {
    emulator.removeCheat('079F-01-01')
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
  <button @click="addCheat">
    Add Cheat
  </button>
  <button @click="removeCheat">
    Remove Cheat
  </button>
</template>
