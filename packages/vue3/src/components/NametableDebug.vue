<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

// 定义props
const props = defineProps<{
    nesRef:  any
    enabled: boolean
}>()

const emit = defineEmits<{ close: [] }>()

// 响应式数据
const testResult = ref('')
const nameTableData = reactive({
    nt0:       [],
    nt1:       [],
    nt2:       [],
    nt3:       [],
    exram:     [],
    chrregsA:  [],
    chrregsB:  [],
    chrMode:   '',
    prgMode:   '',
    exramMode: '',
})

// Canvas引用
const nt0Canvas = ref<HTMLCanvasElement | null>(null)
const nt1Canvas = ref<HTMLCanvasElement | null>(null)
const nt2Canvas = ref<HTMLCanvasElement | null>(null)
const nt3Canvas = ref<HTMLCanvasElement | null>(null)
const exramCanvas = ref<HTMLCanvasElement | null>(null)

// 渲染nametable到canvas
const renderNametableCanvas = (canvas: HTMLCanvasElement | null, nametable: number[]) => {
    if (!canvas || !nametable || nametable.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.createImageData(256, 240)

    for (let i = 0; i < 960; i++) { // 只渲染nametable部分，不包括attribute
        const tileIndex = nametable[i]
        const paletteIndex = i % 4
        const [r, g, b] = hslToRgb(tileIndex * 137.5 % 360, 0.7, 0.5 + paletteIndex * 0.1)

        const tileX = i % 32 * 8
        const tileY = Math.floor(i / 32) * 8

        for (let py = 0; py < 8; py++) {
            for (let px = 0; px < 8; px++) {
                const pixelIndex = ((tileY + py) * 256 + (tileX + px)) * 4
                imageData.data[pixelIndex] = r
                imageData.data[pixelIndex + 1] = g
                imageData.data[pixelIndex + 2] = b
                imageData.data[pixelIndex + 3] = 255
            }
        }
    }

    ctx.putImageData(imageData, 0, 0)
}

// HSL到RGB转换
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    h = h / 360
    let r, 
        g, 
        b

    if (s === 0) {
        r = g = b = l
    }
    else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1
            if (t > 1) t -= 1
            if (t < 1 / 6) return p + (q - p) * 6 * t
            if (t < 1 / 2) return q
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6

            return p
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = hue2rgb(p, q, h + 1 / 3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1 / 3)
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

// 复制Nametable数据
const copyNametableData = () => {
    try {
        const nes = props.nesRef.getNESInstance() as any
        if (!nes) {
            testResult.value = 'NES实例未获取'

            return
        }

        const mapper = nes.mapper
        if (!mapper) {
            testResult.value = 'Mapper实例未找到'

            return
        }

        let result = 'Nametable数据 (16x16格式):\n\n'

        for (let i = 0; i < 4; i++) {
            const ntName = ['nt0', 'nt1', 'nt2', 'nt3'][i]
            const ntData = mapper[ntName] || []

            result += `${ntName.toUpperCase()} ($${(0x2000 + i * 0x400).toString(16).toUpperCase()}):\n`

            // 16x16格式
            for (let row = 0; row < 30; row++) {
                const start = row * 32
                const rowValues = ntData.slice(start, start + 32)
                result += `${rowValues.map((v: number) => v.toString(16).padStart(2, '0')
                    .toUpperCase()).join(' ')}\n`
            }
            result += '\n'
        }

        // 复制到剪贴板
        navigator.clipboard.writeText(result).then(() => {
            testResult.value = 'Nametable数据已复制到剪贴板'
        })
            .catch(() => {
                testResult.value = '复制失败，请手动复制控制台输出'
                console.log(result)
            })
    }
    catch(error) {
        console.error('复制nametable数据失败:', error)
        testResult.value = '复制失败'
    }
}

// 复制Attribute数据
const copyAttributeData = () => {
    try {
        const nes = props.nesRef.getNESInstance() as any
        if (!nes) {
            testResult.value = 'NES实例未获取'

            return
        }

        const mapper = nes.mapper
        if (!mapper) {
            testResult.value = 'Mapper实例未找到'

            return
        }

        let result = 'Attribute数据 (16x16格式):\n\n'

        for (let i = 0; i < 4; i++) {
            const ntName = ['nt0', 'nt1', 'nt2', 'nt3'][i]
            const ntData = mapper[ntName] || []
            const attrData = ntData.slice(960, 1024) // 每个nametable最后的64字节是attribute

            result += `${ntName.toUpperCase()} Attribute ($${(0x23C0 + i * 0x40).toString(16).toUpperCase()}-$${(0x23FF + i * 0x40).toString(16).toUpperCase()}):\n`

            // 16x16格式 (每行16字节)
            for (let row = 0; row < 4; row++) {
                const start = row * 16
                const rowValues = attrData.slice(start, start + 16)
                result += `${rowValues.map((v: number) => v.toString(16).padStart(2, '0')
                    .toUpperCase()).join(' ')}\n`
            }
            result += '\n'
        }

        // 复制到剪贴板
        navigator.clipboard.writeText(result).then(() => {
            testResult.value = 'Attribute数据已复制到剪贴板'
        })
            .catch(() => {
                testResult.value = '复制失败，请手动复制控制台输出'
                console.log(result)
            })
    }
    catch(error) {
        console.error('复制attribute数据失败:', error)
        testResult.value = '复制失败'
    }
}

// 更新调试数据
const updateDebugData = () => {
    if (!props.enabled || !props.nesRef?.getNESInstance) return

    try {
        const nes = props.nesRef.getNESInstance() as any
        if (!nes || !nes.mapper) return

        const mapper = nes.mapper

        // 更新nametable数据
        nameTableData.nt0 = mapper.nt0 || []
        nameTableData.nt1 = mapper.nt1 || []
        nameTableData.nt2 = mapper.nt2 || []
        nameTableData.nt3 = mapper.nt3 || []
        nameTableData.exram = mapper.exram || []

        // 更新MMC5状态
        nameTableData.chrregsA = mapper.chrregsA || []
        nameTableData.chrregsB = mapper.chrregsB || []
        nameTableData.chrMode = mapper.chrMode?.toString() || ''
        nameTableData.prgMode = mapper.prgMode?.toString() || ''
        nameTableData.exramMode = mapper.exramMode?.toString() || ''

        nextTick(() => {
            renderNametableCanvas(nt0Canvas.value, nameTableData.nt0)
            renderNametableCanvas(nt1Canvas.value, nameTableData.nt1)
            renderNametableCanvas(nt2Canvas.value, nameTableData.nt2)
            renderNametableCanvas(nt3Canvas.value, nameTableData.nt3)

            // 渲染EXRAM
            if (exramCanvas.value && nameTableData.exram.length > 0) {
                const ctx = exramCanvas.value.getContext('2d')
                if (ctx) {
                    const imageData = ctx.createImageData(128, 128)
                    for (let i = 0; i < Math.min(16384, nameTableData.exram.length); i++) {
                        const value = nameTableData.exram[i]
                        const x = i % 128
                        const y = Math.floor(i / 128)
                        const [r, g, b] = hslToRgb(value * 2 % 360, 0.8, 0.5)
                        const pixelIndex = (y * 128 + x) * 4
                        imageData.data[pixelIndex] = r
                        imageData.data[pixelIndex + 1] = g
                        imageData.data[pixelIndex + 2] = b
                        imageData.data[pixelIndex + 3] = 255
                    }
                    ctx.putImageData(imageData, 0, 0)
                }
            }
        })
    }
    catch(error) {
        console.error('更新调试数据失败:', error)
    }
}

// 监听enabled状态
watch(() => props.enabled, newVal => {
    if (newVal) {
        updateDebugData()
        const interval = setInterval(updateDebugData, 1000)

        onUnmounted(() => {
            clearInterval(interval)
        })
    }
})

// 组件挂载后开始更新
onMounted(() => {
    if (props.enabled) {
        updateDebugData()
        const interval = setInterval(updateDebugData, 1000)

        onUnmounted(() => {
            clearInterval(interval)
        })
    }
})
</script>

<template>
  <div
    v-if="enabled"
    class="nametable-debug-panel"
  >
    <div class="panel-header">
      <h3>Nametable 调试面板</h3>
      <button
        class="close-btn"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <div class="mmc5-info">
      <h4>Mapper状态</h4>
      <div class="mapper-info">
        <div class="info-row">
          <span>CHR模式:</span>
          <span>{{ nameTableData.chrMode || '未知' }}</span>
        </div>
        <div class="info-row">
          <span>PRG模式:</span>
          <span>{{ nameTableData.prgMode || '未知' }}</span>
        </div>
        <div class="info-row">
          <span>EXRAM模式:</span>
          <span>{{ nameTableData.exramMode || '未知' }}</span>
        </div>
        <div class="chr-registers">
          <strong>CHR寄存器:</strong>
          <div class="reg-row">
            <span>chrregsA:</span>
            <span>{{ (nameTableData.chrregsA || []).map((v: number) => '$' + v.toString(16).padStart(2, '0').toUpperCase()).join(' ') }}</span>
          </div>
          <div class="reg-row">
            <span>chrregsB:</span>
            <span>{{ (nameTableData.chrregsB || []).map((v: number) => '$' + v.toString(16).padStart(2, '0').toUpperCase()).join(' ') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 调试控制 -->
    <div class="test-section">
      <strong>🔧 调试</strong>
      <div class="bank-test">
        <button
          class="nes-btn"
          style="margin-left: 10px; background: #34495e; color: white;"
          @click="copyNametableData"
        >
          📋 复制Nametable
        </button>
        <button
          class="nes-btn"
          style="margin-left: 10px; background: #2c3e50; color: white;"
          @click="copyAttributeData"
        >
          📋 复制Attribute
        </button>
      </div>
    </div>

    <!-- Nametables显示 -->
    <div class="nametables-section">
      <h4>Nametables</h4>
      <div class="nametables-grid">
        <div class="nametable-item">
          <strong>Nametable 0 ($2000)</strong>
          <canvas
            ref="nt0Canvas"
            width="256"
            height="240"
            class="nametable-canvas"
          />
        </div>
        <div class="nametable-item">
          <strong>Nametable 1 ($2400)</strong>
          <canvas
            ref="nt1Canvas"
            width="256"
            height="240"
            class="nametable-canvas"
          />
        </div>
        <div class="nametable-item">
          <strong>Nametable 2 ($2800)</strong>
          <canvas
            ref="nt2Canvas"
            width="256"
            height="240"
            class="nametable-canvas"
          />
        </div>
        <div class="nametable-item">
          <strong>Nametable 3 ($2C00)</strong>
          <canvas
            ref="nt3Canvas"
            width="256"
            height="240"
            class="nametable-canvas"
          />
        </div>
      </div>
    </div>

    <!-- EXRAM显示 -->
    <div
      v-if="nameTableData.exram"
      class="exram-section"
    >
      <h4>EXRAM ($5C00)</h4>
      <canvas
        ref="exramCanvas"
        width="128"
        height="128"
        class="exram-canvas"
      />
    </div>
  </div>
</template>

<style scoped>
.nametable-debug-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    width: 400px;
    max-height: 90vh;
    background: white;
    color: black;
    border: 2px solid #333;
    border-radius: 8px;
    padding: 16px;
    font-family: 'Courier New', monospace;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #333;
}

.panel-header h3 {
    margin: 0;
    color: #333;
    font-size: 18px;
}

.close-btn {
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-btn:hover {
    background: #c82333;
}

.mmc5-info, .test-section, .nametables-section, .exram-section {
    margin-bottom: 20px;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 12px;
    background: #f8f9fa;
}

.mmc5-info h4, .test-section strong, .nametables-section h4, .exram-section h4 {
    margin: 0 0 10px 0;
    color: #333;
    font-size: 16px;
    border-bottom: 1px solid #ddd;
    padding-bottom: 5px;
}

.mapper-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
    font-size: 14px;
}

.info-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    background: white;
    border-radius: 4px;
}

.chr-registers {
    grid-column: 1 / -1;
    margin-top: 8px;
}

.reg-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    background: white;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
}

.bank-test {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: flex-start;
}

.nes-btn {
    padding: 8px 16px;
    border: 2px solid #333;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: bold;
    text-decoration: none;
    transition: all 0.2s;
}

.nes-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.test-result {
    grid-column: 1 / -1;
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 12px;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    white-space: pre-wrap;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #444;
    margin-top: 10px;
}

.test-result.found {
    background: #0a3d0a;
    color: #90ee90;
    border-color: #28a745;
}

.nametables-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
}

.nametable-item {
    text-align: center;
}

.nametable-item strong {
    display: block;
    margin-bottom: 8px;
    color: #333;
    font-size: 14px;
}

.nametable-canvas {
    border: 2px solid #333;
    border-radius: 4px;
    background: white;
    width: 100%;
    max-width: 256px;
    height: auto;
    image-rendering: pixelated;
}

.exram-canvas {
    border: 2px solid #333;
    border-radius: 4px;
    background: white;
    image-rendering: pixelated;
    margin: 8px auto;
    display: block;
}

@media (max-width: 1200px) {
    .nametable-debug-panel {
        width: 350px;
        right: 5px;
        top: 5px;
    }
}

@media (max-width: 768px) {
    .nametable-debug-panel {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
        max-height: 80vh;
        border-radius: 0;
        border: none;
        border-bottom: 2px solid #333;
    }

    .nametables-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .bank-test {
        flex-direction: column;
    }

    .nes-btn {
        width: 100%;
        text-align: center;
    }
}
</style>
