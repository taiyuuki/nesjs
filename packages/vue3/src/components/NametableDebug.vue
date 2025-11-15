<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

// 定义props
const props = defineProps<{
    nesRef: any
    enabled: boolean
}>()

// 响应式数据
const testResult = ref('')
const nameTableData = reactive({
    nt0: [],
    nt1: [],
    nt2: [],
    nt3: [],
    exram: [],
    chrregsA: [],
    chrregsB: [],
    chrMode: '',
    prgMode: '',
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

// CHR数据调试
const debugCHRData = () => {
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

        let result = 'CHR Bank 数据调试:\n\n'

        // 显示当前chrmapB的值
        if (mapper.chrmapB) {
            result += '当前chrmapB前4个bank的地址:\n'
            for (let i = 0; i < 4; i++) {
                result += `  Bank ${i}: 0x${mapper.chrmapB[i].toString(16).padStart(4, '0')
                    .toUpperCase()}\n`
            }
            result += '\n'
        }

        // 显示chrregsB的值
        if (mapper.chrregsB) {
            result += '当前chrregsB寄存器值:\n'
            for (let i = 0; i < 4; i++) {
                result += `  chrregsB[${i}]: 0x${mapper.chrregsB[i].toString(16).toUpperCase()}\n`
            }
            result += '\n'
        }

        // 显示Bank 10和Bank 0的前64字节数据对比
        if (mapper.chr && mapper.chrmapB) {
            const bank10Start = 0xA * 0x1000 // Bank 10的起始地址
            const bank0Start = 0x0 * 0x1000 // Bank 0的起始地址

            result += 'Bank 10 (0xA) 前64字节数据:\n'
            for (let row = 0; row < 4; row++) {
                const start = bank10Start + row * 16
                const rowValues = []
                for (let col = 0; col < 16; col++) {
                    rowValues.push(mapper.chr[start + col]?.toString(16).padStart(2, '0')
                        .toUpperCase() || '00')
                }
                result += `  ${rowValues.join(' ')}\n`
            }

            result += '\nBank 0 (0x0) 前64字节数据:\n'
            for (let row = 0; row < 4; row++) {
                const start = bank0Start + row * 16
                const rowValues = []
                for (let col = 0; col < 16; col++) {
                    rowValues.push(mapper.chr[start + col]?.toString(16).padStart(2, '0')
                        .toUpperCase() || '00')
                }
                result += `  ${rowValues.join(' ')}\n`
            }

            // 显示当前映射的Bank前64字节
            const currentBankStart = mapper.chrmapB[0] || 0
            result += `\n当前映射Bank (${(currentBankStart / 0x1000).toFixed(0)}) 前64字节数据:\n`
            for (let row = 0; row < 4; row++) {
                const start = currentBankStart + row * 16
                const rowValues = []
                for (let col = 0; col < 16; col++) {
                    rowValues.push(mapper.chr[start + col]?.toString(16).padStart(2, '0')
                        .toUpperCase() || '00')
                }
                result += `  ${rowValues.join(' ')}\n`
            }
        }

        console.log(result)
        testResult.value = 'CHR数据已输出到控制台'

        // 复制到剪贴板
        navigator.clipboard.writeText(result).then(() => {
            testResult.value = 'CHR数据已复制到剪贴板'
        })
            .catch(() => {
                testResult.value = '数据已输出到控制台'
            })
    }
    catch(error) {
        console.error('CHR数据调试失败:', error)
        testResult.value = '调试失败'
    }
}

// 查找正确的Bank
const findCorrectBank = () => {
    try {
        const nes = props.nesRef.getNESInstance() as any
        if (!nes) {
            testResult.value = 'NES实例未获取'

            return
        }

        const mapper = nes.mapper
        if (!mapper || !mapper.chr) {
            testResult.value = 'Mapper或CHR数据未找到'

            return
        }

        // FCEUX中$0000-$000F的数据
        const fceuxPattern = [0x00, 0x00, 0x00, 0x00, 0x03, 0x07, 0x0F, 0x0F, 0x00, 0x00, 0x00, 0x00, 0x03, 0x07, 0x0F, 0x0F]

        let result = '🎯 搜索与FCEUX数据匹配的Bank:\n\n'
        result += `目标模式 (FCEUX $0000-$000F): ${fceuxPattern.map(v => `0x${v.toString(16).padStart(2, '0')
            .toUpperCase()}`).join(' ')}\n\n`

        const matches = []

        // 搜索所有可能的bank (0-31)
        for (let bank = 0; bank < 32; bank++) {
            const bankStart = bank * 0x1000

            // 检查bank是否在CHR范围内
            if (bankStart + 16 >= mapper.chr.length) continue

            // 检查前16字节是否匹配
            let matchesPattern = true
            for (let i = 0; i < 16; i++) {
                if (mapper.chr[bankStart + i] !== fceuxPattern[i]) {
                    matchesPattern = false
                    break
                }
            }

            if (matchesPattern) {
                matches.push({
                    bank: bank,
                    address: bankStart,
                    hex: bankStart.toString(16).padStart(4, '0')
                        .toUpperCase(),
                })
            }
        }

        if (matches.length > 0) {
            result += `✅ 找到 ${matches.length} 个匹配的Bank:\n\n`
            for (const match of matches) {
                result += `Bank ${match.bank} (地址 0x${match.hex})\n`
            }

            // 如果找到了匹配的bank，提供修复建议
            const targetBank = matches[0].bank
            result += '\n🔧 修复建议:\n'
            result += `将 chrregsB[3] 设置为 0x${targetBank.toString(16).toUpperCase()}\n`
            result += `在 setupCHR 函数中使用: this.setppubankB(4, 0, ${targetBank})`

        }
        else {
            result += '❌ 没有找到完全匹配的Bank\n\n'

            // 搜索部分匹配
            result += '搜索部分匹配 (前8字节):\n'
            const partialMatches = []

            for (let bank = 0; bank < 32; bank++) {
                const bankStart = bank * 0x1000
                if (bankStart + 8 >= mapper.chr.length) continue

                let matchesPattern = true
                for (let i = 0; i < 8; i++) {
                    if (mapper.chr[bankStart + i] !== fceuxPattern[i]) {
                        matchesPattern = false
                        break
                    }
                }

                if (matchesPattern) {
                    partialMatches.push({
                        bank: bank,
                        address: bankStart,
                        hex: bankStart.toString(16).padStart(4, '0')
                            .toUpperCase(),
                    })
                }
            }

            if (partialMatches.length > 0) {
                result += `找到 ${partialMatches.length} 个部分匹配:\n`
                for (const match of partialMatches.slice(0, 5)) {
                    result += `Bank ${match.bank} (0x${match.hex})\n`
                }
            }
            else {
                result += '没有找到部分匹配\n\n'

                // 显示当前映射bank的数据作为对比
                const currentBankStart = mapper.chrmapB?.[0] || 0
                const currentBank = Math.floor(currentBankStart / 0x1000)
                result += `当前映射Bank ${currentBank} 的前16字节:\n`
                const currentData = []
                for (let i = 0; i < 16; i++) {
                    if (currentBankStart + i < mapper.chr.length) {
                        currentData.push(mapper.chr[currentBankStart + i].toString(16).padStart(2, '0')
                            .toUpperCase())
                    }
                    else {
                        currentData.push('00')
                    }
                }
                result += `${currentData.join(' ')}\n`
            }
        }

        console.log(result)
        testResult.value = matches.length > 0 ? `找到 ${matches.length} 个匹配的Bank!` : '未找到匹配Bank'

        // 复制到剪贴板
        navigator.clipboard.writeText(result).then(() => {
            testResult.value += ' (已复制到剪贴板)'
        })
            .catch(() => {

            // 静默失败
            })
    }
    catch(error) {
        console.error('查找Bank失败:', error)
        testResult.value = '查找失败'
    }
}

// MMC5状态调试
const debugMMC5State = () => {
    try {
        if (!props.nesRef?.getNESInstance) {
            testResult.value = 'NES实例获取方法不可用'

            return
        }

        const nes = props.nesRef.getNESInstance() as any
        if (!nes) {
            testResult.value = 'NES实例未获取'

            return
        }

        const mapper = nes.mapper || {}
        const chrregsB = mapper.chrregsB || []
        const chrregsA = mapper.chrregsA || []
        const chrMode = mapper.chrMode || '未知'

        // 输出关键信息，减少日志量
        console.log('MMC5状态:', {
            chrMode,
            chrregsB3: `0x${chrregsB[3]?.toString(16) || 'undefined'} (${chrregsB[3] || 'undefined'})`,
            chrregsA7: `0x${chrregsA[7]?.toString(16) || 'undefined'} (${chrregsA[7] || 'undefined'})`,
            chrregsB: chrregsB.slice(0, 8).map((v: number, i: number) => `[${i}]:0x${v?.toString(16) || 'undefined'}(${v || 'undefined'})`).join(' '),
            chrregsA: chrregsA.slice(0, 8).map((v: number, i: number) => `[${i}]:0x${v?.toString(16) || 'undefined'}(${v || 'undefined'})`).join(' ')
        })

        testResult.value = `MMC5: CHR模式=${chrMode}, chrregsB[3]=0x${chrregsB[3]?.toString(16) || 'undefined'}(${chrregsB[3] || 'undefined'}), chrregsA[7]=0x${chrregsA[7]?.toString(16) || 'undefined'}(${chrregsA[7] || 'undefined'})`
    }
    catch(error) {
        console.error('MMC5状态调试失败:', error)
        testResult.value = 'MMC5状态调试失败'
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
      >
        ✕
      </button>
    </div>

    <!-- MMC5状态信息 -->
    <div class="mmc5-info">
      <h4>MMC5 Mapper状态</h4>
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
      <strong>🔧 MMC5调试</strong>
      <div class="bank-test">
        <button
          class="nes-btn is-primary"
          style="margin-left: 0px; background: #4a90e2; color: white;"
          @click="debugMMC5State"
        >
          🔍 MMC5状态
        </button>
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
        <button
          class="nes-btn"
          style="margin-left: 10px; background: #8e44ad; color: white;"
          @click="debugCHRData"
        >
          🔍 CHR数据
        </button>
        <button
          class="nes-btn"
          style="margin-left: 10px; background: #e74c3c; color: white;"
          @click="findCorrectBank"
        >
          🎯 查找正确Bank
        </button>
        <pre
          v-if="testResult"
          class="test-result"
          :class="{ found: testResult.includes('找到匹配') }"
        >{{ testResult }}</pre>
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
