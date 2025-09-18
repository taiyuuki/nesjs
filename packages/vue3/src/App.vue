<script setup lang="ts">
import NesVue from './components/NesVue.vue'
</script>

<template>
  <NesVue
    rom="https://taiyuuki.github.io/nes-vue/Super Mario Bros (JU).nes"
    label="开始游戏"
  />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
