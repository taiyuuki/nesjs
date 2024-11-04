import { expect, it } from 'vitest'
import { compressArray, decompressArray } from '../src/utils'

it('compressArray', () => {
    const arr = []
    for (let i = 0; i < 5000; i++) {
        arr.push(Math.floor(Math.random() * 255))
    }
    const compressed = compressArray(arr)
    const decompressed = decompressArray(compressed)
    expect(decompressed).toStrictEqual(arr)
})
