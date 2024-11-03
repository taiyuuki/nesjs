<script setup lang="ts">
import { NesEmulator } from '@nesjs/native'
import { Ref, ref } from 'vue'

const cvs = ref() as Ref<HTMLCanvasElement>

function start() { 
    const nes = new NesEmulator(cvs.value)
    nes.start('魂斗罗.nes')
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
</template>
