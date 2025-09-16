import { describe, expect, it } from 'vitest'
import { compressArrayIfPossible, decompressArray } from '../src/core/utils'

// 生成测试数据
function generateTestData() {
    return {

        // NES典型场景：大量零值（RAM初始状态）
        emptyRAM: new Array(2048).fill(0),
        
        // PPU背景数据：重复的瓦片ID
        backgroundTiles: new Array(1024).fill(0)
            .map((_, i) => i < 100 ? 0 : i < 200 ? 1 : i < 300 ? 2 : 0),
        
        // 调色板数据：少量重复值
        palette: [0x0F, 0x00, 0x10, 0x20, 0x0F, 0x06, 0x16, 0x26, 0x0F, 0x09, 0x19, 0x29, 0x0F, 0x01, 0x11, 0x21],
        
        // 音频缓冲区：高频重复模式
        audioPattern: Array.from({ length: 1000 }, (_, i) => 
            i % 10 < 3 ? 128 : i % 10 < 6 ? 64 : 192),
        
        // 存档状态：大量重复+少量变化
        saveState: new Array(8192).fill(0)
            .concat(
                Array.from({ length: 256 }, (_, i) => i % 16),
                new Array(1024).fill(255),
            ),
        
        // 完全随机数据（最坏情况）
        randomData: Array.from({ length: 500 }, () => Math.floor(Math.random() * 256)),
        
        // 混合模式：重复块+非重复块
        mixedPattern: ([] as number[]).concat(
            new Array(100).fill(42),
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
            new Array(80).fill(128),
            [255, 254, 253, 252, 251],
            new Array(60).fill(0),
        ),
    }
}

describe('RLE Compression Tests', () => {
    const testData = generateTestData()

    for (const [name, data] of Object.entries(testData)) {
        it(`should compress and decompress ${name} correctly`, () => {
            const compressed = compressArrayIfPossible(data)
            const decompressed = decompressArray(compressed)
            expect(decompressed).toEqual(data)

            if (Array.isArray(compressed)) {
                expect(compressed).toEqual(data) // 没有压缩
            }
            else{
                expect(compressed._data.length).toBeLessThan(data.length)
            }
        })
    }  
})
