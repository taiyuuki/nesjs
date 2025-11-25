<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { NESComponentExpose } from './types'
import NesVue from './components/nes-vue.vue'
import NametableDebug from './components/NametableDebug.vue'

const nesRef = ref<NESComponentExpose>()
const romUrl = ref<string | Blob>('Super Mario Bros (JU).nes')
const biosURL = ref('DISKSYS.ROM')
const showDebugPanel = ref(false)

// 预设的ROM选项
const romPresets = {
    'Super Mario Bros (JU).nes': 'Super Mario Bros (JU).nes',
    'Super Mario Bros. 2J (J).fds': 'Super Mario Bros. 2J (J).fds',
}

const switchROM = (romName: string) => {
    romUrl.value = romName
}

// 模拟器配置
const emulatorConfig = reactive({
    scale: 3,
    smoothing: false,
    clip8px: true,
    audioBufferSize: 1024,
    audioSampleRate: 44100,
    enableSAB: true,
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

let state: any = null
const saveState = () => {
    state = nesRef.value?.save()
    console.log('Saved State:', state)
}

const loadState = () => {
    if (state) {
        nesRef.value?.load(state)
        console.log('State Loaded')
    }
    else {
        console.log('No State to Load')
    }
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

const toggleDebugPanel = () => {
    showDebugPanel.value = !showDebugPanel.value
}

const loadBios = async() => {
    const response = await fetch(biosURL.value)
    const arrayBuffer = await response.arrayBuffer()
    const biosData = new Uint8Array(arrayBuffer)
    nesRef.value?.setFDSBIOS(biosData)
}

onMounted(loadBios)
</script>

<template>
  <div class="nes-container">
    <NesVue 
      ref="nesRef"
      :rom="romUrl" 
      :volume="100"
      :auto-start="true"
      :emulator-config="emulatorConfig"
      debug-mode
      class="nes-emulator"
      @loaded="getROMInfo"
    />
    <div class="controls">
      <input
        type="file"
        accept="*.nes"
        @change="selectROM"
      >
      <div class="rom-selector">
        <label>快速ROM切换:</label>
        <select
          :value="romUrl"
          @change="switchROM(($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="(path, name) in romPresets"
            :key="name"
            :value="path"
          >
            {{ name }}
          </option>
        </select>
      </div>
      <button @click="togglePlay">
        {{ isPlaying ? '暂停' : '开始' }}
      </button>
      <button @click="reset">
        重置
      </button>
      <button @click="screenshot">
        截图
      </button>
      <button @click="saveState">
        存档
      </button>
      <button @click="loadState">
        读档
      </button>
      <button @click="toggleDebugPanel">
        {{ showDebugPanel ? '隐藏调试' : '显示调试' }}
      </button>
    </div>
    <div
      id="memory-view"
      class="memory-view"
    />

    <!-- Nametable调试面板 -->
    <NametableDebug
      v-if="showDebugPanel"
      :nes-ref="nesRef"
      :enabled="showDebugPanel"
      @close="showDebugPanel = false"
    />
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
  align-items: center;
}

.rom-selector,
.file-input {
  display: flex;
  align-items: center;
  gap: 10px;
}

select {
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f8f8f8;
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

.memory-view {
  margin-top: 20px;
  padding: 15px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  min-height: 50px;
}

.memory-view h3 {
  margin: 0 0 10px 0;
  font-family: sans-serif;
  font-size: 14px;
}

.memory-view p {
  margin: 5px 0;
}
</style>
