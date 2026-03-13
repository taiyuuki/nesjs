<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { NESComponentExpose } from './types'
import NesVue from './components/nes-vue.vue'
import NametableDebug from './components/NametableDebug.vue'

const nesRef = ref<NESComponentExpose>()
const romUrl = ref<string | Blob>('ROMs/Spacegulls-1.1.nes')
const biosURL = ref('DISKSYS.ROM')
const showDebugPanel = ref(false)

// 预设的ROM选项
const romPresets = {
    'Spacegulls-1.1.nes': 'ROMs/Spacegulls-1.1.nes',
    'arkade-rush.nes':    'ROMs/arkade-rush.nes',
}

const switchROM = (romName: string) => {
    romUrl.value = romName
}

// 模拟器配置
const emulatorConfig = reactive({
    scale:           1,
    smoothing:       false,
    clip8px:         true,
    audioBufferSize: 1024,
    audioSampleRate: 44100,
    enableSAB:       true,
})

const palette = ref<number[] | undefined>(void 0)

async function loadPalette(e: Event) {
    const t = e.target as HTMLInputElement
    const file = t.files![0]
    const buffer = await file.arrayBuffer()

    palette.value = hexToPalette(new Uint8Array(buffer))
}

function hexToPalette(buffer: Uint8Array) {
    const palette = []
    for (let i = 0; i < 64; i++) {
        const r = buffer[i * 3]
        const g = buffer[i * 3 + 1]
        const b = buffer[i * 3 + 2]

        // 转换为 ARGB 格式 (0xAARRGGBB)
        palette.push(r << 16 | g << 8 | b | 0xFF000000)
    }

    return palette
}

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
      :palette="palette"
      debug-mode
      class="nes-emulator"
      @loaded="getROMInfo"
    />
    <div style="display: flex;">
      <div>ROM</div>
      <input
        type="file"
        accept="*.nes"
        @change="selectROM"
      >
    </div>
    <div style="display: flex;">
      <div>调色板</div>
      <input
        type="file"
        accept="*.pal"
        @change="loadPalette"
      >
    </div>  
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
    <div class="controls">
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
