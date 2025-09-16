import { Mapper } from '../Mapper'

/**
 * Mapper31 - NSF专用Mapper，基于BNROM，支持NSF类型bankswitch
 */
export default class Mapper31 extends Mapper {
    public nsfBanking = true
    public nsfBanks: number[] = [0, 0, 0, 0, 0, 0, 0, 0xff]

    public override loadROM(): void {
        super.loadROM()
        this.setBanks()
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr >= 0x6000 && addr < 0x8000) {
            this.prgram[addr & 0x1fff] = data
        }
        else if (addr >= 0x5000 && addr < 0x6000) {
            this.nsfBanks[addr & 7] = data
            this.setBanks()
        }
        else {

            // console.warn(`Mapper31: write to ${addr.toString(16)} ignored`)
        }
    }

    public override cartRead(addr: number): number {
        if (addr >= 0x8000) {
            const index = (addr & 0x7fff) >> 10
            const offset = addr & 1023

            return this.prg[this.prg_map[index] + offset]
        }
        else if (addr >= 0x6000 && this.hasprgram) {
            return this.prgram[addr & 0x1fff]
        }
        else if (addr >= 0x5000) {
            return this.nsfBanks[addr & 7]
        }

        // open bus
        return addr >> 8
    }

    private setBanks(): void {
        for (let i = 0; i < this.prg_map.length; ++i) {
            this.prg_map[i] = 4096 * this.nsfBanks[Math.floor(i / 4)] + 1024 * (i % 4)
            if (this.prg_map[i] >= this.prg.length) {
                this.prg_map[i] &= this.prgsize - 1
            }
        }
    }
}
