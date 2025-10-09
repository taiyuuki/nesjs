import { Mapper } from '../Mapper'

export default class CnromMapper extends Mapper {

    chrEnable: boolean = true

    public override loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }
        
        for (let i = 0; i < 8; i++) {
            this.chr_map[i] = 1024 * (i + 8 * (data & 3)) & this.chrsize - 1

            this.chrEnable = (this.chr_map[i] & 0xF) > 0 && this.chr_map[i] !== 0x13
        }
    }

    public override ppuRead(addr: number) {
        if (!this.chrEnable) {
            this.chrEnable = true
        
            return 0x12
        }
        if (addr < 0x2000) {
            return this.chr[this.chr_map[addr >> 10] + (addr & 1023)]
        }
        else {
            return super.ppuRead(addr)
        }
    }
}
