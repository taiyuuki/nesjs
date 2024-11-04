import type { NES } from '@nesjs/core'
import { fiilArray, obejctKeys } from './utils'

type Player = 1 | 2

class NESGamepad {
    static KEYS_INDEX = {
        A: 0,
        B: 1,
        SELECT: 2,
        START: 3,
        UP: 4,
        DOWN: 5,
        LEFT: 6,
        RIGHT: 7,
        C: 8,
        D: 9,
    }
    
    private _p1 = {
        UP: 'KeyW',
        DOWN: 'KeyS',
        LEFT: 'KeyA',
        RIGHT: 'KeyD',
        A: 'KeyK',
        B: 'KeyJ',
        C: 'KeyI',
        D: 'KeyU',
        SELECT: 'Digit2',
        START: 'Digit1',
    }
    private _p2 = {
        UP: 'ArrowUp',
        DOWN: 'ArrowDown',
        LEFT: 'ArrowLeft',
        RIGHT: 'ArrowRight',
        A: 'Numpad2',
        B: 'Numpad1',
        C: 'Numpad5',
        D: 'Numpad4',
        SELECT: 'NumpadDecimal',
        START: 'NumpadEnter',
    }

    private _eventKeys: Record<string, [Player, number][]>

    private _nes: NES

    private _auto: Record<Player, Record<number, {
        timeout: number
        beDown: boolean
        once: boolean
    }>> = {
            1: {
                8: {
                    timeout: 0,
                    beDown: false,
                    once: true,
                },
                9: {
                    timeout: 0,
                    beDown: false,
                    once: true,
                },
            },
            2: {
                8: {
                    timeout: 0,
                    beDown: false,
                    once: true,
                },
                9: {
                    timeout: 0,
                    beDown: false,
                    once: true,
                },
            },
        }

    interval = 1000 / 16
    animationFrameId: number | null = null
    threshold = 0.3
    axesHolding: Record<Player, boolean[]> = { 1: fiilArray(20, false), 2: fiilArray(20, false) }
    btnHolding: Record<Player, boolean[]> = { 1: fiilArray(4, false), 2: fiilArray(4, false) }
    gamepadButtons = [
        NESGamepad.KEYS_INDEX.A,
        NESGamepad.KEYS_INDEX.C,
        NESGamepad.KEYS_INDEX.B,
        NESGamepad.KEYS_INDEX.D,
        -1,
        -1,
        -1,
        -1,
        NESGamepad.KEYS_INDEX.SELECT,
        NESGamepad.KEYS_INDEX.START,
        -1,
        -1,
        NESGamepad.KEYS_INDEX.UP,
        NESGamepad.KEYS_INDEX.DOWN,
        NESGamepad.KEYS_INDEX.LEFT,
        NESGamepad.KEYS_INDEX.RIGHT,
    ]
    enableGamepad = false

    constructor(nes: NES) {
        window.addEventListener('gamepadconnected', this.connectGamepadHandler.bind(this, true))
        window.addEventListener('gamepaddisconnected', this.connectGamepadHandler.bind(this, false))
        this._nes = nes
        this._eventKeys = {}
        this.setEventKeys()
        this.keyUpEvent = this.keyUpEvent.bind(this)
        this.keyDownEvent = this.keyDownEvent.bind(this)
        this.runGamepad = this.runGamepad.bind(this)
        this.gamepadFrame = this.gamepadFrame.bind(this)
    }

    get gamepads() {
        return navigator.getGamepads().filter(Boolean) as Gamepad[]
    }

    setEventKeys() {
        this._eventKeys = {}
        obejctKeys(NESGamepad.KEYS_INDEX).forEach(key => {
            const i = NESGamepad.KEYS_INDEX[key]

            let code = this._p1[key]
            if (!this._eventKeys[code]) {
                this._eventKeys[code] = []
            }
            this._eventKeys[code].push([1, i])

            code = this._p2[key]
            if (!this._eventKeys[code]) {
                this._eventKeys[code] = []
            }
            this._eventKeys[code].push([2, i])
        })
    }

    set p1(value: Partial<Record<keyof typeof NESGamepad.KEYS_INDEX, string>>) {
        Object.assign(this._p1, value)
        this.setEventKeys()
    }

    set p2(value: Partial<Record<keyof typeof NESGamepad.KEYS_INDEX, string>>) {
        Object.assign(this._p2, value)
        this.setEventKeys()
    }

    get p1(): NESGamepad['_p1'] {
        return this._p1
    }

    get p2(): NESGamepad['_p2'] {
        return this._p2
    }

    setThreshold(threshold: number) {
        this.threshold = threshold
    }

    setInterval(turbo: number) {
        this.interval = 1000 / turbo
    }

    setEnableGamepad(enable: boolean) {
        this.enableGamepad = enable
        if (enable) {
            this.addGamepadEvent()
        }
        else {
            this.removeGamepadEvent()
        }
    }

    setButtonState(player: Player, index: number, state: 0x40 | 0x41) {
        if (index < 8) {
            this._nes.controllers[player].state[index] = state
        }
        else {
            const auto = this._auto[player][index]
            if (state === 0x41) {
                if (auto.once) {
                    this._nes.controllers[player].state[index - 8] = 0x41
                    auto.timeout = window.setInterval(() => {
                        auto.beDown = !auto.beDown
                        this._nes.controllers[player].state[index - 8] = auto.beDown ? 0x41 : 0x40
                    }, this.interval)
                    auto.once = false
                }
            }
            else {
                clearInterval(auto.timeout)
                auto.beDown = false
                auto.once = true
                this._nes.controllers[player].state[index - 8] = state
            }
        }
    }

    triggerButton(code: string, state: 0x40 | 0x41) {
        if (code in this._eventKeys) {
            this._eventKeys[code].forEach(([player, index]) => {
                this.setButtonState(player, index, state)
            })
        }
    }

    keyDownEvent(event: KeyboardEvent) {
        const code = event.code
        this.triggerButton(code, 0x41)
    }

    keyUpEvent(event: KeyboardEvent) {
        const code = event.code
        this.triggerButton(code, 0x40)
    }

    addKeyboadEvent() {
        document.addEventListener('keydown', this.keyDownEvent)
        document.addEventListener('keyup', this.keyUpEvent)
    }

    removeKeyboardEvent() {
        document.removeEventListener('keydown', this.keyDownEvent)
        document.removeEventListener('keyup', this.keyUpEvent)
    }

    connectGamepadHandler(state: boolean, _e: GamepadEvent) {
        if (!this.enableGamepad) {
            return
        }
        if (state) {
            this.addGamepadEvent()
        }
        else if (this.gamepads.length === 0) {
            this.removeGamepadEvent()
        }
    }

    axesHandler(player: Player, check: boolean, gpAxesindex: number, gpBtnIndex: number) {
        const hold = this.axesHolding[player]?.[gpAxesindex]
        if (check) {
            if (!hold) {
                this.setButtonState(player, this.gamepadButtons[gpBtnIndex], 0x41)
                this.axesHolding[player][gpAxesindex] = true
            }
        }
        else if (hold) {
            this.setButtonState(player, this.gamepadButtons[gpBtnIndex], 0x40)
            this.axesHolding[player][gpAxesindex] = false
        }
    }

    btnHandler(player: Player, btn: GamepadButton, gpBtnIndex: number) {
        const hold = this.btnHolding[player]?.[gpBtnIndex]
        const btnIndex = this.gamepadButtons[gpBtnIndex]
        if (typeof btnIndex === 'undefined' || btnIndex < 0) {
            return
        }
        if (btn.pressed) {
            if (hold) {
                return
            }
            this.setButtonState(player, btnIndex, 0x41)
            this.btnHolding[player][gpBtnIndex] = true
        }
        else if (hold) {
            this.setButtonState(player, btnIndex, 0x40)
            this.btnHolding[player][gpBtnIndex] = false
        }
    }

    gamepadFrame() {
        for (let gindex = 0; gindex < this.gamepads.length; gindex++) {
            if (gindex > 1) {
                break
            }
            const player = gindex + 1 as Player
            const gamepad = this.gamepads[gindex]

            gamepad.buttons.forEach(this.btnHandler.bind(this, player))

            const lr = gamepad.axes[0]
            const tb = gamepad.axes[1]
            this.axesHandler(player, lr > this.threshold, 0, 15)
            this.axesHandler(player, lr < -this.threshold, 1, 14)
            this.axesHandler(player, tb > this.threshold, 2, 13)
            this.axesHandler(player, tb < -this.threshold, 3, 12)
        }
    }

    runGamepad() {
        if (this.animationFrameId !== null) {
            window.cancelAnimationFrame(this.animationFrameId)
        }
        this.gamepadFrame()
        this.animationFrameId = window.requestAnimationFrame(this.runGamepad)
    }

    stopGamepad() {
        if (this.animationFrameId !== null) {
            window.cancelAnimationFrame(this.animationFrameId)
            this.animationFrameId = null
        }
    }

    addGamepadEvent() {
        this.runGamepad()
    }

    removeGamepadEvent() {
        this.btnHolding[1].fill(false)
        this.btnHolding[2].fill(false)
        this.axesHolding[1].fill(false)
        this.axesHolding[2].fill(false)
        this.stopGamepad()
    }
}

export { NESGamepad }
