<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { NES, NESControllerButton } from '@nesjs/core'
import { LocalTransport } from '../netcode/LocalTransport'
import { Lockstep } from '../netcode/lockstep'
import { MinRenderer } from '../netcode/minRenderer'

// 双人友好（双玩家）的内置 ROM
const romList = [
    { name: 'Altercation', file: '/roms/altercation-0.1.nes', description: 'Fighting · 2P' },
    { name: 'Chocoblip', file: '/roms/Chocoblip_Alpha_0.1.nes', description: 'Action · 2P' },
    { name: 'Arkade Rush', file: '/roms/arkade-rush.nes', description: 'Arcade' },
    { name: 'Spacegulls', file: '/roms/Spacegulls-1.1.nes', description: 'Action' },
    { name: 'BlobQuest', file: '/roms/BlobQuest.nes', description: 'Platformer' },
]

const currentRom = ref(romList[0])
const cvsA = ref<HTMLCanvasElement>()
const cvsB = ref<HTMLCanvasElement>()
const isPlaying = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

// 可调参数
const latencyMs = ref(0) // 模拟网络单程延迟
const frameDelay = ref(1) // 锁步帧补偿

// 诊断显示
const stats = ref({
    frameA:       0,
    frameB:       0,
    remoteFrameA: 0,
    remoteFrameB: 0,
    missA:        0,
    missB:        0,
    drift:        0,
})

// 两端实例（不经过 NESEmulator → 不绑全局键盘 → 无冲突）
let nesA: NES | null = null
let nesB: NES | null = null
let transportA: LocalTransport | null = null
let transportB: LocalTransport | null = null
let lockA: Lockstep | null = null
let lockB: Lockstep | null = null
let rafId: number | null = null
let lastTime = 0
const FRAME_DURATION = 1000 / 60.0988 // NTSC ~60.1 fps

// —— 键盘映射（两套，互不重叠） ——
// 位序见 @nesjs/core NES.getInput：A=0 B=1 SELECT=2 START=3 UP=4 DOWN=5 LEFT=6 RIGHT=7
const P1_KEYS: Record<string, number> = {
    KeyW:   NESControllerButton.UP,
    KeyS:   NESControllerButton.DOWN,
    KeyA:   NESControllerButton.LEFT,
    KeyD:   NESControllerButton.RIGHT,
    KeyJ:   NESControllerButton.B,
    KeyK:   NESControllerButton.A,
    Digit1: NESControllerButton.START,
    Digit2: NESControllerButton.SELECT,
}
const P2_KEYS: Record<string, number> = {
    ArrowUp:    NESControllerButton.UP,
    ArrowDown:  NESControllerButton.DOWN,
    ArrowLeft:  NESControllerButton.LEFT,
    ArrowRight: NESControllerButton.RIGHT,
    Numpad1:    NESControllerButton.B,
    Numpad2:    NESControllerButton.A,
    Numpad3:    NESControllerButton.START,
    Numpad4:    NESControllerButton.SELECT,
}

// 备选：无小键盘时也用主键区
const P2_KEYS_ALT: Record<string, number> = {
    ArrowUp:    NESControllerButton.UP,
    ArrowDown:  NESControllerButton.DOWN,
    ArrowLeft:  NESControllerButton.LEFT,
    ArrowRight: NESControllerButton.RIGHT,
    Period:     NESControllerButton.B,
    Slash:      NESControllerButton.A,
    Comma:      NESControllerButton.START,
    Period2:    NESControllerButton.SELECT,
}

function onKeyDown(e: KeyboardEvent) {

    // 防止方向键/空格滚动页面
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
    const gp1 = nesA?.getGamepad(1)
    const gp2 = nesA?.getGamepad(2)
    if (!gp1 || !gp2) return
    const b1 = P1_KEYS[e.code]
    if (b1 !== undefined) gp1.setButton(b1, 1)
    const b2 = P2_KEYS[e.code] ?? P2_KEYS_ALT[e.code]
    if (b2 !== undefined) gp2.setButton(b2, 1)
}
function onKeyUp(e: KeyboardEvent) {
    const gp1 = nesA?.getGamepad(1)
    const gp2 = nesA?.getGamepad(2)
    if (!gp1 || !gp2) return
    const b1 = P1_KEYS[e.code]
    if (b1 !== undefined) gp1.setButton(b1, 0)
    const b2 = P2_KEYS[e.code] ?? P2_KEYS_ALT[e.code]
    if (b2 !== undefined) gp2.setButton(b2, 0)
}

async function loadRom() {
    if (!nesA || !nesB) return
    isLoading.value = true
    errorMessage.value = null
    stopLoop()
    try {
        const res = await fetch(currentRom.value.file)
        if (!res.ok) throw new Error(`Failed to fetch ROM: ${res.status}`)
        const buf = await res.arrayBuffer()
        const romData = new Uint8Array(buf)
        await nesA.loadROM(romData)
        await nesB.loadROM(romData)
        startLoop()
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

function onRomChange(e: Event) {
    const file = (e.target as HTMLSelectElement).value
    const rom = romList.find(r => r.file === file)
    if (rom) {
        currentRom.value = rom
        loadRom()
    }
}

function buildInstances() {
    if (!cvsA.value || !cvsB.value) return

    // 端 A：本端扮演 P1（键盘左侧）→ 远端进 P2
    nesA = new NES({}, { onBeforeFrame: f => lockA?.onBeforeFrame(f) })
    nesA.setRenderer(new MinRenderer(cvsA.value, 2))

    // 端 B：本端扮演 P2（键盘右侧）→ 远端进 P1
    nesB = new NES({}, { onBeforeFrame: f => lockB?.onBeforeFrame(f) })
    nesB.setRenderer(new MinRenderer(cvsB.value, 2))

    // 配对 Transport：端 A 与端 B 互连
    transportA = new LocalTransport({ latencyMs: latencyMs.value })
    transportB = new LocalTransport({ latencyMs: latencyMs.value })
    LocalTransport.link(transportA, transportB)

    // 锁步调度器：A 是 P1，B 是 P2
    lockA = new Lockstep({ transport: transportA, emulator: adapt(nesA), localPlayer: 1, frameDelay: frameDelay.value })
    lockB = new Lockstep({ transport: transportB, emulator: adapt(nesB), localPlayer: 2, frameDelay: frameDelay.value })
}

/** NES -> LockstepEmulator 适配（用闭包绑定实例） */
function adapt(nes: NES) {
    return {
        getInput: (p: 1 | 2) => nes.getInput(p),
        setInput: (p: 1 | 2, v: number) => nes.setInput(p, v),
        get frameCount() { return nes.frameCount },
    }
}

function startLoop() {
    lockA?.start()
    lockB?.start()
    isPlaying.value = true
    lastTime = performance.now()
    rafId = requestAnimationFrame(loop)
}

function stopLoop() {
    if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
    }
    lockA?.stop()
    lockB?.stop()
    isPlaying.value = false
}

const loop = () => {
    if (!nesA || !nesB) return
    const now = performance.now()
    let delta = now - lastTime
    if (delta > 1000) { lastTime = now; delta = 0 }

    // 固定步长累加：同一循环里推进两端，保证严格同步
    while (delta >= FRAME_DURATION) {
        nesA.runFrame()
        nesB.runFrame()
        lastTime += FRAME_DURATION
        delta -= FRAME_DURATION
    }

    // 更新诊断
    if (lockA && lockB) {
        stats.value = {
            frameA:       lockA.diagnostics.localFrame,
            frameB:       lockB.diagnostics.localFrame,
            remoteFrameA: lockA.diagnostics.remoteFrame,
            remoteFrameB: lockB.diagnostics.remoteFrame,
            missA:        lockA.diagnostics.missedFrames,
            missB:        lockB.diagnostics.missedFrames,
            drift:        Math.abs(lockA.diagnostics.localFrame - lockB.diagnostics.localFrame),
        }
    }
    rafId = requestAnimationFrame(loop)
}

function togglePlay() {
    if (isPlaying.value) stopLoop()
    else startLoop()
}

function reset() {
    stopLoop()
    nesA?.reset()
    nesB?.reset()
    lockA = null
    lockB = null

    // 重建锁步（reset 后 frameCount 归位）
    if (nesA && nesB && transportA && transportB) {
        lockA = new Lockstep({ transport: transportA, emulator: adapt(nesA), localPlayer: 1, frameDelay: frameDelay.value })
        lockB = new Lockstep({ transport: transportB, emulator: adapt(nesB), localPlayer: 2, frameDelay: frameDelay.value })
    }
    startLoop()
}

function applyLatency() {
    transportA?.setLatency(latencyMs.value)
    transportB?.setLatency(latencyMs.value)
}

function applyFrameDelay() {
    lockA?.setFrameDelay(frameDelay.value)
    lockB?.setFrameDelay(frameDelay.value)
}

onMounted(async() => {
    buildInstances()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    await loadRom()
})

onBeforeUnmount(() => {
    stopLoop()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    nesA = nesB = null
})

const playButtonText = computed(() => isLoading.value ? 'Loading...' : isPlaying.value ? 'Pause' : 'Play')
</script>

<template>
  <div class="netcode">
    <div class="rom-bar">
      <label>ROM:</label>
      <select
        :value="currentRom.file"
        @change="onRomChange"
      >
        <option
          v-for="rom in romList"
          :key="rom.file"
          :value="rom.file"
        >
          {{ rom.name }} · {{ rom.description }}
        </option>
      </select>
      <button
        :disabled="isLoading"
        @click="togglePlay"
      >
        {{ playButtonText }}
      </button>
      <button
        :disabled="!isPlaying"
        @click="reset"
      >
        Reset
      </button>
    </div>

    <div class="canvases">
      <div class="canvas-cell">
        <div class="canvas-head">
          <span class="tag p1">端 A</span> 玩家1 · WASD/JK/12
        </div>
        <div class="canvas-wrapper">
          <canvas
            ref="cvsA"
            width="256"
            height="240"
          />
          <div
            v-if="isLoading"
            class="overlay"
          >
            <span>Loading...</span>
          </div>
          <div
            v-if="errorMessage"
            class="overlay error"
          >
            <span>{{ errorMessage }}</span>
          </div>
        </div>
      </div>
      <div class="arrow">
        ⇄ Transport ⇄
      </div>
      <div class="canvas-cell">
        <div class="canvas-head">
          <span class="tag p2">端 B</span> 玩家2 · ↑↓←→/Numpad
        </div>
        <div class="canvas-wrapper">
          <canvas
            ref="cvsB"
            width="256"
            height="240"
          />
        </div>
      </div>
    </div>

    <div class="sliders">
      <div class="slider">
        <label>模拟网络延迟：{{ latencyMs }} ms</label>
        <input
          v-model.number="latencyMs"
          type="range"
          min="0"
          max="120"
          step="5"
          @input="applyLatency"
        >
      </div>
      <div class="slider">
        <label>帧补偿（frameDelay）：{{ frameDelay }}</label>
        <input
          v-model.number="frameDelay"
          type="range"
          min="0"
          max="6"
          step="1"
          @input="applyFrameDelay"
        >
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="k">端A 帧</span><span class="v">{{ stats.frameA }}</span>
      </div>
      <div class="stat">
        <span class="k">端B 帧</span><span class="v">{{ stats.frameB }}</span>
      </div>
      <div class="stat">
        <span class="k">帧差</span><span
          class="v"
          :class="{ bad: stats.drift > 1 }"
        >{{ stats.drift }}</span>
      </div>
      <div class="stat">
        <span class="k">A 预测次数</span><span class="v">{{ stats.missA }}</span>
      </div>
      <div class="stat">
        <span class="k">B 预测次数</span><span class="v">{{ stats.missB }}</span>
      </div>
    </div>

    <details class="explain">
      <summary>它怎么工作？（核心机制）</summary>
      <ol>
        <li>页面上是 <b>两个独立的 NES 实例</b>，加载同一 ROM、同一初始状态 —— 确定性相同。</li>
        <li>键盘分两区：左侧键操作端A的玩家1，右侧键操作端A的玩家2。</li>
        <li>端A采集到的输入经 <code>Transport</code> 发给端B，端B在 <code>onBeforeFrame</code> 里用 <code>NES.setInput()</code> 注入到对应槽位；反向同理。</li>
        <li>两端在同一个 rAF 循环里按固定步长推进 <code>runFrame()</code>，所以帧号严格对齐。</li>
        <li>把 <code>LocalTransport</code> 换成 <code>WebRTCTransport</code>，上面的调度逻辑一字不改，就变成真正的远程联机。</li>
      </ol>
      <p class="tip">
        拖高"模拟网络延迟"滑块 → 观察帧差/预测次数上升、画面手感变迟钝；调高"帧补偿" → 用固定延迟换流畅度。这就是锁步的全部权衡。
      </p>
    </details>
  </div>
</template>

<style scoped>
.netcode {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 20px;
}
.rom-bar {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
}
.rom-bar select {
    padding: 8px 12px;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg-elv);
    color: var(--vp-c-text-1);
    min-width: 280px;
    cursor: pointer;
}
.rom-bar button {
    padding: 8px 20px;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg-elv);
    color: var(--vp-c-text-1);
    cursor: pointer;
    transition: all 0.2s;
}
.rom-bar button:hover:not(:disabled) {
    background: var(--vp-c-brand-soft);
    border-color: var(--vp-c-brand-1);
}
.rom-bar button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.canvases {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
}
.canvas-cell {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
}
.canvas-head {
    font-size: 13px;
    color: var(--vp-c-text-2);
}
.canvas-head .tag {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 3px;
    font-weight: 600;
    color: #fff;
    margin-right: 4px;
}
.tag.p1 { background: #3e8de2; }
.tag.p2 { background: #e2783e; }
.canvas-wrapper {
    position: relative;
    border: 3px solid var(--vp-c-border);
    border-radius: 8px;
    background: #000;
    overflow: hidden;
}
.canvas-wrapper canvas {
    display: block;
    image-rendering: pixelated;
}
.overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.8);
    color: #fff;
    font-size: 16px;
}
.overlay.error {
    background: rgba(139,0,0,0.9);
}
.arrow {
    font-size: 14px;
    color: var(--vp-c-text-2);
    font-weight: 600;
}
.sliders {
    display: flex;
    gap: 28px;
    flex-wrap: wrap;
    justify-content: center;
}
.slider {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 200px;
}
.slider label {
    font-size: 13px;
    color: var(--vp-c-text-2);
}
.slider input[type="range"] {
    width: 100%;
    accent-color: var(--vp-c-brand-1);
}
.stats {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    justify-content: center;
}
.stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 90px;
    padding: 8px 12px;
    border: 1px solid var(--vp-c-border);
    border-radius: 6px;
    background: var(--vp-c-bg-elv);
}
.stat .k {
    font-size: 11px;
    color: var(--vp-c-text-2);
}
.stat .v {
    font-size: 18px;
    font-weight: 700;
    color: var(--vp-c-text-1);
    font-variant-numeric: tabular-nums;
}
.stat .v.bad {
    color: var(--vp-c-danger-1);
}
.explain {
    width: 100%;
    max-width: 760px;
    padding: 12px 16px;
    border: 1px solid var(--vp-c-border);
    border-radius: 8px;
    background: var(--vp-c-bg-elv);
}
.explain summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--vp-c-text-1);
}
.explain ol {
    margin: 10px 0 6px;
    padding-left: 20px;
    color: var(--vp-c-text-2);
    line-height: 1.8;
}
.explain code {
    background: var(--vp-c-default-soft);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 0.9em;
}
.explain .tip {
    margin-top: 8px;
    padding: 8px 12px;
    border-left: 3px solid var(--vp-c-brand-1);
    background: var(--vp-c-brand-soft);
    color: var(--vp-c-text-2);
    border-radius: 0 4px 4px 0;
    font-size: 13px;
}
</style>
