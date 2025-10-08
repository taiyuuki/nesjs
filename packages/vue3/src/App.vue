<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { NESComponentExpose } from './types'
import NesVue from './components/nes-vue.vue'

const nesRef = ref<NESComponentExpose>()
const romUrl = ref<string | Blob>('Super Mario Bros (JU).nes')

// 模拟器配置
const emulatorConfig = reactive({
    scale: 3,
    smoothing: false,
    clip8px: true,
    audioBufferSize: 1024,
    audioSampleRate: 44100,
})

const isPlaying = computed(() => nesRef.value?.isPlaying || false)

const togglePlay = async() => {
    await nesRef.value?.togglePlay()
}

const reset = () => {
    nesRef.value?.reset()
}

const screenshot = () => {
    nesRef.value?.screenshot(true) // true = 自动下载
}

const downloadSave = () => {
    nesRef.value?.downloadSaveState()
}

const selectROM = async(event: Event) => {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
        const file = input.files[0]
        romUrl.value = file
    }
}

const getROMInfo = async() => {
    const info = nesRef.value?.getROMInfo()
    console.log('ROM Info:', info)
}
</script>

<template>
  <div class="nes-container">
    <NesVue 
      ref="nesRef"
      :rom="romUrl" 
      :volume="100"
      :auto-start="true"
      :emulator-config="emulatorConfig"
      :debug-mode="true"
      class="nes-emulator"
      @loaded="getROMInfo"
    />
    <div class="controls">
      <input
        type="file"
        accept="*.nes"
        @change="selectROM"
      >
      <button @click="togglePlay">
        {{ isPlaying ? '暂停' : '开始' }}
      </button>
      <button @click="reset">
        重置
      </button>
      <button @click="screenshot">
        截图
      </button>
      <button @click="downloadSave">
        下载存档
      </button>
    </div>
  </div>
</template>

<style scoped>
.nes-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.nes-emulator {
  border: 2px solid #333;
  border-radius: 8px;
}

.controls {
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f0f0f0;
  cursor: pointer;
  color: #000;
}

button:hover {
  background: #e0e0e0;
}
</style>
