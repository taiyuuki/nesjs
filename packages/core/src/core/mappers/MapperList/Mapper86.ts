import { Mapper } from '../Mapper'

export default class Mapper86 extends Mapper {
    public loadROM(): void {
        super.loadROM()
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
    }

    public cartWrite(addr: number, data: number): void {
        if (addr >= 0x6000 && addr <= 0x6FFF) {
            const prgselect = data >> 4 & 3
            const chrselect = data & 3 | (data & 0x40) >> 4
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = 1024 * (i + 8 * chrselect) & this.chrsize - 1
            }
            for (let i = 0; i < 32; ++i) {
                this.prg_map[i] = 1024 * (i + 32 * prgselect) & this.prgsize - 1
            }
        }
        else if (addr >= 0x7000 && addr <= 0x7FFF) {
            if ((data & 0x30) !== 0x20) {
                return
            }

            // TODO: 可扩展为事件/音效回调
            switch (data & 0x1F) {
                case 0:

                    // "Strike!"
                    break
                case 1:

                    // "Ball!"
                    break
                case 2:

                    // "Time!"
                    break
                case 3:

                    // "Out!"
                    break
                case 4:

                    // "Safe!"
                    break
                case 5:

                    // "Foul!"
                    break
                case 6:

                    // "Fair!"
                    break
                case 7:

                    // "You're out!"
                    break
                case 8:

                    // "Play ball!"
                    break
                case 9:

                    // "Ball 4!"
                    break
                case 10:

                    // "Home run!"
                    break
                case 11:

                    // "New pitcher"
                    break
                case 12:

                    // "Ouch!"
                    break
                case 13:

                    // "Dummy!"
                    break
                case 14:

                    // *crack*
                    break
                case 15:

                    // *cheer*
                    break
            }
        }
    }
}
