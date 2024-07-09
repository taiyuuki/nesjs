class Controller {
    static BUTTON_A = 0
    static BUTTON_B = 1
    static BUTTON_SELECT = 2
    static BUTTON_START = 3
    static BUTTON_UP = 4
    static BUTTON_DOWN = 5
    static BUTTON_LEFT = 6
    static BUTTON_RIGHT = 7
    state: number[]

    constructor() {
        this.state = new Array(8).fill(0x40)
    }

    buttonDown(button: number) {
        this.state[button] = 0x41
    }

    buttonUp(button: number) {
        this.state[button] = 0x40
    }
}

export { Controller }
