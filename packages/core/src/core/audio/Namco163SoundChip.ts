import type { ExpansionSoundChip } from '../interfaces'

export class Namco163SoundChip implements ExpansionSoundChip {
    private registers = new Uint8Array(128)
    private out = new Int32Array(8)
    private numch = 1
    private cycpos = 0
    private curch = 0
    private lpaccum = 0

    public clock(cycles: number) {
        this.numch = 1 + (this.registers[127] >> 4 & 7)
        for (let i = 0; i < cycles; ++i) {
            this.cycpos = (this.cycpos + 1) % 15
            if (this.cycpos === 0) {
                this.curch = (this.curch + 1) % this.numch
                this.clock_channel(this.curch)
            }
        }
    }

    private clock_channel(ch: number) {
        const off = 0x80 - 8 * (ch + 1)
        let phase = (this.registers[off + 5] << 16) + (this.registers[off + 3] << 8) + this.registers[off + 1]
        const f = ((this.registers[off + 4] & 3) << 16) + (this.registers[off + 2] << 8) + this.registers[off]
        let len = (64 - (this.registers[off + 4] >> 2)) * 4

        // Heuristics for waveform length
        if (len > 32 && this.registers[off + 4] !== 0) {
            for (let i = 2; i << 2 < len; ++i) {
                if (this.registers[i - 2] === 0 && this.registers[i - 1] === 0 && this.registers[i] === 0) {
                    len = 0x20 - (this.registers[off + 4] & 0x1C)
                    break
                }
            }
        }
        const wavestart = this.registers[off + 6]
        phase = (phase + f) % (len << 16)
        const volume = this.registers[off + 7] & 0xf
        const output = (this.getWavefromRAM((phase >> 16) + wavestart & 0xff) - 8) * volume

        // Store phase back
        this.registers[off + 5] = phase >> 16 & 0xff
        this.registers[off + 3] = phase >> 8 & 0xff
        this.registers[off + 1] = phase & 0xff
        this.out[ch] = output * 16
        this.output()
    }

    private getWavefromRAM(addr: number): number {
        const b = this.registers[addr >> 1]

        return (addr & 1) === 0 ? b & 0xf : b >> 4
    }

    public write(register: number, data: number) {
        this.registers[register] = data & 0xff
    }

    public read(register: number): number {
        return this.registers[register]
    }

    public getval(): number {
        return this.lpaccum << 2
    }

    private output() {
        let sample = 0
        for (let i = 0; i < this.numch; ++i) {
            sample += this.out[i]
        }
        sample += this.lpaccum
        this.lpaccum -= sample * (1 / 16)
    }
}
