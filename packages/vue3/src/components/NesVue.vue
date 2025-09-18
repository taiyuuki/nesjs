<script setup lang="ts">
import { NESEmulator } from '@nesjs/native'
import { type Ref, computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
    rom: string | ArrayBuffer | Uint8Array | Blob
    autoStart?: boolean
    scale?: number
    volume?: number
    clip8px?: boolean
    debugMode?: boolean
    mashingSpeed?: number
}>(), {
    autoStart: false,
    scale: 1,
    volume: 50,
    clip8px: true,
    debugMode: false,
    mashingSpeed: 1,
})

// 组件引用
const cvs = ref() as Ref<HTMLCanvasElement>
const fileInput = ref() as Ref<HTMLInputElement>

// 状态管理
const isPlaying = ref(false)
const isLoading = ref(false)
const currentVolume = ref(props.volume)
const currentScale = ref(props.scale)
const showControls = ref(true)
const controlsTimer = ref<NodeJS.Timeout>()

let emulator: NESEmulator

// 计算属性
const volumeIcon = computed(() => {
    if (currentVolume.value === 0) return '🔇'
    if (currentVolume.value < 50) return '🔉'

    return '🔊'
})

const playButtonIcon = computed(() => isPlaying.value ? '⏸️' : '▶️')

// 监听音量变化
watch(currentVolume, () => {

    // 设置模拟器音量 (0-100 转换为 0-1)
    if (emulator) {
        emulator.setVolume(currentVolume.value / 100)
    }
})

// 监听缩放变化
watch(currentScale, () => {

    // 设置模拟器缩放
    if (emulator) {
        emulator.setScale(currentScale.value)
    }
})

// 初始化模拟器
onMounted(async() => {
    isLoading.value = true
    try {
        emulator = new NESEmulator(cvs.value, { clip8px: props.clip8px })
        
        await loadROMData()
        
        // 设置初始音量
        emulator.setVolume(currentVolume.value / 100)
        
        // 设置初始缩放
        emulator.setScale(currentScale.value)
        
        if (props.autoStart) {
            await start()
        }
    }
    catch (error) {
        console.error('Failed to initialize emulator:', error)
    }
    finally {
        isLoading.value = false
    }
})

// 加载 ROM 数据
async function loadROMData() {
    if (typeof props.rom === 'string') {
        const res = await fetch(props.rom)
        const buf = await res.arrayBuffer()
        await emulator.loadROM(new Uint8Array(buf))
    }
    else if (props.rom instanceof ArrayBuffer) {
        await emulator.loadROM(new Uint8Array(props.rom))
    }
    else if (props.rom instanceof Uint8Array) {
        await emulator.loadROM(props.rom)
    }
    else if (props.rom instanceof Blob) {
        const buf = await props.rom.arrayBuffer()
        await emulator.loadROM(new Uint8Array(buf))
    }
    else {
        throw new Error('Invalid ROM format')
    }
}

// 控制函数
function start() {
    emulator.start()
    isPlaying.value = true
}

function reset() {
    emulator.reset()
    isPlaying.value = false
}

function stop() {
    emulator.stop()
    isPlaying.value = false
}

function pause() {
    emulator.pause()
    isPlaying.value = false
}

function play() {
    emulator.resume()
    isPlaying.value = true
}

function togglePlay() {
    if (isPlaying.value) {
        pause()

        return
    }

    // 如果游戏未启动，首次点击会启动游戏
    // 如果游戏已启动但暂停，会恢复游戏
    if (emulator.status === 0) { // 0 表示停止状态
        start()
    }
    else {
        play()
    }
}

function save() {
    return emulator.nes.createBinarySaveState()
}

function load(data: Uint8Array) {
    emulator.nes.loadBinarySaveState(data)
}

function loadSavedData(data: Uint8Array) {
    return emulator.nes.loadBinarySaveState(data)
}

function getCurrentData() {
    return emulator.nes.createBinarySaveState()
}

function screenshot(download = false) {
    const src = cvs.value.toDataURL('image/png')
    if (download) {
        const link = document.createElement('a')
        link.href = src
        link.download = `nes-screenshot-${Date.now()}.png`
        link.click()
    }

    return src
}

// 存档管理
function downloadSaveState() {
    try {
        const saveData = save()
        const blob = new Blob([new Uint8Array(saveData.buffer as ArrayBuffer)], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `nes-save-${Date.now()}.sav`
        link.click()
        URL.revokeObjectURL(url)
    }
    catch (error) {
        console.error('Failed to save state:', error)
    }
}

function handleLoadSaveState() {
    fileInput.value.click()
}

function onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = e => {
            const result = e.target?.result
            if (result instanceof ArrayBuffer) {
                load(new Uint8Array(result))
            }
        }
        reader.readAsArrayBuffer(file)
    }
}

// 控制栏显示/隐藏
function showControlsTemporarily() {
    showControls.value = true
    if (controlsTimer.value) {
        clearTimeout(controlsTimer.value)
    }
    controlsTimer.value = setTimeout(() => {
        showControls.value = false
    }, 3000)
}

function onMouseMove() {
    showControlsTemporarily()
}

function onMouseLeave() {
    if (controlsTimer.value) {
        clearTimeout(controlsTimer.value)
    }
    controlsTimer.value = setTimeout(() => {
        showControls.value = false
    }, 1000)
}

defineExpose({
    start,
    reset,
    stop,
    pause,
    play,
    togglePlay,
    save,
    load,
    loadSavedData,
    getCurrentData,
    screenshot,
    downloadSaveState,
    isPlaying,
    currentVolume,
    currentScale,
})
</script>

<template>
  <div 
    class="nes-player" 
    @mousemove="onMouseMove" 
    @mouseleave="onMouseLeave"
  >
    <!-- 加载状态 -->
    <div 
      v-if="isLoading" 
      class="loading-overlay"
    >
      <div class="loading-spinner" />
      <p>Loading NES Game...</p>
    </div>

    <!-- 游戏画面 -->
    <div class="game-container">
      <canvas
        ref="cvs"
        class="game-canvas"
        width="256"
        height="240"
      />
    </div>

    <!-- 控制栏 -->
    <div 
      class="controls" 
      :class="{ 'controls--visible': showControls }"
    >
      <!-- 主要播放控制 -->
      <div class="controls__main">
        <button 
          class="btn btn--play" 
          :disabled="isLoading"
          @click="togglePlay"
        >
          {{ playButtonIcon }}
        </button>
        
        <button 
          class="btn btn--reset" 
          :disabled="isLoading"
          @click="reset"
        >
          🔄
        </button>
        
        <button 
          class="btn btn--stop" 
          :disabled="isLoading"
          @click="stop"
        >
          ⏹️
        </button>
      </div>

      <!-- 音量控制 -->
      <div class="controls__volume">
        <span class="volume-icon">{{ volumeIcon }}</span>
        <input
          v-model="currentVolume"
          type="range"
          min="0"
          max="100"
          class="volume-slider"
        >
        <span class="volume-text">{{ currentVolume }}%</span>
      </div>

      <!-- 缩放控制 -->
      <div class="controls__scale">
        <span class="scale-icon">🔍</span>
        <input
          v-model="currentScale"
          type="range"
          min="1"
          max="4"
          step="0.5"
          class="scale-slider"
        >
        <span class="scale-text">{{ currentScale }}x</span>
      </div>

      <!-- 功能按钮 -->
      <div class="controls__actions">
        <button 
          class="btn btn--action" 
          title="截图"
          @click="screenshot(true)"
        >
          📷
        </button>
        
        <button 
          class="btn btn--action" 
          title="下载存档"
          @click="downloadSaveState"
        >
          💾
        </button>
        
        <button 
          class="btn btn--action" 
          title="加载存档"
          @click="handleLoadSaveState"
        >
          📁
        </button>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInput"
      type="file"
      accept=".sav"
      style="display: none"
      @change="onFileSelected"
    >

    <!-- 游戏信息显示 -->
    <div class="game-info">
      <div 
        class="status-indicator" 
        :class="{ 'status--playing': isPlaying }"
      >
        {{ isPlaying ? 'Playing' : 'Paused' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 主容器 */
.nes-player {
  position: relative;
  display: inline-block;
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3a 100%);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  user-select: none;
}

/* 游戏容器 */
.game-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  min-height: 240px;
}

.game-canvas {
  display: block;
  image-rendering: pixelated;
  border: none;
  transition: transform 0.3s ease;
}

/* 加载状态 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 100;
  color: white;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #333;
  border-top: 4px solid #ff6b6b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 控制栏 */
.controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.7) 50%,
    transparent 100%
  );
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 20px;
  opacity: 0;
  transform: translateY(100%);
  transition: all 0.3s ease;
}

.controls--visible {
  opacity: 1;
  transform: translateY(0);
}

.nes-player:hover .controls {
  opacity: 1;
  transform: translateY(0);
}

.controls__main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.controls__volume {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  margin-right: 16px;
}

.controls__scale {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
}

.controls__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 按钮样式 */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.btn:active {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.btn--play {
  width: 48px;
  height: 48px;
  font-size: 20px;
  background: linear-gradient(135deg, #ff6b6b, #ff5252);
  border-color: #ff5252;
}

.btn--play:hover:not(:disabled) {
  background: linear-gradient(135deg, #ff5252, #ff3d3d);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.btn--reset,
.btn--stop {
  width: 40px;
  height: 40px;
}

.btn--action {
  width: 36px;
  height: 36px;
  font-size: 14px;
}

/* 音量控制 */
.volume-icon {
  font-size: 18px;
  color: white;
  margin-right: 4px;
}

.volume-slider {
  width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  appearance: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ff6b6b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.volume-slider::-webkit-slider-thumb:hover {
  background: #ff5252;
  transform: scale(1.1);
}

.volume-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ff6b6b;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.volume-slider::-moz-range-thumb:hover {
  background: #ff5252;
  transform: scale(1.1);
}

.volume-text {
  color: white;
  font-size: 12px;
  font-weight: 500;
  min-width: 35px;
  margin-left: 4px;
}

/* 缩放控制 */
.scale-icon {
  font-size: 18px;
  color: white;
  margin-right: 4px;
}

.scale-slider {
  width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  appearance: none;
  cursor: pointer;
}

.scale-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #4caf50;
  cursor: pointer;
  transition: all 0.2s ease;
}

.scale-slider::-webkit-slider-thumb:hover {
  background: #45a049;
  transform: scale(1.1);
}

.scale-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #4caf50;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.scale-slider::-moz-range-thumb:hover {
  background: #45a049;
  transform: scale(1.1);
}

.scale-text {
  color: white;
  font-size: 12px;
  font-weight: 500;
  min-width: 32px;
  margin-left: 4px;
}

/* 游戏信息 */
.game-info {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
}

.status-indicator {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.status--playing {
  background: rgba(76, 175, 80, 0.8);
  border-color: rgba(76, 175, 80, 0.3);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .controls {
    padding: 16px;
    gap: 16px;
  }

  .controls__volume {
    margin-left: 8px;
    margin-right: 8px;
  }

  .controls__scale {
    margin-right: 8px;
  }

  .volume-slider,
  .scale-slider {
    width: 60px;
  }

  .btn--play {
    width: 44px;
    height: 44px;
    font-size: 18px;
  }

  .btn--reset,
  .btn--stop {
    width: 36px;
    height: 36px;
  }

  .btn--action {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .controls {
    flex-wrap: wrap;
    padding: 12px;
    gap: 12px;
  }

  .controls__main {
    order: 1;
    flex: 1;
    justify-content: center;
  }

  .controls__volume {
    order: 2;
    flex: 1;
    margin: 0;
    justify-content: center;
  }

  .controls__scale {
    order: 3;
    flex: 1;
    margin: 0;
    justify-content: center;
  }

  .controls__actions {
    order: 4;
    flex: 1;
    justify-content: center;
  }

  .game-info {
    top: 12px;
    right: 12px;
  }
}

/* 自定义滚动条（如果需要） */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}
</style>
