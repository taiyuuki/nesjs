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

// 注入 FDS BIOS
const injectFDSBIOS = async(event: Event) => {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
        const file = input.files[0]

        const arrayBuffer = await file.arrayBuffer()
        const biosData = new Uint8Array(arrayBuffer)
        if (biosData.length !== 8192) {
            console.error('FDS BIOS 大小必须为 8192 字节')

            return
        }
        nesRef.value?.setFDSBIOS(biosData)
        alert('FDS BIOS 注入成功！')
    }
    input.value = '' // 清空输入
}

// 调试：检查游戏代码区域
const checkGameCodeArea = () => {
    const nes = nesRef.value?.getNES()
    if (nes) {

        // 检查 $8000-$800F 区域
        const gameCode = nes.debugReadRAMRange(0x8000, 0x800F)
        console.log('Game code area ($8000-$800F):', gameCode.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`))
        
        // 检查一些BIOS区域
        const biosCode = nes.debugReadRAMRange(0xE000, 0xE00F)
        console.log('BIOS area ($E000-$E00F):', biosCode.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`))
        
        // 检查一些RAM区域
        const ramCode = nes.debugReadRAMRange(0x6000, 0x600F)
        console.log('RAM area ($6000-$600F):', ramCode.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`))
        
        // 创建简单的内存视图
        const memView = document.getElementById('memory-view')
        if (memView) {
            memView.innerHTML = `
                <h3>内存调试视图</h3>
                <p><strong>游戏代码区 ($8000-$800F):</strong> ${gameCode.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}</p>
                <p><strong>BIOS区 ($E000-$E00F):</strong> ${biosCode.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}</p>
                <p><strong>RAM区 ($6000-$600F):</strong> ${ramCode.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}</p>
            `
        }
    }
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
      class="nes-emulator"
      @loaded="getROMInfo"
    />
    <div class="controls">
      <input
        type="file"
        accept="*.fds"
        @change="injectFDSBIOS"
      >
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
      <button @click="checkGameCodeArea">
        调试内存
      </button>
    </div>
    <div
      id="memory-view"
      class="memory-view"
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
