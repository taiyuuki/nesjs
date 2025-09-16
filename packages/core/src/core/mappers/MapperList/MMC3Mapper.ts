import { MirrorType, Utils } from '../../types'
import { Mapper } from '../Mapper'

export default class MMC3Mapper extends Mapper {

    protected whichbank = 0
    protected prgconfig = false
    protected chrconfig = false
    protected irqctrreload = 0
    protected irqctr = 0
    protected irqenable = false
    protected irqreload = false
    protected bank6 = 0
    protected chrreg = [0, 0, 0, 0, 0, 0]
    protected interrupted = false
    protected lastA12 = false
    protected a12timer = 0

    override loadROM(): void {
        super.loadROM()
        for (let i = 1; i <= 32; ++i) {
            this.prg_map[32 - i] = this.prgsize - 1024 * i
        }
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 0
        }
        this.setbank6()

        // this.cpuram.setPrgRAMEnable(false);
    }

    override cartWrite(addr: number, data: number): void {
        if (addr < 0x8000 || addr > 0xffff) {
            super.cartWrite(addr, data)

            return
        }

        switch (addr & 0xE001) {
            case 0x8000:

                // Command/Address Select register
                this.whichbank = data & 7
                const newPrgConfig = (data & Utils.BIT6) !== 0
                if (newPrgConfig !== this.prgconfig) {
                    this.prgconfig = newPrgConfig
                    this.setbank6()
                }
                
                const newChrConfig = (data & Utils.BIT7) !== 0
                if (newChrConfig !== this.chrconfig) {
                    this.chrconfig = newChrConfig

                    // 当CHR配置改变时，重新映射所有CHR banks
                    this.remapChrBanks()
                }
                break

            case 0x8001:

                // Page number for command
                this.executeCommand(this.whichbank, data)
                break

            case 0xA000:

                // Mirroring select
                if (this.scrolltype !== MirrorType.FOUR_SCREEN_MIRROR) {
                    this.setmirroring((data & Utils.BIT0) === 0 ? MirrorType.V_MIRROR : MirrorType.H_MIRROR)
                }
                break

            case 0xA001:

                // SaveRAM Toggle - TODO
                break

            case 0xC000:

                // IRQ Counter register
                this.irqctr = data
                break

            case 0xC001:

                // IRQ Latch register
                this.irqctrreload = data
                break

            case 0xE000:

                // IRQ Control Reg 0 (disable)
                if (this.interrupted) {
                    --this.cpu!.interrupt
                }
                this.interrupted = false
                this.irqenable = false
                break

            case 0xE001:

                // IRQ Control Reg 1 (enable)
                this.irqenable = true
                break
        }
    }

    protected setupchr() {
        if (this.chrconfig) {

            this.setppubank(1, 0, this.chrreg[2])
            this.setppubank(1, 1, this.chrreg[3])
            this.setppubank(1, 2, this.chrreg[4])
            this.setppubank(1, 3, this.chrreg[5])

            // Lowest bit of bank number IS IGNORED for the 2k banks
            this.setppubank(2, 4, this.chrreg[0] >> 1 << 1)
            this.setppubank(2, 6, this.chrreg[1] >> 1 << 1)

        }
        else {
            this.setppubank(1, 4, this.chrreg[2])
            this.setppubank(1, 5, this.chrreg[3])
            this.setppubank(1, 6, this.chrreg[4])
            this.setppubank(1, 7, this.chrreg[5])

            this.setppubank(2, 0, this.chrreg[0] >> 1 << 1)
            this.setppubank(2, 2, this.chrreg[1] >> 1 << 1)
        }
    }

    protected executeCommand(cmd: number, arg: number): void {
        switch (cmd) {
            case 0:

                // Select 2 1KB VROM pages at 0x0000:
                if (this.chrconfig === false) {
                    this.load1kVromBank(arg & 0xFE, 0x0000)
                    this.load1kVromBank((arg & 0xFE) + 1, 0x0400)
                } 
                else {
                    this.load1kVromBank(arg & 0xFE, 0x1000)
                    this.load1kVromBank((arg & 0xFE) + 1, 0x1400)
                }
                this.chrreg[0] = arg
                break

            case 1: 

                // Select 2 1KB VROM pages at 0x0800:
                if (this.chrconfig === false) {
                    this.load1kVromBank(arg & 0xFE, 0x0800)
                    this.load1kVromBank((arg & 0xFE) + 1, 0x0C00)
                } 
                else {
                    this.load1kVromBank(arg & 0xFE, 0x1800)
                    this.load1kVromBank((arg & 0xFE) + 1, 0x1C00)
                }
                this.chrreg[1] = arg
                break

            case 2:
                if (this.chrconfig === false) {
                    this.load1kVromBank(arg, 0x1000)
                } 
                else {
                    this.load1kVromBank(arg, 0x0000)
                }
                this.chrreg[2] = arg
                break

            case 3:
                if (this.chrconfig === false) {
                    this.load1kVromBank(arg, 0x1400)
                } 
                else {
                    this.load1kVromBank(arg, 0x0400)
                }
                this.chrreg[3] = arg
                break

            case 4:
                if (this.chrconfig === false) {
                    this.load1kVromBank(arg, 0x1800)
                } 
                else {
                    this.load1kVromBank(arg, 0x0800)
                }
                this.chrreg[4] = arg
                break

            case 5: 
                if (this.chrconfig === false) {
                    this.load1kVromBank(arg, 0x1C00)
                } 
                else {
                    this.load1kVromBank(arg, 0x0C00)
                }
                this.chrreg[5] = arg
                break

            case 6: 
                this.bank6 = arg
                this.setbank6()
                break

            case 7: 
                const prgBanks = this.prgsize / 8192
                const safeBank = arg & prgBanks - 1
                for (let i = 0; i < 8; ++i) {
                    this.prg_map[i + 8] = 1024 * (i + safeBank * 8) % this.prgsize
                }
                break
        }
    }

    protected setbank6(): void {
        if (this.prgconfig) {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = this.prgsize - 16384 + 1024 * i
                this.prg_map[i + 16] = 1024 * (i + this.bank6 * 8) % this.prgsize
            }
        }
        else {
            for (let i = 0; i < 8; ++i) {
                this.prg_map[i] = 1024 * (i + this.bank6 * 8) % this.prgsize
                this.prg_map[i + 16] = this.prgsize - 16384 + 1024 * i
            }
        }
    }

    override ppuRead(addr: number): number {
        this.checkA12(addr)

        return super.ppuRead(addr)
    }

    override ppuWrite(addr: number, data: number): void {
        this.checkA12(addr)
        super.ppuWrite(addr, data)
    }

    override checkA12(addr: number): void {
        const a12 = (addr & Utils.BIT12) !== 0
        if (a12 && !this.lastA12) {
            if (this.a12timer <= 0) {
                this.clockScanCounter()
            }
        }
        else if (!a12 && this.lastA12) {
            this.a12timer = 8
        }
        --this.a12timer
        this.lastA12 = a12
    }

    private clockScanCounter(): void {
        if (this.irqreload || this.irqctr === 0) {
            this.irqctr = this.irqctrreload
            this.irqreload = false
        }
        else {
            --this.irqctr
        }
        if (this.irqctr === 0 && this.irqenable && !this.interrupted) {
            ++this.cpu!.interrupt
            this.interrupted = true
        }
    }

    protected setppubank(banksize: number, bankpos: number, banknum: number): void {
        for (let i = 0; i < banksize; ++i) {
            this.chr_map[i + bankpos] = 1024 * (banknum + i) % this.chrsize
        }
    }

    protected load1kVromBank(bank1k: number, address: number): void {
        if (this.chrsize === 0) {
            return
        }

        const bank4k = Math.floor(bank1k / 4) % (this.chrsize / 4096)
        const bankoffset = bank1k % 4 * 1024
        
        // 直接更新chr_map，因为我们的架构不同于jsnes
        const mapIndex = address >> 10 // address / 1024
        this.chr_map[mapIndex] = (bank4k * 4096 + bankoffset) % this.chrsize
    }

    protected remapChrBanks(): void {

        // 重新执行所有CHR commands以更新映射
        // 这模拟了jsnes在chrAddressSelect变化时的行为
        for (let i = 0; i < 6; i++) {
            if (this.chrreg[i] !== 0) {
                this.executeCommand(i, this.chrreg[i])
            }
        }
    }

    /**
     * 强制重新映射所有CHR银行，确保与当前chrconfig状态完全同步
     * 这个方法专门用于存档恢复时的状态修复
     */
    protected forceRemapAllChrBanks(): void {

        // 直接根据当前的chrconfig和chrreg状态重建CHR映射
        // 这避免了executeCommand中可能存在的状态不一致问题
        
        if (this.chrconfig) {

            // chrconfig=true: 4KB在$1000-$1FFF, 1KB在$0000-$0FFF
            // 1KB banks at $0000-$0FFF
            this.setppubank(1, 0, this.chrreg[2])
            this.setppubank(1, 1, this.chrreg[3]) 
            this.setppubank(1, 2, this.chrreg[4])
            this.setppubank(1, 3, this.chrreg[5])
            
            // 2KB banks at $1000-$1FFF (忽略最低位)
            this.setppubank(2, 4, this.chrreg[0] >> 1 << 1)
            this.setppubank(2, 6, this.chrreg[1] >> 1 << 1)
        }
        else {

            // chrconfig=false: 4KB在$0000-$0FFF, 1KB在$1000-$1FFF  
            // 2KB banks at $0000-$0FFF (忽略最低位)
            this.setppubank(2, 0, this.chrreg[0] >> 1 << 1)
            this.setppubank(2, 2, this.chrreg[1] >> 1 << 1)
            
            // 1KB banks at $1000-$1FFF
            this.setppubank(1, 4, this.chrreg[2])
            this.setppubank(1, 5, this.chrreg[3])
            this.setppubank(1, 6, this.chrreg[4])
            this.setppubank(1, 7, this.chrreg[5])
        }
    }

    /**
     * MMC3 存档恢复后的特殊处理
     */
    protected override postLoadState(_state: any): void {

        // MMC3 特有的恢复逻辑
        this.setbank6()
        this.forceRemapAllChrBanks()
        
        // 重新执行每个CHR command，确保映射表正确
        for (let i = 0; i < 6; i++) {
            if (this.chrreg[i] !== undefined) {
                this.executeCommand(i, this.chrreg[i])
            }
        }
        
        // 修复IRQ中断状态
        if (this.interrupted && this.cpu) {
            this.interrupted = false
            if (this.irqenable && this.irqctr === 0) {
                ++this.cpu.interrupt
                this.interrupted = true
            }
        }
    }
}
