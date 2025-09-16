// FIXME: Mapper16的另一个版本，能运行但花屏
import { MirrorType } from '../../types'
import { Mapper } from '../Mapper'

export default class BandaiMapper extends Mapper {

    private irqCounter = 0
    private irqLatch = 0
    private irqEnabled = false
    private interrupted = false
    
    // EEPROM simulation (for submapper 5)
    private eepromData = new Uint8Array(256) // 24C02 EEPROM (256 bytes)
    private eepromSDA = false
    private eepromSCL = false
    private eepromRead = false

    private patch = 0

    override loadROM(): void {
        super.loadROM()
        
        // PRG bank映射初始化
        // $8000-$BFFF: 默认bank 0 (16KB)
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = i * 1024
        }

        // $C000-$FFFF: 固定最后一个16KB bank
        for (let i = 16; i < 32; ++i) {
            this.prg_map[i] = this.prgsize - 1024 * (32 - i)
        }
        
        // CHR bank映射初始化 - 8个1KB bank
        if (this.chrsize > 0) {

            // CHR-ROM: 正常映射
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = i * 1024 % this.chrsize
            }
        }
        else {

            // CHR-RAM: 设置为8KB CHR-RAM
            this.haschrram = true
            this.chrsize = 8192
            this.chr = new Array(8192).fill(0)
            for (let i = 0; i < 8; ++i) {
                this.chr_map[i] = i * 1024
            }
        }
        
        // PPU nametable指针初始化
        this.nt0 = this.pput0
        this.nt1 = this.pput1
        this.nt2 = this.pput2
        this.nt3 = this.pput3
        
        // 设置初始镜像模式（从ROM头部读取）
        this.setmirroring(this.scrolltype)
        
        // 初始化EEPROM数据为0xFF
        this.eepromData.fill(0xFF)
    }

    override cartRead(addr: number): number {
        if (addr >= 0x6000 && addr < 0x8000) {

            // Submapper 5: EEPROM read
            if (this.submapper === 5 && this.eepromRead) {
                const data = this.readEEPROM()

                return (data ? 0x10 : 0x00) | addr >> 8 // 其他位为open bus
            }
            
            // Submapper 4: 这个范围用于寄存器写入，读取返回open bus
            if (this.submapper === 4) {
                return addr >> 8 // open bus
            }
        }
        
        if (addr >= 0x8000) {
            return this.prg[this.prg_map[(addr & 0x7fff) >> 10] + (addr & 1023)]
        }
        
        return super.cartRead(addr)
    }

    override cartWrite(addr: number, data: number): void {
        
        // Submapper 0: 自动检测 - 同时支持两个地址范围
        // Submapper 4: FCG-1/2 使用 $6000-$7FFF 范围
        if ((this.submapper === 0 || this.submapper === 4) && addr >= 0x6000 && addr < 0x8000) {
            this.handleRegisterWrite(addr, data)

            return
        }
        
        // Submapper 0: 自动检测 - 同时支持两个地址范围  
        // Submapper 5: LZ93D50 使用 $8000-$FFFF 范围  
        if ((this.submapper === 0 || this.submapper === 5) && addr >= 0x8000) {
            this.handleRegisterWrite(addr, data)

            return
        }
        
        super.cartWrite(addr, data)
    }

    private handleRegisterWrite(addr: number, data: number): void {
        const reg = addr & 0x0F
        
        switch (reg) {
            case 0x00: case 0x01: case 0x02: case 0x03:
            case 0x04: case 0x05: case 0x06: case 0x07:

                // CHR-ROM Bank Select
                this.setCHRBank(reg, data)
                break
                
            case 0x08:

                // PRG-ROM Bank Select
                this.setPRGBank(data & 0x0F)
                break
                
            case 0x09:

                // Nametable Mirroring
                this.setMirroring(data & 0x03)
                break
                
            case 0x0A:

                // IRQ Control
                this.acknowledgeIRQ() // 先确认IRQ
                this.irqEnabled = (data & 0x01) !== 0
                
                // Submapper 5: 复制latch到counter
                if (this.submapper === 5) {
                    this.irqCounter = this.irqLatch
                }
                
                // 如果启用计数且counter为0，立即触发IRQ
                if (this.irqEnabled && this.irqCounter === 0) {
                    this.triggerIRQ()
                }
                break
                
            case 0x0B:

                // IRQ Counter Low Byte
                if (this.submapper === 4) {

                    // FCG-1/2: 直接写入counter
                    this.irqCounter = this.irqCounter & 0xFF00 | data
                }
                else {

                    // LZ93D50: 写入latch
                    this.irqLatch = this.irqLatch & 0xFF00 | data
                }
                break
                
            case 0x0C:

                // IRQ Counter High Byte
                if (this.submapper === 4) {

                    // FCG-1/2: 直接写入counter
                    this.irqCounter = this.irqCounter & 0x00FF | data << 8
                }
                else {

                    // LZ93D50: 写入latch
                    this.irqLatch = this.irqLatch & 0x00FF | data << 8
                }
                break
                
            case 0x0D:

                // EEPROM Control (submapper 5 only)
                if (this.submapper === 5) {
                    this.eepromRead = (data & 0x80) !== 0
                    this.eepromSDA = (data & 0x40) !== 0
                    this.eepromSCL = (data & 0x20) !== 0
                    this.handleEEPROM()
                }
                break
        }
    }

    private setCHRBank(bank: number, value: number): void {

        // 计算安全的CHR bank编号
        if (this.chrsize > 0) {

            // CHR-ROM: 限制在有效范围内
            const chrBankCount = Math.floor(this.chrsize / 1024)
            const safeValue = chrBankCount > 0 ? value % chrBankCount : 0
            this.chr_map[bank] = safeValue * 1024
        }
        else {

            // CHR-RAM: 8KB空间，8个1KB banks
            this.chr_map[bank] = (value & 7) * 1024
        }
    }

    private setPRGBank(bank: number): void {

        // 计算安全的bank编号
        const prgBankCount = Math.floor(this.prgsize / (16 * 1024))
        const safeBank = Math.min(bank, prgBankCount - 1)
        
        // 设置 $8000-$BFFF 的16KB bank
        const baseOffset = safeBank * 16 * 1024
        for (let i = 0; i < 16; ++i) {
            this.prg_map[i] = baseOffset + i * 1024
        }
        
        // $C000-$FFFF 保持固定为最后一个bank
        for (let i = 16; i < 32; ++i) {
            this.prg_map[i] = this.prgsize - 1024 * (32 - i)
        }
    }

    private setMirroring(mode: number): void {
        switch (mode) {
            case 0: // Vertical
                this.setmirroring(MirrorType.V_MIRROR)
                break
            case 1: // Horizontal  
                this.setmirroring(MirrorType.H_MIRROR)
                break
            case 2: // One-screen, page 0
                this.setmirroring(MirrorType.SS_MIRROR0)
                break
            case 3: // One-screen, page 1
                this.setmirroring(MirrorType.SS_MIRROR1)
                break
        }
    }

    private acknowledgeIRQ(): void {
        if (this.interrupted) {
            --this.cpu!.interrupt
            this.interrupted = false
        }
    }

    private triggerIRQ(): void {
        if (!this.interrupted) {
            ++this.cpu!.interrupt
            this.interrupted = true
        }
    }

    override cpucycle(cycles: number): void {
        if (this.irqEnabled && this.irqCounter > 0) {
            this.irqCounter -= cycles
            
            if (this.irqCounter <= 0) {
                this.irqCounter = 0
                this.triggerIRQ()
            }
        }
    }

    // 简化的EEPROM模拟
    private readEEPROM(): boolean {

        // 这是一个简化的实现，实际的I2C协议更复杂
        // 对于大多数游戏来说，简单返回false就足够了
        return false
    }

    private handleEEPROM(): void {

        // 简化的EEPROM处理
        // 实际实现需要完整的I2C协议状态机
        // 对于大多数游戏来说，空实现就足够了
    }

    override ppuRead(addr: number): number {
        if (addr < 0x2000) {

            // CHR-ROM/CHR-RAM 读取
            const bank = addr >> 10 & 7
            const offset = addr & 0x3FF
            const chrAddr = this.chr_map[bank] + offset
            
            // 边界检查
            if (chrAddr >= 0 && chrAddr < this.chr.length) {
                return this.chr[chrAddr]
            }
            
            // 如果越界，返回0（避免崩溃）

            return 0
        }

        return super.ppuRead(addr)
    }

    override ppuWrite(addr: number, data: number): void {
        if (addr < 0x2000) {

            // CHR-RAM 写入 (如果存在)
            if (this.haschrram || this.chrsize === 0) {
                const bank = addr >> 10 & 7
                const offset = addr & 0x3FF
                const chrAddr = this.chr_map[bank] + offset
                
                // 边界检查
                if (chrAddr >= 0 && chrAddr < this.chr.length) {
                    this.chr[chrAddr] = data
                }
            }
        }
        else {
            super.ppuWrite(addr, data)
        }
    }
}
