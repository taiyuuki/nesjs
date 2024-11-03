import { CPU } from './cpu'
import { Controller } from './controller'
import { PPU } from './ppu'
import { PAPU } from './papu'
import { ROM } from './rom'
import { Cheat } from './cheat'
import type { Mapper, NESOption, NESOptionParams, Player } from './type'
import { Video } from './video'

class NES {
    fpsFrameCount = 0 // FPS counter
    frameCount = 0 // Frame counter
    romData!: string // Loaded ROM data
    break = false // Flag to break out of frame loop
    lastFpsTime = 0 // Time of last FPS calculation
    opts: NESOption = {
        onFrame: function() {},
        onAudioSample: function() {},
        onStatusUpdate: function() {},
        onBatteryRamWrite: function() {},
    
        // FIXME: not actually used except for in PAPU
        preferredFrameRate: 60,
    
        emulateSound: true,
        sampleRate: 48000, // Sound sample rate in hz
    }

    cpu: CPU
    ppu: PPU
    papu: PAPU
    mmap!: Mapper
    rom!: ROM
    cheat: Cheat
    video: Video
    crashMessage = ''
    controllers: { 1: Controller; 2: Controller }
    ui: {
        writeFrame: (frameBuffer: number[])=> void
        updateStatus: (mes: string)=> void
    }
    frameTime: number

    constructor(public opt: NESOptionParams) {
        Object.assign(this.opts, opt)

        this.frameTime = 1000 / this.opts.preferredFrameRate

        this.ui = {
            writeFrame: this.opts.onFrame,
            updateStatus: this.opts.onStatusUpdate,
        }
        this.cpu = new CPU(this)
        this.ppu = new PPU(this)
        this.papu = new PAPU(this)
        this.cheat = new Cheat(this)
        this.video = new Video(this)

        // this.mmap = null // set in loadROM()
        this.controllers = {
            1: new Controller(),
            2: new Controller(),
        }
      
        this.ui.updateStatus('Ready to load a ROM.')
      
        this.frame = this.frame.bind(this)
        this.buttonDown = this.buttonDown.bind(this)
        this.buttonUp = this.buttonUp.bind(this)
        this.zapperMove = this.zapperMove.bind(this)
        this.zapperFireDown = this.zapperFireDown.bind(this)
        this.zapperFireUp = this.zapperFireUp.bind(this)
    }

    stop() {
        this.break = true
    }

    reset() {
        if (this.mmap != null) {
            this.mmap.reset()
        }
    
        this.cpu.reset()
        this.ppu.reset()
        this.papu.reset()
        this.cheat.reset()
    
        this.lastFpsTime = 0
        this.fpsFrameCount = 0
        this.frameCount = 0
    
        this.break = false
    }

    frame() {
        this.ppu.startFrame()
        let cycles = 0
        const emulateSound = this.opts.emulateSound
        const cpu = this.cpu
        const ppu = this.ppu
        const papu = this.papu
        FRAMELOOP: for (;;) {
            if (this.break) break
            if (cpu.cyclesToHalt === 0) {

                // Execute a CPU instruction
                cycles = cpu.emulate()
                if (emulateSound) {
                    papu.clockFrameCounter(cycles)
                }
                cycles *= 3
            }
            else if (cpu.cyclesToHalt > 8) {
                cycles = 24
                if (emulateSound) {
                    papu.clockFrameCounter(8)
                }
                cpu.cyclesToHalt -= 8
            }
            else {
                cycles = cpu.cyclesToHalt * 3
                if (emulateSound) {
                    papu.clockFrameCounter(cpu.cyclesToHalt)
                }
                cpu.cyclesToHalt = 0
            }
    
            for (; cycles > 0; cycles--) {
                if (
                    ppu.curX === ppu.spr0HitX
                    && ppu.f_spVisibility === 1
                    && ppu.scanline - 21 === ppu.spr0HitY
                ) {

                    // Set sprite 0 hit flag:
                    ppu.setStatusFlag(ppu.STATUS_SPRITE0HIT, true)
                }
    
                if (ppu.requestEndFrame) {
                    ppu.nmiCounter--
                    if (ppu.nmiCounter === 0) {
                        ppu.requestEndFrame = false
                        ppu.startVBlank()
                        break FRAMELOOP
                    }
                }
    
                ppu.curX++
                if (ppu.curX === 341) {
                    ppu.curX = 0
                    ppu.endScanline()
                }
            }
        }
        this.fpsFrameCount++
        this.frameCount++
        this.cheat.frame()
        this.video.frame()
    }
    
    buttonDown(controller: Player, button: number) {
        this.controllers[controller].buttonDown(button)
    }
    
    buttonUp(controller: Player, button: number) {
        this.controllers[controller].buttonUp(button)
    }
    
    zapperMove(x: number, y: number) {
        if (!this.mmap) return
        this.mmap.zapperX = x
        this.mmap.zapperY = y
    }
    
    zapperFireDown() {
        if (!this.mmap) return
        this.mmap.zapperFired = true
    }
    
    zapperFireUp() {
        if (!this.mmap) return
        this.mmap.zapperFired = false
    }
    
    getFPS() {
        const now = +new Date()
        let fps = null
        if (this.lastFpsTime) {
            fps = this.fpsFrameCount / ((now - this.lastFpsTime) / 1000)
        }
        this.fpsFrameCount = 0
        this.lastFpsTime = now

        return fps
    }
    
    reloadROM() {
        if (this.romData != null) {
            this.loadROM(this.romData)
        }
    }
    
    // Loads a ROM file into the CPU and PPU.
    // The ROM file is validated first.
    loadROM(data: string) {

        // Load ROM file:
        this.rom = new ROM(this)
        this.rom.load(data)
    
        this.reset()
        this.mmap = this.rom.createMapper()
        this.mmap.loadROM()
        this.ppu.setMirroring(this.rom.getMirroringType())
        this.romData = data
    }
    
    setFramerate(rate: number) {
        this.opts.preferredFrameRate = rate
        this.frameTime = 1000 / rate
    }
    
    toJSON() {

        return {

            // romData: this.romData,
            frameCount: this.frameCount,
            cpu: this.cpu.toJSON(),
            mmap: this.mmap.toJSON(),
            ppu: this.ppu.toJSON(),
        }
    }
    
    fromJSON(s: ReturnType<NES['toJSON']>) {
        this.reset()

        // this.romData = s.romData;
        this.ppu.reset()
        this.cpu.fromJSON(s.cpu)
        this.mmap.fromJSON(s.mmap)
        this.ppu.fromJSON(s.ppu)
        this.frameCount = s.frameCount
    }
}

export { NES }
