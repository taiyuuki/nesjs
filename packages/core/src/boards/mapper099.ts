import { copyArrayElements } from 'src/utils'
import type { NES } from 'src/nes'
import { Mapper0 } from './mapper000'

class Mapper99 extends Mapper0 {
    private coin: number = 0
    private currentChrBank: number = 0

    constructor(public nes: NES) {
        super(nes)
        this.nes.ppu.setMirroring(this.nes.rom.FOURSCREEN_MIRRORING)
    }

    override reset() {
        super.reset()

        // 初始化PRG banks
        const prgBanks = this.nes.rom.prgCount
        if (prgBanks >= 4) {
            this.loadRomBank(0, 0x8000)
            this.loadRomBank(1, 0xA000)
            this.loadRomBank(2, 0xC000)
            this.loadRomBank(3, 0xE000)
        }
        else if (prgBanks === 2) {
            this.loadRomBank(0, 0x8000)
            this.loadRomBank(1, 0xA000)
            this.loadRomBank(0, 0xC000)
            this.loadRomBank(1, 0xE000)
        }
        else {
            this.loadRomBank(0, 0x8000)
            this.loadRomBank(0, 0xA000)
            this.loadRomBank(0, 0xC000)
            this.loadRomBank(0, 0xE000)
        }

        // 初始化CHR bank
        if (this.nes.rom.chrCount > 0) {
            this.loadVromBank(0, 0x0000)
            this.currentChrBank = 0
        }
        this.coin = 0
    }

    override write(address: number, value: number) {
        if (address === 0x4016) {

            // 处理CHR bank切换
            const newChrBank = value & 0x04 ? 1 : 0
            if (newChrBank !== this.currentChrBank && this.nes.rom.chrCount > 1) {
                this.loadVromBank(newChrBank, 0x0000)
                this.currentChrBank = newChrBank
            }

            // 处理特定游戏的IRQ
            const crc = this.nes.rom.crc
            if (crc === 0xC99EC059) { // VS Raid on Bungeling Bay
                if (value & 0x02) {
                    this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)
                }
                else {
                    this.nes.cpu.irqRequested = false
                    this.nes.cpu.irqType = null
                }
            }
        }

        // 处理硬币插入状态（0x4020）
        if (address >= 0x4020 && address <= 0x5FFF) {
            if (address === 0x4020) {
                this.coin = value
            }

            return
        }

        super.write(address, value)
    }

    override regLoad(address: number): number {

        // 处理扩展读取（例如硬币状态）
        if (address >= 0x4020 && address <= 0x5FFF) {
            if (address === 0x4020) {
                return this.coin
            }

            return address >> 8 // 返回高字节模拟开放总线
        }

        return super.regLoad(address)
    }

    override loadVromBank(bank: number, address: number) {
        if (this.nes.rom.chrCount === 0) return
        bank %= this.nes.rom.chrCount
        copyArrayElements(
            this.nes.rom.chr[bank],
            0,
            this.nes.ppu.vramMem,
            address,
            0x2000,
        )
    }
}

export { Mapper99 }
