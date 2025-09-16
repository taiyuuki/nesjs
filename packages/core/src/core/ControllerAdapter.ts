
import type { GamepadInterface } from './interfaces'

/**
 * 控制器适配器
 */
export class ControllerAdapter {

    private buttonState: number = 0
    private strobeState: boolean = false
    private buttonIndex: number = 0
    private gamepad: GamepadInterface
    private consecutiveReads: number = 0

    constructor(gamepad: GamepadInterface) {
        this.gamepad = gamepad
        this.updateButtonState()
        this.validateGamepad()
    }

    private validateGamepad(): void {
        if (!('buttonStates' in this.gamepad)) {
            throw new Error('GamepadInterface must implement buttonStates property.')
        }
    }

    public strobe(): void {
        this.strobeState = true
        this.buttonIndex = 0
        this.consecutiveReads = 0
        this.updateButtonState() // 更新按键状态
    }

    public getbyte(): number {

        // 确保每次读取时更新按键状态
        this.updateButtonState()
        
        let result: number
        if (this.strobeState) {

            // 在strobe模式下，总是返回A键状态
            result = this.buttonState & 1 | 0x40
        }
        else {

            // 正常读取模式，按顺序返回每个按键
            result = this.buttonState >> this.buttonIndex & 1 | 0x40
            this.buttonIndex = this.buttonIndex + 1 & 7 // 确保索引在0-7范围内循环
            this.consecutiveReads++
            
            // 防止过度读取导致的混乱
            if (this.consecutiveReads > 8) {
                this.buttonIndex = 0
                this.consecutiveReads = 0
            }
        }

        return result
    }

    public output(data: boolean): void {
        if (!data && this.strobeState) {

            // 从strobe状态切换到正常读取模式
            this.strobeState = false
            this.buttonIndex = 0
            this.consecutiveReads = 0
            this.updateButtonState() // 在状态切换时更新按键
        }
        else if (data && !this.strobeState) {

            // 进入strobe模式
            this.strobeState = true
            this.buttonIndex = 0
            this.consecutiveReads = 0
            this.updateButtonState()
        }
    }

    // 从 GamepadInterface 更新按键状态
    public updateButtonState(): void {
        const states = this.gamepad.buttonStates
        
        /**
         * 按键映射 (bit 0 - bit 7):
         * 0 0 0 0 0 0 0 0
         * | | | | | | | `-- A
         * | | | | | | `---- B
         * | | | | | `------ SELECT
         * | | | | `-------- START
         * | | | `---------- UP
         * | | `------------ DOWN
         * | `-------------- LEFT
         * `---------------- RIGHT
         */
        
        this.buttonState = 0
        states.forEach((v, i) => {
            this.buttonState |= v << i
        })
    }

    // 用于存档
    public getControllerState() {
        return {
            buttonState: this.buttonState,
            strobeState: this.strobeState,
            buttonIndex: this.buttonIndex,
            consecutiveReads: this.consecutiveReads,
        }
    }

    // 用于读档
    public setControllerState(state: any) {
        this.buttonState = state.buttonState || 0
        this.strobeState = state.strobeState || false
        this.buttonIndex = state.buttonIndex || 0
        this.consecutiveReads = state.consecutiveReads || 0
        
        Object.assign(this.gamepad.buttonStates, {
            A: this.buttonState >> 0 & 1,
            B: this.buttonState >> 1 & 1,
            SELECT: this.buttonState >> 2 & 1,
            START: this.buttonState >> 3 & 1,
            UP: this.buttonState >> 4 & 1,
            DOWN: this.buttonState >> 5 & 1,
            LEFT: this.buttonState >> 6 & 1,
            RIGHT: this.buttonState >> 7 & 1,
        })
    }

    public getGamepad(): GamepadInterface {
        return this.gamepad
    }
}
