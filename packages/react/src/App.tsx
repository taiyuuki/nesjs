import React, { useRef, useState } from 'react'
import type { NESComponentExpose } from './types'
import { NESEmulatorReact } from './components/NESReact'

export default function App() {

    const nesRef = useRef<NESComponentExpose>(null)
    const [romUrl, setRomUrl] = useState<Blob | string>('Super Mario Bros (JU).nes')

    const [emulatorConfig] = useState({
        scale: 3,
        smoothing: false,
        clip8px: false,
        audioBufferSize: 1024,
        audioSampleRate: 44100,
    })

    const isPlaying = nesRef.current?.isPlaying ?? false

    const togglePlay = async() => {
        await nesRef.current?.togglePlay()
    }

    const reset = () => {
        nesRef.current?.reset()
    }

    const screenshot = () => {
        nesRef.current?.screenshot(true) // true = 自动下载
    }

    const downloadSave = () => {
        nesRef.current?.downloadSaveState()
    }

    const selectROM = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) setRomUrl(file)
    }

    const getROMInfo = () => {
        const info = nesRef.current?.getROMInfo()
        console.log('ROM Info:', info)
    }

    /* --------------- JSX 渲染 --------------- */
    return (
        <div className="nes-container">
            <div className="nes-emulator">
                <NESEmulatorReact
                    ref={nesRef}
                    rom={romUrl}
                    volume={100}
                    autoStart
                    emulatorConfig={emulatorConfig}
                    onLoaded={getROMInfo}
                />
            </div>

            <div className="controls">
                <input type="file" accept=".nes,.nsf" onChange={selectROM} />
                <button onClick={togglePlay}>{isPlaying ? '暂停' : '开始'}</button>
                <button onClick={reset}>重置</button>
                <button onClick={screenshot}>截图</button>
                <button onClick={downloadSave}>下载存档</button>
            </div>

            <style>{`
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
      `}</style>
        </div>
    )
}
