import type { ROMLoader } from '../../ROMLoader'
import { Utils } from '../../types'
import MMC3Mapper from './MMC3Mapper'

export default class MMC6Mapper extends MMC3Mapper {

    // MMC6特有的PRG RAM控制
    private prgRamEnable = false
    private ramProtect = 0x00 // $A001 寄存器值
    
    // MMC6内置1KB PRG RAM，分为两个512B银行
    private internalRam = new Uint8Array(1024)

    constructor(loader: ROMLoader) {
        super(loader)
        
        // MMC6有1KB内置PRG RAM，不使用外部PRG RAM
        this.hasprgram = false
    }

    override cartWrite(addr: number, data: number): void {
        if (addr >= 0x7000 && addr < 0x8000) {

            // MMC6 1KB内置PRG RAM区域
            this.writeInternalRam(addr, data)

            return
        }

        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }

        switch (addr & 0xE001) {
            case 0x8000:

                // Bank select register - MMC6扩展了PRG RAM enable位
                this.whichbank = data & 7
                
                // Bit 5: PRG RAM enable (MMC6特有)
                this.prgRamEnable = (data & Utils.BIT5) !== 0
                
                const newPrgConfig = (data & Utils.BIT6) !== 0
                if (newPrgConfig !== this.prgconfig) {
                    this.prgconfig = newPrgConfig
                    this.setbank6()
                }
                
                const newChrConfig = (data & Utils.BIT7) !== 0
                if (newChrConfig !== this.chrconfig) {
                    this.chrconfig = newChrConfig
                    this.remapChrBanks()
                }
                break

            case 0xA001:

                // PRG RAM protect register (MMC6特有)
                if (this.prgRamEnable) {
                    this.ramProtect = data
                }
                else {

                    // 当PRG RAM禁用时，强制设为0x00
                    this.ramProtect = 0x00
                }
                break

            default:

                // 其他寄存器使用MMC3的默认处理
                super.cartWrite(addr, data)
                break
        }
    }

    override cartRead(addr: number): number {
        if (addr >= 0x7000 && addr < 0x8000) {

            // MMC6 1KB内置PRG RAM区域
            return this.readInternalRam(addr)
        }

        return super.cartRead(addr)
    }

    private readInternalRam(addr: number): number {
        const offset = addr & 0x0FFF // $7000-$7FFF
        
        if (offset < 0x200) {

            // $7000-$71FF (first 512B bank)
            const canRead = (this.ramProtect & 0x20) !== 0 // bit 5: read enable for first bank
            if (canRead) {
                return this.internalRam[offset]
            }
            else {

                // 如果读取被禁用但另一个银行可读，返回0
                const otherBankReadable = (this.ramProtect & 0x80) !== 0

                return otherBankReadable ? 0 : addr >> 8 // open bus if neither readable
            }
        }
        else if (offset < 0x400) {

            // $7200-$73FF (second 512B bank)
            const canRead = (this.ramProtect & 0x80) !== 0 // bit 7: read enable for second bank
            if (canRead) {
                return this.internalRam[offset]
            }
            else {

                // 如果读取被禁用但另一个银行可读，返回0
                const otherBankReadable = (this.ramProtect & 0x20) !== 0

                return otherBankReadable ? 0 : addr >> 8 // open bus if neither readable
            }
        }
        else {

            // $7400-$7FFF: 镜像 $7000-$73FF
            return this.readInternalRam(0x7000 + (addr & 0x3FF))
        }
    }

    private writeInternalRam(addr: number, data: number): void {
        const offset = addr & 0x0FFF // $7000-$7FFF
        
        if (offset < 0x200) {

            // $7000-$71FF (first 512B bank)
            const canRead = (this.ramProtect & 0x20) !== 0 // bit 5: read enable
            const canWrite = (this.ramProtect & 0x10) !== 0 // bit 4: write enable
            if (canRead && canWrite) {
                this.internalRam[offset] = data
            }
        }
        else if (offset < 0x400) {

            // $7200-$73FF (second 512B bank)
            const canRead = (this.ramProtect & 0x80) !== 0 // bit 7: read enable
            const canWrite = (this.ramProtect & 0x40) !== 0 // bit 6: write enable
            if (canRead && canWrite) {
                this.internalRam[offset] = data
            }
        }
        else {

            // $7400-$7FFF: 镜像 $7000-$73FF
            this.writeInternalRam(0x7000 + (addr & 0x3FF), data)
        }
    }

    protected override postLoadState(state: any): void {

        // 调用MMC3的存档恢复
        super.postLoadState(state)
        
        // 恢复MMC6特有状态
        if (state.internalRam) {
            this.internalRam.set(state.internalRam)
        }
    }

    override getMapperState(): any {
        const state = super.getMapperState()
        
        // 保存MMC6特有状态
        state.prgRamEnable = this.prgRamEnable
        state.ramProtect = this.ramProtect
        state.internalRam = Array.from(this.internalRam)
        
        return state
    }
}
