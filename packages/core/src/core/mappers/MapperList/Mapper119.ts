import MMC3Mapper from './MMC3Mapper'

export default class Mapper119 extends MMC3Mapper {
    private chrRam = new Array(8192).fill(0)

    public ppuRead(addr: number): number {
        if (addr < 0x2000) {
            this.checkA12(addr)

            return this.chr_map[addr >> 10] > 65535
                ? this.chrRam[this.chr_map[addr >> 10] + (addr & 1023) & 8191]
                : this.chr[(this.chr_map[addr >> 10] & 65535) + (addr & 1023)]
        }
        else {
            return super.ppuRead(addr)
        }
    }

    public ppuWrite(addr: number, data: number): void {
        if (addr < 0x2000) {
            this.checkA12(addr)
            if (this.chr_map[addr >> 10] > 63) {
                this.chrRam[this.chr_map[addr >> 10] + (addr & 1023) & 8191] = data
            }
        }
        else {
            super.ppuWrite(addr, data)
        }
    }

    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 8; ++i) {
            this.prg_map[i] = 1024 * i
            this.prg_map[i + 8] = 1024 * i
        }
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 0
        }
        this.setbank6()

        // cpuram.setPrgRAMEnable(false);
    }

    protected setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i)
        }
    }
}
