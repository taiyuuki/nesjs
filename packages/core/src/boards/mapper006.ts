import type { NES } from 'src/nes'
import { copyArrayElements } from 'src/utils'
import { Mapper0 } from './mapper000'

class Mapper6 extends Mapper0 {
    private prgBank: number = 0
    private chrBank: number = 0
    private mirroring: number = 0
    private wramEnabled: boolean = true
    private trainer: Uint8Array | null = null

    constructor(public nes: NES) {
        super(nes)
        
        // 初始化寄存器
        this.nes.cpu.mem[0x4500] = 0x42
        this.nes.cpu.mem[0x42FF] = 0x10 // 默认水平镜像
        this.nes.cpu.mem[0x43FF] = 0x00
    }

    override reset() {
        super.reset()
        this.prgBank = 0
        this.chrBank = 0
        this.mirroring = 0
        this.wramEnabled = true
    }

    override write(address: number, value: number) {
        if (address < 0x2000) {
            this.nes.cpu.mem[address & 0x7ff] = value
        }
        else if (address >= 0x4020 && address <= 0x5FFF) {

            // 处理扩展寄存器
            switch (address) {
                case 0x4500:
                    this.wramEnabled = (value & 0x40) === 0
                    break
                case 0x4501:
                    this.prgBank = value & 0x0F
                    this.updateBanks()
                    break
                case 0x4502:
                    this.chrBank = value & 0x0F
                    this.updateBanks()
                    break
                case 0x42FF:
                    this.mirroring = value & 0x10
                    this.nes.ppu.setMirroring(this.mirroring ? this.nes.rom.HORIZONTAL_MIRRORING 
                        : this.nes.rom.VERTICAL_MIRRORING)
                    break
            }
        }
        else {
            if (address >= 0x6000 && address < 0x8000) {
                if (this.wramEnabled) {
                    this.nes.cpu.mem[address] = value

                    // 若支持电池存档，需触发保存逻辑
                    this.nes.opts.onBatteryRamWrite?.(address, value)
                }

                return
            }
            super.write(address, value)
        }
    }

    private updateBanks() {

        // 切换PRG Bank（32KB）
        const prgBase = this.prgBank * 0x8000
        this.loadRomBank(prgBase, 0x8000)
        this.loadRomBank(prgBase + 0x4000, 0xC000)

        // 切换CHR Bank（8KB）
        const chrBase = this.chrBank * 0x2000
        this.loadVromBank(chrBase, 0x0000)
    }

    override loadROM() {
        if (!this.nes.rom.valid) {
            throw new Error('Mapper6: Invalid ROM!')
        }

        // 加载训练器（如果存在）
        if (this.nes.rom.trainer && this.nes.rom.trainerData) {

            copyArrayElements(
                this.nes.rom.trainerData,
                0,
                this.nes.cpu.mem,
                0x7000,
                512,
            )
        }

        // 初始化PRG Banks
        this.prgBank = 0
        this.updateBanks()

        // 初始化CHR Banks
        if (this.nes.rom.vromCount > 0) {
            this.loadVromBank(0, 0x0000)
        }

        // 执行训练器初始化（硬重置时）
        if (this.trainer) {
            this.nes.cpu.jsr(0x7003) // JSR到训练器入口
        }

        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }

    override loadPRGROM() {

        // 由updateBanks处理
    }

    override loadCHRROM() {

        // 由updateBanks处理
    }

    override loadBatteryRam() {
        if (this.wramEnabled) {
            super.loadBatteryRam()
        }
    }
}

export { Mapper6 }
