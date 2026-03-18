import { MirrorType } from '../../types'
import { Mapper } from '../Mapper'

export default class Mapper82 extends Mapper {
    private regs = [0, 2, 4, 5, 6, 7, 0, 1, 2]
    private control = 0

    public override loadROM(): void {
        super.loadROM()
        this.reset()
    }

    public override reset(): void {
        this.regs = [0, 2, 4, 5, 6, 7, 0, 1, 2]
        this.control = 0
        this.setmirroring(MirrorType.H_MIRROR)
        this.sync()
    }

    public override cartWrite(addr: number, data: number): void {
        if (addr < 0x7EF0 || addr > 0x7EFC) {
            super.cartWrite(addr, data)

            return
        }

        if (addr <= 0x7EF5) {
            this.regs[addr & 0x07] = data
        }
        else {
            switch (addr) {
                case 0x7EF6:
                    this.control = data & 0x03
                    break

                case 0x7EFA:
                    this.regs[6] = data >> 2
                    break

                case 0x7EFB:
                    this.regs[7] = data >> 2
                    break

                case 0x7EFC:
                    this.regs[8] = data >> 2
                    break

                default:
                    return
            }
        }

        this.sync()
    }

    protected override postLoadState(_state: any): void {
        this.sync()
    }

    private sync(): void {
        const chrSwap = (this.control & 0x02) << 11

        this.setVROM2KBank((0x0000 ^ chrSwap) >> 10, this.regs[0] >> 1)
        this.setVROM2KBank((0x0800 ^ chrSwap) >> 10, this.regs[1] >> 1)
        this.setVROM1KBank((0x1000 ^ chrSwap) >> 10, this.regs[2])
        this.setVROM1KBank((0x1400 ^ chrSwap) >> 10, this.regs[3])
        this.setVROM1KBank((0x1800 ^ chrSwap) >> 10, this.regs[4])
        this.setVROM1KBank((0x1C00 ^ chrSwap) >> 10, this.regs[5])

        this.setPROM8KBank(4, this.regs[6])
        this.setPROM8KBank(5, this.regs[7])
        this.setPROM8KBank(6, this.regs[8])
        this.setPROM8KBank(7, Math.max(0, this.getPROM8KSize() - 1))

        this.setmirroring((this.control & 0x01) === 0 ? MirrorType.H_MIRROR : MirrorType.V_MIRROR)
    }
}
