import { Mapper } from '../Mapper'
import { MirrorType } from '@/types'

/**
 * Mapper71 (Codemasters Mapper)
 */
export default class CodemastersMapper extends Mapper {
    private bank = 0x0

    public override loadROM(): void {
        super.loadROM()

        // movable bank，理论上应随机，这里直接初始化
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }

        // fixed bank
        for (let i = 1; i <= 16; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
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
        if (addr < 0xc000) {
            if (this.crc === 0x1BC686A8) {

                // Fire Hawk: 只有这个游戏需要 mapper 控制镜像
                // Micro Machines 开启会严重出错
                this.setmirroring((data & 0x10) === 0 ? MirrorType.SS_MIRROR0 : MirrorType.SS_MIRROR1)
            }
        }
        else {
            this.bank = data & 0xf

            // 重新映射 PRG bank（第一个 bank 可切换，第二个 bank 固定为最后一个）
            for (let i = 0; i < 16; ++i) {
                this.prg_map[i] = 1024 * (i + 16 * this.bank) & this.prgsize - 1
            }
        }
    }

    public override getMapperState(): any {
        const state = super.getMapperState()

        return {
            ...state,
            bank: this.bank,
        }
    }

    public override setMapperState(state: any): void {
        super.setMapperState(state)
        if (state.bank !== undefined) {
            this.bank = state.bank
        }
    }
}
