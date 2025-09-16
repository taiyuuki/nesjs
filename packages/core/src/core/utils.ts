
/**
 * 工具函数：使用游程编码压缩数组数据
 */
function compressArrayIfPossible(value: any): any {
    if (!value || value.length === 0) return value
    
    // 对于较大的数组，尝试游程编码压缩
    if (value.length > 64) {
        const rleCompressed = runLengthEncode(value)
        
        // 更准确地计算压缩后的大小
        const originalSize = value.length
        const compressedSize = rleCompressed.length
        
        if (compressedSize < originalSize * 0.75) {
            return { 
                _compressed: 'rle', 
                _originalLength: originalSize,
                _data: rleCompressed,
            }
        }
    }
    
    // 压缩效果不佳，返回原数组
    return value instanceof Uint8Array ? Array.from(value) : [...value]
}

/**
 * 混合游程编码实现（优化版）
 * 使用标记位区分重复序列和非重复序列：
 * - 如果首位为负数：表示接下来的abs(value)个数字是非重复的原始数据
 * - 如果首位为正数：表示传统RLE格式 [value, count]
 * @param data 原始数据数组
 * @returns 优化后的编码数组
 */
function runLengthEncode(data: number[]): number[] {
    if (data.length === 0) return []
    
    const result: number[] = []
    let i = 0
    
    while (i < data.length) {
        const currentValue = data[i]
        let runLength = 1
        
        // 计算当前值的连续重复次数
        while (i + runLength < data.length 
            && data[i + runLength] === currentValue 
            && runLength < 255) {
            runLength++
        }
        
        if (runLength >= 3) {
            
            // 重复次数>=3时使用RLE编码 [value, count]
            result.push(currentValue, runLength)
            i += runLength
        } 
        else {
            
            // 收集连续的非重复项
            const nonRepeatStart = i
            while (i < data.length) {
                const value = data[i]
                let nextRunLength = 1
                
                // 检查从当前位置开始的重复长度
                while (i + nextRunLength < data.length 
                    && data[i + nextRunLength] === value 
                    && nextRunLength < 3) {
                    nextRunLength++
                }
                
                if (nextRunLength >= 3) {
                    
                    // 遇到长重复序列，停止收集非重复项
                    break
                }
                
                i += nextRunLength
                
                // 限制非重复序列长度，避免标记位溢出
                if (i - nonRepeatStart >= 127) {
                    break
                }
            }
            
            const nonRepeatLength = i - nonRepeatStart
            
            // 使用负数标记非重复序列长度
            result.push(-nonRepeatLength)
            
            // 添加原始数据
            for (let j = nonRepeatStart; j < i; j++) {
                result.push(data[j])
            }
        }
    }
    
    return result
}

/**
 * 解压缩数组数据
 */
function decompressArray(compressed: any): any {
    if (compressed._compressed === 'rle') {
        return runLengthDecode(compressed._data, compressed._originalLength)
    }
    
    switch (compressed._compressed) {
        case 'zero':
            return new Array(compressed._length).fill(0)
            
        case 'repeat':
            return new Array(compressed._length).fill(compressed._value)
            
        case 'sparse': {
            const result = new Array(compressed._length).fill(0)
            for (const [index, val] of Object.entries(compressed._data)) {
                result[Number.parseInt(index)] = val as number
            }

            return result
        }
            
        default:
            return compressed
    }
}

/**
 * 混合游程解码实现
 * @param rleData 编码后的数据
 * @param originalLength 原始数组长度（用于验证）
 * @returns 解码后的原始数组
 */
function runLengthDecode(rleData: number[], originalLength: number): number[] {
    const result: number[] = []
    let i = 0
    
    while (i < rleData.length) {
        const marker = rleData[i]
        
        if (marker < 0) {
            
            // 负数标记：后面跟着非重复的原始数据
            const count = Math.abs(marker)
            for (let j = 0; j < count; j++) {
                result.push(rleData[i + 1 + j])
            }
            i += count + 1
        } 
        else {
            
            // 正数：传统RLE格式 [value, count]
            const value = marker
            const count = rleData[i + 1]
            for (let j = 0; j < count; j++) {
                result.push(value)
            }
            i += 2
        }
    }
    
    // 验证解码后的长度是否正确
    if (result.length !== originalLength) {
        console.warn(`RLE decode length mismatch: expected ${originalLength}, got ${result.length}`)
    }
    
    return result
}

export {
    compressArrayIfPossible,
    decompressArray,
}
