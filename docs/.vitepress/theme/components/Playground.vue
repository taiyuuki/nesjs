<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { NESEmulator } from '@nesjs/native'

// ROM列表
const romList = [
    { name: 'Spacegulls', file: '/roms/Spacegulls-1.1.nes', description: 'Action game' },
    { name: 'BlobQuest', file: '/roms/BlobQuest.nes', description: 'Platformer' },
    { name: 'Arkade Rush', file: '/roms/arkade-rush.nes', description: 'Arcade' },
    { name: 'Wolf Spirit', file: '/roms/WolfSpirit.nes', description: 'Adventure' },
    { name: 'Altercation', file: '/roms/altercation-0.1.nes', description: 'Fighting' },
    { name: 'Atmo Sphere', file: '/roms/Atmo Sphere.nes', description: 'Puzzle' },
    { name: 'Blobert', file: '/roms/blobert.nes', description: 'Platformer' },
    { name: 'FINes', file: '/roms/FINes.nes', description: 'Action' },
    { name: 'Chocoblip', file: '/roms/Chocoblip_Alpha_0.1.nes', description: 'Action' },
    { name: 'Immunatio', file: '/roms/Immunatio (nesdemia).nes', description: 'Puzzle' },
    { name: 'Witch N Wiz', file: '/roms/witchnwiz_2021_02_22_nes_dev_v_1_0_0.nes', description: 'Puzzle' },
    { name: 'Trouble at 2A03', file: '/roms/trouble_at_2a03-nesdev-submission-build.nes', description: 'Music demo' },
]

type RomItem = { name: string, file: string, description: string } | { name: string, data: Uint8Array, description: string }

const currentRom = ref<RomItem | null>(romList[0])
const localFileName = ref<string | null>(null)
const fileInput = ref<HTMLInputElement>()
const cvs = ref<HTMLCanvasElement>()
const isPlaying = ref(false)
const isLoading = ref(false)
const isReady = ref(false)
const volume = ref(50)
const errorMessage = ref<string | null>(null)

let emulator: NESEmulator | null = null

async function loadRom() {
    if (!emulator || !currentRom.value) return

    isLoading.value = true
    errorMessage.value = null
    isReady.value = false
    isPlaying.value = false

    try {
        let romData: Uint8Array

        if ('data' in currentRom.value) {

            // 本地文件
            romData = currentRom.value.data
        }
        else {

            // 远程文件
            const res = await fetch(currentRom.value.file)
            if (!res.ok) {
                throw new Error(`Failed to fetch ROM: ${res.status}`)
            }
            const buf = await res.arrayBuffer()
            romData = new Uint8Array(buf)
        }

        await emulator.loadROM(romData)
        isReady.value = true
        await start()
    }
    catch(error) {
        const err = error instanceof Error ? error : new Error(String(error))
        errorMessage.value = err.message
        console.error('Failed to load ROM:', err)
    }
    finally {
        isLoading.value = false
    }
}

async function handleLocalFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    // 检查文件扩展名
    if (!file.name.toLowerCase().endsWith('.nes')) {
        errorMessage.value = 'Please select a valid .nes ROM file'

        return
    }

    try {
        const buffer = await file.arrayBuffer()
        currentRom.value = {
            name:        file.name.replace('.nes', '').replace('.NES', ''),
            data:        new Uint8Array(buffer),
            description: 'Local file',
        }
        localFileName.value = file.name
        await loadRom()
    }
    catch(error) {
        const err = error instanceof Error ? error : new Error(String(error))
        errorMessage.value = err.message
        console.error('Failed to load local ROM:', err)
    }

    // 清空 input 以便可以重复选择同一文件
    input.value = ''
}

function triggerFileInput() {
    fileInput.value?.click()
}

function selectPresetRom(rom: typeof romList[0]) {
    currentRom.value = rom
    localFileName.value = null
    loadRom()
}

async function start() {
    if (!emulator) return
    await emulator.start()
    isPlaying.value = true
}

async function togglePlay() {
    if (!emulator) return
    if (isPlaying.value) {
        await emulator.pause()
        isPlaying.value = false
    }
    else {
        await emulator.resume()
        isPlaying.value = true
    }
}

function reset() {
    if (!emulator) return
    emulator.reset()
    isPlaying.value = false
}

function updateVolume() {
    if (emulator) {
        emulator.setVolume(volume.value / 100)
    }
}

async function enableAudio() {
    if (emulator) {
        try {
            await emulator.enableAudio()
            document.removeEventListener('click', enableAudio)
            document.removeEventListener('keydown', enableAudio)
        }
        catch(error) {
            console.error('Audio activation failed:', error)
        }
    }
}

onMounted(async() => {
    if (!cvs.value) return

    isLoading.value = true
    try {
        emulator = new NESEmulator(cvs.value, {
            scale:     2,
            smoothing: false,
            clip8px:   true,
        })
        emulator.setVolume(volume.value / 100)

        document.addEventListener('click', enableAudio)
        document.addEventListener('keydown', enableAudio)

        await loadRom()
    }
    catch(error) {
        const err = error instanceof Error ? error : new Error(String(error))
        errorMessage.value = err.message
        console.error('Failed to initialize emulator:', err)
    }
    finally {
        isLoading.value = false
    }
})

onBeforeUnmount(() => {
    if (emulator) {
        emulator.stop()
        emulator = null
    }
    document.removeEventListener('click', enableAudio)
    document.removeEventListener('keydown', enableAudio)
})

const buttonText = computed(() => {
    if (isLoading.value) return 'Loading...'
    if (isPlaying.value) return 'Pause'

    return 'Play'
})
</script>

<template>
  <div class="playground">
    <div class="playground-main">
      <div class="canvas-wrapper">
        <canvas
          ref="cvs"
          width="256"
          height="240"
        />
        <div
          v-if="isLoading"
          class="loading-overlay"
        >
          <span>Loading...</span>
        </div>
        <div
          v-if="errorMessage"
          class="error-overlay"
        >
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <div class="controls">
        <div class="rom-selector">
          <label>Select ROM:</label>
          <select
            :value="localFileName ? 'local' : currentRom && 'file' in currentRom ? currentRom.file : ''"
            @change="(e) => { const selected = romList.find(r => r.file === (e.target as HTMLSelectElement).value); if (selected) selectPresetRom(selected) }"
          >
            <optgroup label="Built-in ROMs">
              <option
                v-for="rom in romList"
                :key="rom.file"
                :value="rom.file"
              >
                {{ rom.name }} - {{ rom.description }}
              </option>
            </optgroup>
            <optgroup
              v-if="localFileName"
              label="Local File"
            >
              <option value="local">
                {{ localFileName }}
              </option>
            </optgroup>
          </select>
          <input
            ref="fileInput"
            type="file"
            accept=".nes"
            style="display: none"
            @change="handleLocalFile"
          >
          <button
            class="upload-btn"
            @click="triggerFileInput"
          >
            Load Local ROM
          </button>
        </div>

        <div class="buttons">
          <button
            :disabled="!isReady || isLoading"
            @click="togglePlay"
          >
            {{ buttonText }}
          </button>
          <button
            :disabled="!isReady || isLoading"
            @click="reset"
          >
            Reset
          </button>
        </div>

        <div class="volume-control">
          <label>Volume: {{ volume }}%</label>
          <input
            v-model="volume"
            type="range"
            min="0"
            max="100"
            @input="updateVolume"
          >
        </div>
      </div>
    </div>

    <div class="info">
      <h3>Controls</h3>
      <div class="key-layout">
        <div class="key-group">
          <h4>D-Pad</h4>
          <div class="keys">
            <kbd>W</kbd><kbd>S</kbd><kbd>A</kbd><kbd>D</kbd>
          </div>
        </div>
        <div class="key-group">
          <h4>A / B</h4>
          <div class="keys">
            <kbd>K</kbd><kbd>J</kbd>
          </div>
        </div>
        <div class="key-group">
          <h4>Start / Select</h4>
          <div class="keys">
            <kbd>1</kbd><kbd>2</kbd>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playground {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 20px;
}

.playground-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

.canvas-wrapper {
    position: relative;
    border: 4px solid var(--vp-c-border);
    border-radius: 8px;
    background: #000;
    overflow: hidden;
}

.canvas-wrapper canvas {
    display: block;
    image-rendering: pixelated;
}

.loading-overlay,
.error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    font-size: 18px;
}

.error-overlay {
    background: rgba(139, 0, 0, 0.9);
}

.controls {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    justify-content: center;
}

.rom-selector {
    display: flex;
    align-items: center;
    gap: 8px;
}

.rom-selector label {
    color: var(--vp-c-text-1);
}

.rom-selector select {
    padding: 8px 12px;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg-elv);
    color: var(--vp-c-text-1);
    min-width: 250px;
    cursor: pointer;
}

.rom-selector select:focus {
    outline: none;
    border-color: var(--vp-c-brand-1);
}

.rom-selector .upload-btn {
    padding: 8px 16px;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg-elv);
    color: var(--vp-c-text-1);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
}

.rom-selector .upload-btn:hover {
    background: var(--vp-c-brand-soft);
    border-color: var(--vp-c-brand-1);
}

.buttons {
    display: flex;
    gap: 8px;
}

.buttons button {
    padding: 8px 20px;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg-elv);
    color: var(--vp-c-text-1);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
}

.buttons button:hover:not(:disabled) {
    background: var(--vp-c-brand-soft);
    border-color: var(--vp-c-brand-1);
}

.buttons button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.volume-control {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.volume-control label {
    color: var(--vp-c-text-1);
    font-size: 14px;
}

.volume-control input[type="range"] {
    width: 120px;
    cursor: pointer;
}

.info {
    text-align: center;
    padding: 20px;
    background: var(--vp-c-bg-soft);
    border: 1px solid var(--vp-c-border);
    border-radius: 8px;
    max-width: 500px;
}

.info h3 {
    margin: 0 0 16px 0;
    color: var(--vp-c-text-1);
}

.key-layout {
    display: flex;
    justify-content: center;
    gap: 32px;
}

.key-group h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--vp-c-text-2);
}

.keys {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
}

kbd {
    display: inline-block;
    padding: 4px 8px;
    background: var(--vp-c-bg-elv);
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    box-shadow: 0 1px 0 var(--vp-c-divider);
    font-family: monospace;
    font-size: 12px;
    color: var(--vp-c-text-1);
}
</style>
