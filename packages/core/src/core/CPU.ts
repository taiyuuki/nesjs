
import { Utils } from './types'
import type { CPURAM } from './CPURAM'

/**
 * 虚拟读取类型枚举
 */
enum DummyType {
    ONCARRY = 'ONCARRY',
    ALWAYS = 'ALWAYS',
}

/**
 * NES 6502 CPU 实现
 * 移植自 HalfNES Java 版本
 */
export class CPU {
    private readonly ram: CPURAM
    private cycles: number = 0 // 增加以从 cpu 偷取周期
    public clocks: number = 0 // 用于与 cpu 同步
    
    // 寄存器
    private A: number = 0
    private X: number = 0
    private Y: number = 0
    private S: number = 0
    public PC: number = 0
    
    // 标志位
    private carryFlag: boolean = false
    private zeroFlag: boolean = false
    private interruptsDisabled: boolean = true
    private decimalModeFlag: boolean = false
    private overflowFlag: boolean = false
    private negativeFlag: boolean = false
    private previntflag: boolean = false
    private nmi: boolean = false
    private prevnmi: boolean = false
    
    private pb: number = 0 // 如果访问跨越页边界则设置为 1
    public interrupt: number = 0
    public nmiNext: boolean = false
    public idle: boolean = false
    
    // NES 6502 缺少十进制模式，但大多数其他 6502 有它
    private static readonly decimalModeEnable: boolean = false
    private static readonly idleLoopSkip: boolean = true
    
    private interruptDelay: boolean = false
    
    // 调试：帧指令计数器
    public instructionCountThisFrame: number = 0
    
    // Battletoads Hack，直到我制作一个真正周期精确的 CPU 核心。
    // 延迟 STA、STX 或 STY 的写入，直到下一条指令的第一个周期
    // 这足以在滚动改变后几个 PPU 时钟移动它
    // 确保 Battletoads 获得其精灵 0 命中。
    private static readonly battletoadsHackOn: boolean = true
    private dirtyBattletoadsHack: boolean = false
    private hackAddr: number = 0
    private hackData: number = 0

    constructor(cpuram: CPURAM) {
        this.ram = cpuram

        // ram 是 cpu 尝试与之通信的唯一东西。
    }

    public init(initialPC?: number): void {

        // 不同于 reset
        // 将 RAM 置于 NES 开机状态
        for (let i = 0; i < 0x800; ++i) {
            this.ram.write(i, 0xFF)
        }

        // 来自一个特定控制台的开机 RAM 值 (nesdev wiki pre-2015)
        this.ram.write(0x0008, 0xF7)
        this.ram.write(0x0009, 0xEF)
        this.ram.write(0x000A, 0xDF)
        this.ram.write(0x000F, 0xBF)

        for (let i = 0x4000; i <= 0x400F; ++i) {
            this.ram.write(i, 0x00)
        }

        this.ram.write(0x4015, 0x00)
        this.ram.write(0x4017, 0x00)

        this.A = 0
        this.X = 0
        this.Y = 0
        this.S = 0xFD
        
        if (initialPC === undefined) {
            const resetVectorLow = this.ram.read(0xFFFC)
            const resetVectorHigh = this.ram.read(0xFFFD)
            this.PC = resetVectorHigh * 256 + resetVectorLow
        }
        else {
            this.PC = initialPC
        }
    }

    public reset(): void {
        this.PC = this.ram.read(0xFFFD) * 256 + this.ram.read(0xFFFC)
        this.ram.write(0x4015, 0)
        this.ram.write(0x4017, this.ram.read(0x4017))

        // 复位时禁用音频
        this.S -= 3
        this.S &= 0xff
        this.interruptsDisabled = true
    }

    public modcycles(): void {
        this.clocks = 0
    }

    public stealcycles(cyclestosteal: number): void {
        this.cycles += cyclestosteal
    }

    public runcycle(): void {
        this.ram.read(0x4000) // 尝试每个周期同步 APU 并使 dmc irqs 正常工作
        ++this.clocks

        if (this.ram.apu && this.ram.apu.sprdmaCount > 0) {
            this.ram.apu.sprdmaCount--
            if (this.ram.apu.sprdmaCount === 0) {
                this.cycles += 513
            }
        }

        if (this.dirtyBattletoadsHack && this.cycles === 1) {
            this.ram.write(this.hackAddr, this.hackData)
            this.dirtyBattletoadsHack = false
        }

        if (this.cycles-- > 0) { // 倒计时周期，直到再次有工作要做
            return
        }
        
        // 现在我们在新指令的开始

        // 处理 nmi 请求 (NMI 线是边沿敏感的，不是电平敏感的)
        if (this.nmiNext) {
            this.nmi_interrupt()
            this.nmiNext = false
        }
        if (this.nmi && !this.prevnmi) { // 只在 NMI 的正上升沿触发
            this.nmiNext = true
        }
        this.prevnmi = this.nmi

        if (this.interrupt > 0) {
            if (!this.interruptsDisabled && !this.interruptDelay) {
                this.irq_interrupt()
                this.cycles += 7

                return
            }
            else if (this.interruptDelay) {
                this.interruptDelay = false
                if (!this.previntflag) {
                    this.irq_interrupt()
                    this.cycles += 7

                    return
                }
            }
        }
        else {
            this.interruptDelay = false
        }

        // 空闲循环跳过
        if (this.idle && CPU.idleLoopSkip) {
            this.cycles += 3 // 不准确，应该取决于我们跳过解码的指令类型

            return
        }

        this.pb = 0
        const instr = this.ram.read(this.PC++)

        this.executeInstruction(instr)
    }

    private executeInstruction(instr: number): void {
        switch (instr) {

            // ADC - Add with Carry
            case 0x69:
                this.adc(this.imm())
                this.cycles += 2
                break
            case 0x65:
                this.adc(this.zpg())
                this.cycles += 3
                break
            case 0x75:
                this.adc(this.zpg_reg(this.X))
                this.cycles += 4
                break
            case 0x6d:
                this.adc(this.abs())
                this.cycles += 4
                break
            case 0x7d:
                this.adc(this.abs_reg(this.X, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0x79:
                this.adc(this.abs_reg(this.Y, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0x61:
                this.adc(this.indX())
                this.cycles += 6
                break
            case 0x71:
                this.adc(this.indY(DummyType.ONCARRY))
                this.cycles += 5 + this.pb
                break

            // AHX (unofficial) - AND A + X + H
            case 0x93:
                this.ahx(this.indY(DummyType.ALWAYS))
                this.cycles += 6
                break
            case 0x9f:
                this.ahx(this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 5
                break

            // ALR (unofficial) - AND + LSR
            case 0x4b:
                this.alr(this.imm())
                this.cycles += 2
                break

            // ANC (unofficial) - AND + ASL/ROL
            case 0x0b:
            case 0x2b:
                this.anc(this.imm())
                this.cycles += 2
                break

            // AND - Logical AND
            case 0x29:
                this.and(this.imm())
                this.cycles += 2
                break
            case 0x25:
                this.and(this.zpg())
                this.cycles += 3
                break
            case 0x35:
                this.and(this.zpg_reg(this.X))
                this.cycles += 4
                break
            case 0x2D:
                this.and(this.abs())
                this.cycles += 4
                break
            case 0x3D:
                this.and(this.abs_reg(this.X, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0x39:
                this.and(this.abs_reg(this.Y, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0x21:
                this.and(this.indX())
                this.cycles += 6
                break
            case 0x31:
                this.and(this.indY(DummyType.ONCARRY))
                this.cycles += 5 + this.pb
                break

            // ARR (unofficial) - AND + ROR
            case 0x6b:
                this.arr(this.imm())
                this.cycles += 2
                break

            // ASL - Arithmetic Shift Left
            case 0x0A:
                this.A = this.asl_acc()
                this.cycles += 2
                break
            case 0x06:
                this.asl_mem(this.zpg())
                this.cycles += 5
                break
            case 0x16:
                this.asl_mem(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0x0E:
                this.asl_mem(this.abs())
                this.cycles += 6
                break
            case 0x1E:
                this.asl_mem(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break

            // AXS (unofficial)
            case 0xcb:
                this.axs(this.imm())
                this.cycles += 2
                break

            // BIT - Bit Test
            case 0x24:
                this.bit(this.zpg())
                this.cycles += 3
                break
            case 0x2C:
                this.bit(this.abs())
                this.cycles += 4
                break

            // BPL - Branch if Positive
            case 0x10:
                this.branch(!this.negativeFlag)
                this.cycles += 2 + this.pb
                break

            // BMI - Branch if Minus
            case 0x30:
                this.branch(this.negativeFlag)
                this.cycles += 2 + this.pb
                break

            // BVC - Branch if Overflow Clear
            case 0x50:
                this.branch(!this.overflowFlag)
                this.cycles += 2 + this.pb
                break

            // BVS - Branch if Overflow Set
            case 0x70:
                this.branch(this.overflowFlag)
                this.cycles += 2 + this.pb
                break

            // BCC - Branch if Carry Clear
            case 0x90:
                this.branch(!this.carryFlag)
                this.cycles += 2 + this.pb
                break

            // BCS - Branch if Carry Set  
            case 0xB0:
                this.branch(this.carryFlag)
                this.cycles += 2 + this.pb
                break

            // BNE - Branch if Not Equal
            case 0xD0:
                this.branch(!this.zeroFlag)
                this.cycles += 2 + this.pb
                break

            // BEQ - Branch if Equal
            case 0xF0:
                this.branch(this.zeroFlag)
                this.cycles += 2 + this.pb
                break

            // BRK - Force Interrupt
            case 0x00:
                this.brk()
                this.cycles += 7
                break

            // CMP - Compare
            case 0xC9:
                this.cmp(this.A, this.imm())
                this.cycles += 2
                break
            case 0xC5:
                this.cmp(this.A, this.zpg())
                this.cycles += 3
                break
            case 0xD5:
                this.cmp(this.A, this.zpg_reg(this.X))
                this.cycles += 4
                break
            case 0xCD:
                this.cmp(this.A, this.abs())
                this.cycles += 4
                break
            case 0xDD:
                this.cmp(this.A, this.abs_reg(this.X, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0xD9:
                this.cmp(this.A, this.abs_reg(this.Y, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0xC1:
                this.cmp(this.A, this.indX())
                this.cycles += 6
                break
            case 0xD1:
                this.cmp(this.A, this.indY(DummyType.ONCARRY))
                this.cycles += 5 + this.pb
                break

            // CPX - Compare X Register
            case 0xE0:
                this.cmp(this.X, this.imm())
                this.cycles += 2
                break
            case 0xE4:
                this.cmp(this.X, this.zpg())
                this.cycles += 3
                break
            case 0xEC:
                this.cmp(this.X, this.abs())
                this.cycles += 4
                break

            // CPY - Compare Y Register
            case 0xC0:
                this.cmp(this.Y, this.imm())
                this.cycles += 2
                break
            case 0xC4:
                this.cmp(this.Y, this.zpg())
                this.cycles += 3
                break
            case 0xCC:
                this.cmp(this.Y, this.abs())
                this.cycles += 4
                break

            // DEC - Decrement Memory
            case 0xC6:
                this.dec(this.zpg())
                this.cycles += 5
                break
            case 0xD6:
                this.dec(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0xCE:
                this.dec(this.abs())
                this.cycles += 6
                break
            case 0xDE:
                this.dec(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break

            // DCP (unofficial) - DEC + CMP
            case 0xc3:
                this.dcp(this.A, this.indX())
                this.cycles += 8
                break
            case 0xd3:
                this.dcp(this.A, this.indY(DummyType.ALWAYS))
                this.cycles += 8
                break
            case 0xc7:
                this.dcp(this.A, this.zpg())
                this.cycles += 5
                break
            case 0xd7:
                this.dcp(this.A, this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0xdb:
                this.dcp(this.A, this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 7
                break
            case 0xcf:
                this.dcp(this.A, this.abs())
                this.cycles += 6
                break
            case 0xdf:
                this.dcp(this.A, this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break

            // EOR - Exclusive OR
            case 0x49:
                this.eor(this.imm())
                this.cycles += 2
                break
            case 0x45:
                this.eor(this.zpg())
                this.cycles += 3
                break
            case 0x55:
                this.eor(this.zpg_reg(this.X))
                this.cycles += 4
                break
            case 0x4D:
                this.eor(this.abs())
                this.cycles += 4
                break
            case 0x5D:
                this.eor(this.abs_reg(this.X, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0x59:
                this.eor(this.abs_reg(this.Y, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0x41:
                this.eor(this.indX())
                this.cycles += 6
                break
            case 0x51:
                this.eor(this.indY(DummyType.ONCARRY))
                this.cycles += 5 + this.pb
                break

            // CLC - Clear Carry Flag
            case 0x18:
                this.carryFlag = false
                this.cycles += 2
                break

            // SEC - Set Carry Flag
            case 0x38:
                this.carryFlag = true
                this.cycles += 2
                break

            // CLI - Clear Interrupt Disable
            case 0x58:
                this.delayInterrupt()
                this.interruptsDisabled = false
                this.cycles += 2
                break

            // SEI - Set Interrupt Disable
            case 0x78:
                this.delayInterrupt()
                this.interruptsDisabled = true
                this.cycles += 2
                break

            // CLV - Clear Overflow Flag
            case 0xB8:
                this.overflowFlag = false
                this.cycles += 2
                break

            // CLD - Clear Decimal Mode
            case 0xD8:
                this.decimalModeFlag = false
                this.cycles += 2
                break

            // SED - Set Decimal Flag
            case 0xF8:
                this.decimalModeFlag = true
                this.cycles += 2
                break

            // INC - Increment Memory
            case 0xE6:
                this.inc(this.zpg())
                this.cycles += 5
                break
            case 0xF6:
                this.inc(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0xEE:
                this.inc(this.abs())
                this.cycles += 6
                break
            case 0xFE:
                this.inc(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break

            // ISC (unofficial) - INC + SBC
            case 0xe3:
                this.isc(this.indX())
                this.cycles += 8
                break
            case 0xf3:
                this.isc(this.indY(DummyType.ALWAYS))
                this.cycles += 8
                break
            case 0xe7:
                this.isc(this.zpg())
                this.cycles += 5
                break
            case 0xf7:
                this.isc(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0xfb:
                this.isc(this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 7
                break
            case 0xef:
                this.isc(this.abs())
                this.cycles += 6
                break
            case 0xff:
                this.isc(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break

            // JMP - Jump
            case 0x4C:
                {
                    const tempe = this.PC
                    this.PC = this.abs()
                    if (this.PC === tempe - 1) {
                        this.idle = true
                    }
                    this.cycles += 3
                }
                break
            case 0x6C:
                { 
                    const tempe = this.PC
                    this.PC = this.ind()
                    if (this.PC === tempe - 1) {
                        this.idle = true
                    }
                    this.cycles += 5 
                }
                break

            // JSR - Jump to Subroutine
            case 0x20:
                this.jsr()
                this.cycles += 6
                break

            // JAM/KIL/HLT (unofficial) - Halt the CPU
            case 0x02:
            case 0x12:
            case 0x22:
            case 0x32:
            case 0x42:
            case 0x52:
            case 0x62:
            case 0x72:
            case 0x92:
            case 0xb2:
            case 0xd2:
            case 0xf2:
                
                // CPU halt - 在实际硬件中会锁定CPU
                console.warn('CPU JAM/KIL instruction executed - CPU halted')

                break

            // LAS (unofficial) - Load A, X, and S
            case 0xBB:
                this.las(this.abs_reg(this.Y, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break

            // LAX (unofficial) - Load A and X
            case 0xA3:
                this.lax(this.indX())
                this.cycles += 6
                break
            case 0xB3:
                this.lax(this.indY(DummyType.ONCARRY))
                this.cycles += 5 + this.pb
                break
            case 0xA7:
                this.lax(this.zpg())
                this.cycles += 3
                break
            case 0xB7:
                this.lax(this.zpg_reg(this.Y))
                this.cycles += 4
                break
            case 0xAB:
                this.lax(this.imm())
                this.cycles += 2
                break
            case 0xAF:
                this.lax(this.abs())
                this.cycles += 4
                break
            case 0xBF:
                this.lax(this.abs_reg(this.Y, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break

            // LDA - Load Accumulator
            case 0xA9:
                this.A = this.ram.read(this.imm())
                this.setflags(this.A)
                this.cycles += 2
                break
            case 0xA5:
                this.A = this.ram.read(this.zpg())
                this.setflags(this.A)
                this.cycles += 3
                break
            case 0xB5:
                this.A = this.ram.read(this.zpg_reg(this.X))
                this.setflags(this.A)
                this.cycles += 4
                break
            case 0xAD:
                const absAddr = this.abs()
                this.A = this.ram.read(absAddr)
                this.setflags(this.A)
                this.cycles += 4
                break
            case 0xBD:
                this.A = this.ram.read(this.abs_reg(this.X, DummyType.ONCARRY))
                this.setflags(this.A)
                this.cycles += 4 + this.pb
                break
            case 0xB9:
                this.A = this.ram.read(this.abs_reg(this.Y, DummyType.ONCARRY))
                this.setflags(this.A)
                this.cycles += 4 + this.pb
                break
            case 0xA1:
                this.A = this.ram.read(this.indX())
                this.setflags(this.A)
                this.cycles += 6
                break
            case 0xB1:
                this.A = this.ram.read(this.indY(DummyType.ONCARRY))
                this.setflags(this.A)
                this.cycles += 5 + this.pb
                break

            // LDX - Load X Register
            case 0xA2:
                this.X = this.ram.read(this.imm())
                this.setflags(this.X)
                this.cycles += 2
                break
            case 0xA6:
                this.X = this.ram.read(this.zpg())
                this.setflags(this.X)
                this.cycles += 3
                break
            case 0xB6:
                this.X = this.ram.read(this.zpg_reg(this.Y))
                this.setflags(this.X)
                this.cycles += 4
                break
            case 0xAE:
                this.X = this.ram.read(this.abs())
                this.setflags(this.X)
                this.cycles += 4
                break
            case 0xBE:
                this.X = this.ram.read(this.abs_reg(this.Y, DummyType.ONCARRY))
                this.setflags(this.X)
                this.cycles += 4 + this.pb
                break

            // LDY - Load Y Register
            case 0xA0:
                this.Y = this.ram.read(this.imm())
                this.setflags(this.Y)
                this.cycles += 2
                break
            case 0xA4:
                this.Y = this.ram.read(this.zpg())
                this.setflags(this.Y)
                this.cycles += 3
                break
            case 0xB4:
                this.Y = this.ram.read(this.zpg_reg(this.X))
                this.setflags(this.Y)
                this.cycles += 4
                break
            case 0xAC:
                this.Y = this.ram.read(this.abs())
                this.setflags(this.Y)
                this.cycles += 4
                break
            case 0xBC:
                this.Y = this.ram.read(this.abs_reg(this.X, DummyType.ONCARRY))
                this.setflags(this.Y)
                this.cycles += 4 + this.pb
                break

            // LSR - Logical Shift Right
            case 0x4A:
                this.A = this.lsr_acc()
                this.cycles += 2
                break
            case 0x46:
                this.lsr_mem(this.zpg())
                this.cycles += 5
                break
            case 0x56:
                this.lsr_mem(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0x4E:
                this.lsr_mem(this.abs())
                this.cycles += 6
                break
            case 0x5E:
                this.lsr_mem(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break
                
            // NOP variants (unofficial)
            case 0x1a:
            case 0x3a:
            case 0x5a:
            case 0x7a:
            case 0xda:
            case 0xea:
            case 0xfa:
                this.cycles += 2
                break
            case 0x80:
            case 0x82:
            case 0xc2:
            case 0xe2:
            case 0x89:
                this.imm() // consume immediate byte
                this.cycles += 2
                break
            case 0x04:
            case 0x44:
            case 0x64:
                this.zpg() // consume zero page address
                this.cycles += 3
                break
            case 0x14:
            case 0x34:
            case 0x54:
            case 0x74:
            case 0xd4:
            case 0xf4:
                this.zpg_reg(this.X) // consume zero page,X address
                this.cycles += 4
                break
            case 0x0c:
                this.abs() // consume absolute address
                this.cycles += 4
                break
            case 0x1c:
            case 0x3c:
            case 0x5c:
            case 0x7c:
            case 0xdc:
            case 0xfc:
                this.abs_reg(this.X, DummyType.ONCARRY) // consume absolute,X address
                this.cycles += 4 + this.pb
                break

            // ORA - Logical Inclusive OR
            case 0x09:
                this.ora(this.imm())
                this.cycles += 2
                break
            case 0x05:
                this.ora(this.zpg())
                this.cycles += 3
                break
            case 0x15:
                this.ora(this.zpg_reg(this.X))
                this.cycles += 4
                break
            case 0x0D:
                this.ora(this.abs())
                this.cycles += 4
                break
            case 0x1D:
                this.ora(this.abs_reg(this.X, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0x19:
                this.ora(this.abs_reg(this.Y, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0x01:
                this.ora(this.indX())
                this.cycles += 6
                break
            case 0x11:
                this.ora(this.indY(DummyType.ONCARRY))
                this.cycles += 5 + this.pb
                break

            // TAX - Transfer Accumulator to X
            case 0xAA:
                this.X = this.A
                this.setflags(this.X)
                this.cycles += 2
                break
                
            // TXA - Transfer X to Accumulator
            case 0x8A:
                this.A = this.X
                this.setflags(this.A)
                this.cycles += 2
                break

            // DEX - Decrement X Register
            case 0xCA:
                this.X = this.X - 1 & 0xff
                this.setflags(this.X)
                this.cycles += 2
                break

            // INX - Increment X Register
            case 0xE8:
                this.X = this.X + 1 & 0xff
                this.setflags(this.X)
                this.cycles += 2
                break

            // TAY - Transfer Accumulator to Y
            case 0xA8:
                this.Y = this.A
                this.setflags(this.Y)
                this.cycles += 2
                break

            // TYA - Transfer Y to Accumulator
            case 0x98:
                this.A = this.Y
                this.setflags(this.A)
                this.cycles += 2
                break

            // DEY - Decrement Y Register
            case 0x88:
                this.Y = this.Y - 1 & 0xff
                this.setflags(this.Y)
                this.cycles += 2
                break

            // INY - Increment Y Register
            case 0xC8:
                this.Y = this.Y + 1 & 0xff
                this.setflags(this.Y)
                this.cycles += 2
                break

            // RLA (unofficial) - ROL + AND
            case 0x23:
                this.rla(this.indX())
                this.cycles += 8
                break
            case 0x33:
                this.rla(this.indY(DummyType.ALWAYS))
                this.cycles += 8
                break
            case 0x27:
                this.rla(this.zpg())
                this.cycles += 5
                break
            case 0x37:
                this.rla(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0x3b:
                this.rla(this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 7
                break
            case 0x2f:
                this.rla(this.abs())
                this.cycles += 6
                break
            case 0x3f:
                this.rla(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break
                
            // ROL - Rotate Left
            case 0x2A:
                this.A = this.rol_acc()
                this.cycles += 2
                break
            case 0x26:
                this.rol_mem(this.zpg())
                this.cycles += 5
                break
            case 0x36:
                this.rol_mem(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0x2E:
                this.rol_mem(this.abs())
                this.cycles += 6
                break
            case 0x3E:
                this.rol_mem(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break

            // ROR - Rotate Right
            case 0x6A:
                this.ror_acc()
                this.cycles += 2
                break
            case 0x66:
                this.ror_mem(this.zpg())
                this.cycles += 5
                break
            case 0x76:
                this.ror_mem(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0x6E:
                this.ror_mem(this.abs())
                this.cycles += 6
                break
            case 0x7E:
                this.ror_mem(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break
                
            // RRA (unofficial) - Rotate Right and Add
            case 0x63:
                this.rra(this.indX())
                this.cycles += 8
                break
            case 0x73:
                this.rra(this.indY(DummyType.ALWAYS))
                this.cycles += 8
                break
            case 0x67:
                this.rra(this.zpg())
                this.cycles += 5
                break
            case 0x77:
                this.rra(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0x7B:
                this.rra(this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 7
                break
            case 0x6F:
                this.rra(this.abs())
                this.cycles += 6
                break
            case 0x7F:
                this.rra(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break

            // RTI - Return from Interrupt
            case 0x40:
                this.rti()
                this.cycles += 6
                break

            // RTS - Return from Subroutine
            case 0x60:
                this.rts()
                this.cycles += 6
                break

            // SAX (unofficial) - Store A AND X
            case 0x83:
                this.sax(this.indX())
                this.cycles += 6
                break
            case 0x87:
                this.sax(this.zpg())
                this.cycles += 3
                break
            case 0x97:
                this.sax(this.zpg_reg(this.Y))
                this.cycles += 4
                break
            case 0x8F:
                this.sax(this.abs())
                this.cycles += 4
                break

            // SBC - Subtract with Carry
            case 0xE1:
                this.sbc(this.indX())
                this.cycles += 6
                break
            case 0xF1:
                this.sbc(this.indY(DummyType.ONCARRY))
                this.cycles += 5 + this.pb
                break
            case 0xE5:
                this.sbc(this.zpg())
                this.cycles += 3
                break
            case 0xF5:
                this.sbc(this.zpg_reg(this.X))
                this.cycles += 4
                break
            case 0xE9:
                this.sbc(this.imm())
                this.cycles += 2
                break
            case 0xF9:
                this.sbc(this.abs_reg(this.Y, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break
            case 0xeb:
                this.sbc(this.imm()) 
                break
            case 0xED:
                this.sbc(this.abs())
                this.cycles += 4
                break
            case 0xFD:
                this.sbc(this.abs_reg(this.X, DummyType.ONCARRY))
                this.cycles += 4 + this.pb
                break

            // SHX (unofficial) - Store X AND high byte of address + 1
            case 0x9E:
                this.shx(this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 5
                break

            // SHY (unofficial) - Store Y AND high byte of address + 1
            case 0x9C:
                this.shy(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 5
                break

            // SLO (unofficial) - Shift Left and OR
            case 0x03:
                this.slo(this.indX())
                this.cycles += 8
                break
            case 0x07:
                this.slo(this.zpg())
                this.cycles += 5
                break
            case 0x0F:
                this.slo(this.abs())
                this.cycles += 6
                break
            case 0x13:
                this.slo(this.indY(DummyType.ALWAYS))
                this.cycles += 8
                break
            case 0x17:
                this.slo(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0x1B:
                this.slo(this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 7
                break
            case 0x1F:
                this.slo(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break

            // SRE (unofficial) - Shift Right and EOR
            case 0x43:
                this.sre(this.indX())
                this.cycles += 8
                break
            case 0x53:
                this.sre(this.indY(DummyType.ALWAYS))
                this.cycles += 8
                break
            case 0x47:
                this.sre(this.zpg())
                this.cycles += 5
                break
            case 0x57:
                this.sre(this.zpg_reg(this.X))
                this.cycles += 6
                break
            case 0x5B:
                this.sre(this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 7
                break
            case 0x4F:
                this.sre(this.abs())
                this.cycles += 6
                break
            case 0x5F:
                this.sre(this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 7
                break

            // STA - Store Accumulator
            case 0x85:
                this.store(this.A, this.zpg())
                this.cycles += 3
                break
            case 0x95:
                this.store(this.A, this.zpg_reg(this.X))
                this.cycles += 4
                break
            case 0x8D:
                this.store(this.A, this.abs())
                this.cycles += 4
                break
            case 0x9D:
                this.store(this.A, this.abs_reg(this.X, DummyType.ALWAYS))
                this.cycles += 5
                break
            case 0x99:
                this.store(this.A, this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 5
                break
            case 0x81:
                this.store(this.A, this.indX())
                this.cycles += 6
                break
            case 0x91:
                this.store(this.A, this.indY(DummyType.ALWAYS))
                this.cycles += 6
                break

            // Stack instructions
            case 0x9A:
                this.S = this.X
                this.cycles += 2
                break
            case 0xBA:
                this.X = this.S
                this.setflags(this.X)
                this.cycles += 2
                break
            case 0x48:
                this.ram.read(this.PC + 1)
                this.push(this.A)
                this.cycles += 3
                break

            // PLA - Pull Accumulator
            case 0x68:
                this.ram.read(this.PC + 1)
                this.A = this.pull()
                this.setflags(this.A)
                this.cycles += 4
                break

            // PHP - Push Processor Status
            case 0x08:
                this.ram.read(this.PC + 1)
                this.push(this.flagstobyte() | Utils.BIT4) // B flag set on stack
                this.cycles += 3
                break

            // PLP - Pull Processor Status
            case 0x28:
                this.delayInterrupt()
                this.ram.read(this.PC + 1)
                this.bytetoflags(this.pull())
                this.cycles += 4
                break

            // STX - Store X Register
            case 0x86:
                this.store(this.X, this.zpg())
                this.cycles += 3
                break
            case 0x96:
                this.store(this.X, this.zpg_reg(this.Y))
                this.cycles += 4
                break
            case 0x8E:
                this.store(this.X, this.abs())
                this.cycles += 4
                break

            // STY - Store Y Register
            case 0x84:
                this.store(this.Y, this.zpg())
                this.cycles += 3
                break
            case 0x94:
                this.store(this.Y, this.zpg_reg(this.X))
                this.cycles += 4
                break
            case 0x8C:
                this.store(this.Y, this.abs())
                this.cycles += 4
                break

            case 0x9b:
                this.tas(this.abs_reg(this.Y, DummyType.ALWAYS))
                this.cycles += 5
                break

            case 0x8b:
                this.xaa(this.imm())
                this.cycles += 2
                break

            default:

                // 未知指令
                console.warn(`Unknown instruction: ${Utils.hex(instr)}`)
                this.cycles += 2
                break
        }

        this.pb = 0
        this.PC &= 0xFFFF
    }

    // === 指令实现方法 ===

    private adc(addr: number): void {
        const value = this.ram.read(addr)
        let result: number
        
        if (this.decimalModeFlag && CPU.decimalModeEnable) {
            let AL = (this.A & 0xF) + (value & 0xF) + (this.carryFlag ? 1 : 0)
            if (AL >= 0x0A) {
                AL = (AL + 0x6 & 0xF) + 0x10
            }
            result = (this.A & 0xF0) + (value & 0xF0) + AL
            if (result >= 0xA0) {
                result += 0x60
            }
        }
        else {
            result = value + this.A + (this.carryFlag ? 1 : 0)
        }
        
        this.carryFlag = result >> 8 !== 0

        // 设置溢出标志
        this.overflowFlag = ((this.A ^ value) & 0x80) === 0 && ((this.A ^ result) & 0x80) !== 0
        this.A = result & 0xff
        this.setflags(this.A) // 设置其他标志
    }

    private sbc(addr: number): void {
        const value = this.ram.read(addr)
        let result: number
        
        if (this.decimalModeFlag && CPU.decimalModeEnable) {
            let AL = (this.A & 0xF) - (value & 0xF) + (this.carryFlag ? 1 : 0) - 1
            if (AL < 0) {
                AL = (AL - 0x6 & 0xF) - 0x10
            }
            result = (this.A & 0xF0) - (value & 0xF0) + AL
            if (result < 0) {
                result -= 0x60
            }
        }
        else {
            result = this.A - value - (this.carryFlag ? 0 : 1)
        }
        
        this.carryFlag = result >> 8 === 0

        // 设置溢出标志
        this.overflowFlag = ((this.A ^ value) & 0x80) !== 0 && ((this.A ^ result) & 0x80) !== 0
        this.A = result & 0xff
        this.setflags(this.A)
    }

    private and(addr: number): void {
        this.A &= this.ram.read(addr)
        this.setflags(this.A)
    }

    private ora(addr: number): void {
        this.A |= this.ram.read(addr)
        this.setflags(this.A)
    }

    private eor(addr: number): void {
        this.A ^= this.ram.read(addr)
        this.setflags(this.A)
    }

    private cmp(reg: number, addr: number): void {
        const value = this.ram.read(addr)
        const result = reg - value
        this.carryFlag = result >= 0
        this.setflags(result & 0xff)
    }

    private bit(addr: number): void {
        const value = this.ram.read(addr)
        this.zeroFlag = (this.A & value) === 0
        this.negativeFlag = (value & 0x80) !== 0
        this.overflowFlag = (value & 0x40) !== 0
    }

    private asl_acc(): number {
        this.carryFlag = (this.A & 0x80) !== 0
        const result = this.A << 1 & 0xff
        this.setflags(result)

        return result
    }

    private asl_mem(addr: number): void {
        const tmp = this.ram.read(addr)
        this.ram.write(addr, tmp) // 虚拟写入
        this.carryFlag = (tmp & 0x80) !== 0
        const result = tmp << 1 & 0xff
        this.ram.write(addr, result) // 真实写入
        this.setflags(result)
    }

    private lsr_acc(): number {
        this.carryFlag = (this.A & 0x01) !== 0
        const result = this.A >> 1
        this.setflags(result)

        return result
    }

    private lsr_mem(addr: number): void {
        const tmp = this.ram.read(addr)
        this.ram.write(addr, tmp) // 虚拟写入
        this.carryFlag = (tmp & 0x01) !== 0
        const result = tmp >> 1
        this.ram.write(addr, result) // 真实写入
        this.setflags(result)
    }

    private rol_acc(): number {
        const oldCarry = this.carryFlag ? 1 : 0
        this.carryFlag = (this.A & 0x80) !== 0
        const result = (this.A << 1 | oldCarry) & 0xff
        this.setflags(result)

        return result
    }

    private rol_mem(addr: number): void {
        const tmp = this.ram.read(addr)
        this.ram.write(addr, tmp) // 虚拟写入
        const oldCarry = this.carryFlag ? 1 : 0
        this.carryFlag = (tmp & 0x80) !== 0
        const result = (tmp << 1 | oldCarry) & 0xff
        this.ram.write(addr, result) // 真实写入
        this.setflags(result)
    }

    private delayInterrupt() {
        this.interruptDelay = true
        this.previntflag = this.interruptsDisabled
    }

    private ror_acc() {
        const tmp = this.carryFlag
        this.carryFlag = (this.A & Utils.BIT0) !== 0
        this.A = this.A >> 1
        this.A &= 0x7F
        this.A |= tmp ? 128 : 0
        this.setflags(this.A)
    }

    private ror_mem(addr: number): void {
        const tmp = this.ram.read(addr)
        this.ram.write(addr, tmp) // 虚拟写入
        const oldCarry = this.carryFlag ? 0x80 : 0
        this.carryFlag = (tmp & 0x01) !== 0
        const result = tmp >> 1 | oldCarry
        this.ram.write(addr, result) // 真实写入
        this.setflags(result)
    }

    private inc(addr: number): void {
        const tmp = this.ram.read(addr)
        this.ram.write(addr, tmp) // 虚拟写入
        const result = tmp + 1 & 0xff
        this.ram.write(addr, result) // 真实写入
        this.setflags(result)
    }

    private dec(addr: number): void {
        const tmp = this.ram.read(addr)
        this.ram.write(addr, tmp) // 虚拟写入
        const result = tmp - 1 & 0xff
        this.ram.write(addr, result) // 真实写入
        this.setflags(result)
    }

    private store(value: number, addr: number): void {
        if (CPU.battletoadsHackOn) {

            // Battletoads hack - 延迟写入
            this.hackAddr = addr
            this.hackData = value
            this.dirtyBattletoadsHack = true
        }
        else {
            this.ram.write(addr, value)
        }
    }

    private branch(condition: boolean): void {
        if (condition) {
            const pcprev = this.PC + 1 // 存储之前的 PC（在任何修改之前）
            this.PC = this.rel() // rel() 修改 PC 并返回目标地址
            
            // 页跨越惩罚
            if ((pcprev & 0xff00) === (this.PC & 0xff00)) {
                this.cycles++
            }
            else {
                this.pb = 2 // 分支的页跨越需要2个周期
            }
            
            // idle loop检测 - 如果分支跳转到自己前面2个字节（无限循环）
            if (pcprev - 2 === this.PC) {
                this.idle = true
            }
        }
        else {
            this.rel() // 即使不分支也必须进行内存访问
        }
    }

    private brk(): void {
        this.PC++ // BRK 是两字节指令
        this.push(this.PC >> 8 & 0xff)
        this.push(this.PC & 0xff)
        this.push(this.flagstobyte() | Utils.BIT4) // B 标志在堆栈上设置
        this.interruptsDisabled = true
        this.PC = this.ram.read(0xFFFE) | this.ram.read(0xFFFF) << 8
    }

    private jsr(): void {
        const addr = this.abs()
        this.PC-- // JSR 推送 PC-1
        this.push(this.PC >> 8 & 0xff)
        this.push(this.PC & 0xff)
        this.PC = addr
    }

    private rti(): void {
        this.bytetoflags(this.pull())
        this.PC = this.pull() | this.pull() << 8
    }

    private rts(): void {
        this.PC = (this.pull() | this.pull() << 8) + 1
    }

    private nmi_interrupt(): void {
        this.idle = false
        this.push(this.PC >> 8)
        this.push(this.PC & 0xff)
        this.push(this.flagstobyte() & ~Utils.BIT4)
        const nmiLow = this.ram.read(0xFFFA)
        const nmiHigh = this.ram.read(0xFFFB)
        this.PC = nmiLow + (nmiHigh << 8)
        this.cycles += 7
        this.interruptsDisabled = true
    }

    private irq_interrupt(): void {
        this.idle = false
        this.push(this.PC >> 8)
        this.push(this.PC & 0xff)
        this.push(this.flagstobyte() & ~Utils.BIT4) // Java版本清除BIT4

        this.PC = this.ram.read(0xFFFE) + (this.ram.read(0xFFFF) << 8)
        this.interruptsDisabled = true
    }

    private push(value: number): void {
        this.ram.write(0x100 + this.S, value)
        this.S = this.S - 1 & 0xff
    }

    private pull(): number {
        this.S = this.S + 1 & 0xff

        return this.ram.read(0x100 + this.S)
    }

    // === 寻址模式 ===

    private imm(): number {
        return this.PC++
    }

    private xaa(addr: number) {
        this.A = this.X & this.ram.read(addr)
        this.setflags(this.A)
    }

    private zpg(): number {
        return this.ram.read(this.PC++)
    }

    private zpg_reg(reg: number): number {
        return this.ram.read(this.PC++) + reg & 0xff
    }

    private rel(): number {

        // 返回 PC 的实际值，不是要查看的内存位置
        // 因为只有分支使用这个
        const offset = this.ram.read(this.PC++)
        const signedOffset = offset << 24 >> 24 // 符号扩展
        const target = signedOffset + this.PC
        
        return target
    }

    private abs(): number {
        return this.ram.read(this.PC++) + (this.ram.read(this.PC++) << 8)
    }

    private abs_reg(reg: number, dummy: DummyType): number {
        const addr = this.ram.read(this.PC++) | this.ram.read(this.PC++) << 8

        if (addr >> 8 !== addr + reg >> 8) {
            this.pb = 1
        }

        if ((addr & 0xFF00) !== (addr + reg & 0xFF00) && dummy === DummyType.ONCARRY) {
            this.ram.read(addr & 0xFF00 | addr + reg & 0xFF)
        }
        if (dummy === DummyType.ALWAYS) {
            this.ram.read(addr & 0xFF00 | addr + reg & 0xFF)
        }

        return addr + reg & 0xffff
    }

    private ind(): number {

        // 奇怪的模式。只有 jmp 使用
        const readloc = this.abs()

        return this.ram.read(readloc)
            + (this.ram.read((readloc & 0xff) === 0xff ? readloc - 0xff : readloc + 1) << 8)

        // 如果从页面的最后一个字节读取，地址的高位
        // 从页面的第一个字节获取，而不是下一页的第一个字节。
    }

    private indX(): number {
        const arg = this.ram.read(this.PC++)

        return this.ram.read(arg + this.X & 0xff)
            + (this.ram.read(arg + 1 + this.X & 0xff) << 8)

        // 不会遭受与跳转间接相同的错误
    }

    private indY(dummy: DummyType): number {
        const arg = this.ram.read(this.PC++)
        const addr = this.ram.read(arg & 0xff) | this.ram.read(arg + 1 & 0xff) << 8

        if (addr >> 8 !== addr + this.Y >> 8) {
            this.pb = 1
        }

        if ((addr & 0xFF00) !== (addr + this.Y & 0xFF00) && dummy === DummyType.ONCARRY) {
            this.ram.read(addr & 0xFF00 | addr + this.Y & 0xFF)
        }
        if (dummy === DummyType.ALWAYS) {
            this.ram.read(addr & 0xFF00 | addr + this.Y & 0xFF)
        }

        return addr + this.Y & 0xffff
    }

    // === 标志位操作 ===

    private flagstobyte(): number {
        return (this.negativeFlag ? Utils.BIT7 : 0)
            | (this.overflowFlag ? Utils.BIT6 : 0)
            | Utils.BIT5
            | (this.decimalModeFlag ? Utils.BIT3 : 0)
            | (this.interruptsDisabled ? Utils.BIT2 : 0)
            | (this.zeroFlag ? Utils.BIT1 : 0)
            | (this.carryFlag ? Utils.BIT0 : 0)
    }

    private bytetoflags(flags: number): void {
        this.negativeFlag = (flags & Utils.BIT7) !== 0
        this.overflowFlag = (flags & Utils.BIT6) !== 0
        this.decimalModeFlag = (flags & Utils.BIT3) !== 0
        this.interruptsDisabled = (flags & Utils.BIT2) !== 0
        this.zeroFlag = (flags & Utils.BIT1) !== 0
        this.carryFlag = (flags & Utils.BIT0) !== 0
    }

    public static opcodes() {
        const op: string[] = []
        op[0x00] = 'BRK'
        op[0x01] = 'ORA $(%2$02X%1$02X,x)'
        op[0x02] = 'KIL'
        op[0x03] = 'SLO $(%2$02X%1$02X,x)'
        op[0x04] = 'NOP $%1$02X'
        op[0x05] = 'ORA $%1$02X'
        op[0x06] = 'ASL $%1$02X'
        op[0x07] = 'SLO $%1$02X'
        op[0x08] = 'PHP'
        op[0x09] = 'ORA #$%1$02X'
        op[0x0A] = 'ASL A'
        op[0x0B] = 'ANC #$%1$02X'
        op[0x0C] = 'NOP $%2$02X%1$02X'
        op[0x0D] = 'ORA $%2$02X%1$02X'
        op[0x0E] = 'ASL $%2$02X%1$02X'
        op[0x0F] = 'SLO $%2$02X%1$02X'
        op[0x10] = 'BPL $%3$02X'
        op[0x11] = 'ORA ($%1$02X), y'
        op[0x12] = 'KIL'
        op[0x13] = 'SLO ($%1$02X), y'
        op[0x14] = 'NOP $%1$02X,x'
        op[0x15] = 'ORA $%1$02X,x'
        op[0x16] = 'ASL $%1$02X,x'
        op[0x17] = 'SLO $%1$02X,x'
        op[0x18] = 'CLC'
        op[0x19] = 'ORA $%2$02X%1$02X,y'
        op[0x1A] = 'NOP'
        op[0x1B] = 'SLO $%2$02X%1$02X,y'
        op[0x1C] = 'NOP $%2$02X%1$02X,x'
        op[0x1D] = 'ORA $%2$02X%1$02X,x'
        op[0x1E] = 'ASL $%2$02X%1$02X,x'
        op[0x1F] = 'SLO $%2$02X%1$02X,x'
        op[0x20] = 'JSR $%2$02X%1$02X'
        op[0x21] = 'AND $(%2$02X%1$02X,x)'
        op[0x22] = 'KIL'
        op[0x23] = 'RLA $(%2$02X%1$02X,x)'
        op[0x24] = 'BIT $%1$02X'
        op[0x25] = 'AND $%1$02X'
        op[0x26] = 'ROL $%1$02X'
        op[0x27] = 'RLA $%1$02X'
        op[0x28] = 'PLP'
        op[0x29] = 'AND #$%1$02X'
        op[0x2A] = 'ROL'
        op[0x2B] = 'ANC #$%1$02X'
        op[0x2C] = 'BIT $%2$02X%1$02X'
        op[0x2D] = 'AND $%2$02X%1$02X'
        op[0x2E] = 'ROL $%2$02X%1$02X'
        op[0x2F] = 'RLA $%2$02X%1$02X'
        op[0x30] = 'BMI $%3$02X'
        op[0x31] = 'AND ($%1$02X), y'
        op[0x32] = 'KIL'
        op[0x33] = 'RLA ($%1$02X), y'
        op[0x34] = 'NOP $%1$02X,x'
        op[0x35] = 'AND $%1$02X,x'
        op[0x36] = 'ROL $%1$02X,x'
        op[0x37] = 'RLA $%1$02X,x'
        op[0x38] = 'SEC'
        op[0x39] = 'AND $%2$02X%1$02X,y'
        op[0x3A] = 'NOP'
        op[0x3B] = 'RLA $%2$02X%1$02X,y'
        op[0x3C] = 'NOP $%2$02X%1$02X,x'
        op[0x3D] = 'AND $%2$02X%1$02X,x'
        op[0x3E] = 'ROL $%2$02X%1$02X,x'
        op[0x3F] = 'RLA $%2$02X%1$02X,x'
        op[0x40] = 'RTI'
        op[0x41] = 'EOR $(%2$02X%1$02X,x)'
        op[0x42] = 'KIL'
        op[0x43] = 'SRE $(%2$02X%1$02X,x)'
        op[0x44] = 'NOP $%1$02X'
        op[0x45] = 'EOR $%1$02X'
        op[0x46] = 'LSR $%1$02X'
        op[0x47] = 'SRE $%1$02X'
        op[0x48] = 'PHA'
        op[0x49] = 'EOR #$%1$02X'
        op[0x4A] = 'LSR'
        op[0x4B] = 'ALR #$%1$02X'
        op[0x4C] = 'JMP $%2$02X%1$02X'
        op[0x4D] = 'EOR $%2$02X%1$02X'
        op[0x4E] = 'LSR $%2$02X%1$02X'
        op[0x4F] = 'SRE $%2$02X%1$02X'
        op[0x50] = 'BVC $%3$02X'
        op[0x51] = 'EOR ($%1$02X), y'
        op[0x52] = 'KIL'
        op[0x53] = 'SRE ($%1$02X), y'
        op[0x54] = 'NOP $%1$02X,x'
        op[0x55] = 'EOR $%1$02X,x'
        op[0x56] = 'LSR $%1$02X,x'
        op[0x57] = 'SRE $%1$02X,x'
        op[0x58] = 'CLI'
        op[0x59] = 'EOR $%2$02X%1$02X,y'
        op[0x5A] = 'NOP'
        op[0x5B] = 'SRE $%2$02X%1$02X,y'
        op[0x5C] = 'NOP $%2$02X%1$02X,x'
        op[0x5D] = 'EOR $%2$02X%1$02X,x'
        op[0x5E] = 'LSR $%2$02X%1$02X,x'
        op[0x5F] = 'SRE $%2$02X%1$02X,x'
        op[0x60] = 'RTS'
        op[0x61] = 'ADC $(%2$02X%1$02X,x)'
        op[0x62] = 'KIL'
        op[0x63] = 'RRA $(%2$02X%1$02X,x)'
        op[0x64] = 'NOP $%1$02X'
        op[0x65] = 'ADC $%1$02X'
        op[0x66] = 'ROR $%1$02X'
        op[0x67] = 'RRA $%1$02X'
        op[0x68] = 'PLA'
        op[0x69] = 'ADC #$%1$02X'
        op[0x6A] = 'ROR'
        op[0x6B] = 'ARR #$%1$02X'
        op[0x6C] = 'JMP ($%2$02X%1$02X)'
        op[0x6D] = 'ADC $%2$02X%1$02X'
        op[0x6E] = 'ROR $%2$02X%1$02X'
        op[0x6F] = 'RRA $%2$02X%1$02X'
        op[0x70] = 'BVS $%3$02X'
        op[0x71] = 'ADC ($%1$02X), y'
        op[0x72] = 'KIL'
        op[0x73] = 'RRA ($%1$02X), y'
        op[0x74] = 'NOP $%1$02X,x'
        op[0x75] = 'ADC $%1$02X,x'
        op[0x76] = 'ROR $%1$02X,x'
        op[0x77] = 'RRA $%1$02X,x'
        op[0x78] = 'SEI'
        op[0x79] = 'ADC $%2$02X%1$02X,y'
        op[0x7A] = 'NOP'
        op[0x7B] = 'RRA $%2$02X%1$02X,y'
        op[0x7C] = 'NOP $%2$02X%1$02X,x'
        op[0x7D] = 'ADC $%2$02X%1$02X,x'
        op[0x7E] = 'ROR $%2$02X%1$02X,x'
        op[0x7F] = 'RRA $%2$02X%1$02X,x'
        op[0x80] = 'NOP #$%1$02X'
        op[0x81] = 'STA $(%2$02X%1$02X,x)'
        op[0x82] = 'NOP #$%1$02X'
        op[0x83] = 'SAX $(%2$02X%1$02X,x)'
        op[0x84] = 'STY $%1$02X'
        op[0x85] = 'STA $%1$02X'
        op[0x86] = 'STX $%1$02X'
        op[0x87] = 'SAX $%1$02X'
        op[0x88] = 'DEY'
        op[0x89] = 'NOP #$%1$02X'
        op[0x8A] = 'TXA'
        op[0x8B] = 'XAA #$%1$02X'
        op[0x8C] = 'STY $%2$02X%1$02X'
        op[0x8D] = 'STA $%2$02X%1$02X'
        op[0x8E] = 'STX $%2$02X%1$02X'
        op[0x8F] = 'SAX $%2$02X%1$02X'
        op[0x90] = 'BCC $%3$02X'
        op[0x91] = 'STA ($%1$02X), y'
        op[0x92] = 'KIL'
        op[0x93] = 'AHX ($%1$02X), y'
        op[0x94] = 'STY $%1$02X,x'
        op[0x95] = 'STA $%1$02X,x'
        op[0x96] = 'STX $%1$02X,y'
        op[0x97] = 'SAX $%1$02X,y'
        op[0x98] = 'TYA'
        op[0x99] = 'STA $%2$02X%1$02X,y'
        op[0x9A] = 'TXS'
        op[0x9B] = 'TAS $%2$02X%1$02X,y'
        op[0x9C] = 'SHY $%2$02X%1$02X,x'
        op[0x9D] = 'STA $%2$02X%1$02X,x'
        op[0x9E] = 'SHX $%2$02X%1$02X,y'
        op[0x9F] = 'AHX $%2$02X%1$02X,y'
        op[0xA0] = 'LDY #$%1$02X'
        op[0xA1] = 'LDA $(%2$02X%1$02X,x)'
        op[0xA2] = 'LDX #$%1$02X'
        op[0xA3] = 'LAX $(%2$02X%1$02X,x)'
        op[0xA4] = 'LDY $%1$02X'
        op[0xA5] = 'LDA $%1$02X'
        op[0xA6] = 'LDX $%1$02X'
        op[0xA7] = 'LAX $%1$02X'
        op[0xA8] = 'TAY'
        op[0xA9] = 'LDA #$%1$02X'
        op[0xAA] = 'TAX'
        op[0xAB] = 'LAX #$%1$02X'
        op[0xAC] = 'LDY $%2$02X%1$02X'
        op[0xAD] = 'LDA $%2$02X%1$02X'
        op[0xAE] = 'LDX $%2$02X%1$02X'
        op[0xAF] = 'LAX $%2$02X%1$02X'
        op[0xB0] = 'BCS $%3$02X'
        op[0xB1] = 'LDA ($%1$02X), y'
        op[0xB2] = 'KIL'
        op[0xB3] = 'LAX ($%1$02X), y'
        op[0xB4] = 'LDY $%1$02X,x'
        op[0xB5] = 'LDA $%1$02X,x'
        op[0xB6] = 'LDX $%1$02X,y'
        op[0xB7] = 'LAX $%1$02X,y'
        op[0xB8] = 'CLV'
        op[0xB9] = 'LDA $%2$02X%1$02X,y'
        op[0xBA] = 'TSX'
        op[0xBB] = 'LAS $%2$02X%1$02X,y'
        op[0xBC] = 'LDY $%2$02X%1$02X,x'
        op[0xBD] = 'LDA $%2$02X%1$02X,x'
        op[0xBE] = 'LDX $%2$02X%1$02X,y'
        op[0xBF] = 'LAX $%2$02X%1$02X,y'
        op[0xC0] = 'CPY #$%1$02X'
        op[0xC1] = 'CMP $(%2$02X%1$02X,x)'
        op[0xC2] = 'NOP #$%1$02X'
        op[0xC3] = 'DCP $(%2$02X%1$02X,x)'
        op[0xC4] = 'CPY $%1$02X'
        op[0xC5] = 'CMP $%1$02X'
        op[0xC6] = 'DEC $%1$02X'
        op[0xC7] = 'DCP $%1$02X'
        op[0xC8] = 'INY'
        op[0xC9] = 'CMP #$%1$02X'
        op[0xCA] = 'DEX'
        op[0xCB] = 'AXS #$%1$02X'
        op[0xCC] = 'CPY $%2$02X%1$02X'
        op[0xCD] = 'CMP $%2$02X%1$02X'
        op[0xCE] = 'DEC $%2$02X%1$02X'
        op[0xCF] = 'DCP $%2$02X%1$02X'
        op[0xD0] = 'BNE $%3$02X'
        op[0xD1] = 'CMP ($%1$02X), y'
        op[0xD2] = 'KIL'
        op[0xD3] = 'DCP ($%1$02X), y'
        op[0xD4] = 'NOP $%1$02X,x'
        op[0xD5] = 'CMP $%1$02X,x'
        op[0xD6] = 'DEC $%1$02X,x'
        op[0xD7] = 'DCP $%1$02X,x'
        op[0xD8] = 'CLD'
        op[0xD9] = 'CMP $%2$02X%1$02X,y'
        op[0xDA] = 'NOP'
        op[0xDB] = 'DCP $%2$02X%1$02X,y' // did i delete this line somehow?
        op[0xDC] = 'NOP $%2$02X%1$02X,x'
        op[0xDD] = 'CMP $%2$02X%1$02X,x'
        op[0xDE] = 'DEC $%2$02X%1$02X,x'
        op[0xDF] = 'DCP $%2$02X%1$02X,x'
        op[0xE0] = 'CPX #$%1$02X'
        op[0xE1] = 'SBC $(%2$02X%1$02X,x)'
        op[0xE2] = 'NOP #$%1$02X'
        op[0xE3] = 'ISC $(%2$02X%1$02X,x)'
        op[0xE4] = 'CPX $%1$02X'
        op[0xE5] = 'SBC $%1$02X'
        op[0xE6] = 'INC $%1$02X'
        op[0xE7] = 'ISC $%1$02X'
        op[0xE8] = 'INX'
        op[0xE9] = 'SBC #$%1$02X'
        op[0xEA] = 'NOP'
        op[0xEB] = 'SBC #$%1$02X'
        op[0xEC] = 'CPX $%2$02X%1$02X'
        op[0xED] = 'SBC $%2$02X%1$02X'
        op[0xEE] = 'INC $%2$02X%1$02X'
        op[0xEF] = 'ISC $%2$02X%1$02X'
        op[0xF0] = 'BEQ $%3$02X'
        op[0xF1] = 'SBC ($%1$02X), y'
        op[0xF2] = 'KIL'
        op[0xF3] = 'ISC ($%1$02X), y'
        op[0xF4] = 'NOP $%1$02X,x'
        op[0xF5] = 'SBC $%1$02X,x'
        op[0xF6] = 'INC $%1$02X,x'
        op[0xF7] = 'ISC $%1$02X,x'
        op[0xF8] = 'SED'
        op[0xF9] = 'SBC $%2$02X%1$02X,y'
        op[0xFA] = 'NOP'
        op[0xFB] = 'ISC $%2$02X%1$02X,y'
        op[0xFC] = 'NOP $%2$02X%1$02X,x'
        op[0xFD] = 'SBC $%2$02X%1$02X,x'
        op[0xFE] = 'INC $%2$02X%1$02X,x'
        op[0xFF] = 'ISC $%2$02X%1$02X,x'

        return op
        
    }

    private setflags(value: number): void {
        this.zeroFlag = value === 0
        this.negativeFlag = (value & Utils.BIT7) !== 0
    }

    // === 非法指令实现 ===
    
    private ahx(addr: number): void {
        const data = this.A & this.X & (addr >> 8) + 1 & 0xFF
        const tmp = addr - this.Y & 0xFF
        if (this.Y + tmp <= 0xFF) {
            this.ram.write(addr, data)
        }
        else {
            this.ram.write(addr, this.ram.read(addr))
        }
    }

    private alr(addr: number): void {
        this.and(addr)
        this.A = this.lsr_acc()
    }

    private anc(addr: number): void {
        this.and(addr)
        this.carryFlag = this.negativeFlag
    }

    private arr(addr: number): void {
        this.A = (this.ram.read(addr) & this.A) >> 1 | (this.carryFlag ? 0x80 : 0x00)
        this.setflags(this.A)
        this.carryFlag = (this.A & Utils.BIT6) !== 0
        this.overflowFlag = this.carryFlag !== ((this.A & Utils.BIT5) !== 0)
    }

    private axs(addr: number): void {
        this.X = (this.A & this.X) - this.ram.read(addr) & 0xff
        this.setflags(this.X)
        this.carryFlag = this.X >= 0
    }

    private dcp(regval: number, addr: number): void {
        this.dec(addr)
        this.cmp(regval, addr)
    }

    private las(addr: number): void {
        this.S &= this.ram.read(addr)
        this.A = this.X = this.S
        this.setflags(this.S)
    }

    private isc(addr: number): void {
        this.inc(addr)
        this.sbc(addr)
    }

    private rla(addr: number): void {
        this.rol_mem(addr)
        this.and(addr)
    }

    private rra(addr: number): void {
        this.ror_mem(addr)
        this.adc(addr)
    }

    private lax(addr: number): void {

        // LAX - Load A and X with memory value
        const value = this.ram.read(addr)
        this.A = value
        this.X = value
        this.setflags(value)
    }

    private sax(addr: number): void {

        // SAX - Store A AND X
        this.ram.write(addr, this.A & this.X)
    }

    private slo(addr: number): void {

        // SLO - Shift Left and OR with A
        this.asl_mem(addr)
        this.ora(addr)
    }

    private sre(addr: number): void {

        // SRE - Shift Right and EOR with A
        this.lsr_mem(addr)
        this.eor(addr)
    }

    private tas(addr: number): void {
        this.S = this.A & this.X
        const data = this.S & (addr >> 8) + 1 & 0xFF
        const tmp = addr - this.Y & 0xFF
        if (this.Y + tmp <= 0xFF) {
            this.ram.write(addr, data)
        }
        else {
            this.ram.write(addr, this.ram.read(addr))
        }
    }

    private shx(addr: number): void {

        // SHX - Store X AND high byte of address + 1
        const highByte = (addr >> 8) + 1 & 0xFF
        this.ram.write(addr, this.X & highByte)
    }

    private shy(addr: number): void {

        // SHY - Store Y AND high byte of address + 1
        const highByte = (addr >> 8) + 1 & 0xFF
        this.ram.write(addr, this.Y & highByte)
    }

    public getStatus(): string {
        return `A:${Utils.hex(this.A)} X:${Utils.hex(this.X)} Y:${Utils.hex(this.Y)} `
            + `P:${Utils.hex(this.flagstobyte())} SP:${Utils.hex(this.S)} `
            + `PC:${Utils.hex(this.PC)}`
    }

    // === 公共访问器 ===

    public getA(): number { return this.A }

    public getX(): number { return this.X }

    public getY(): number { return this.Y }

    public getS(): number { return this.S }

    public getPC(): number { return this.PC }

    public getP(): number {

        // 将标志位组合成P状态寄存器
        let p = 0
        if (this.carryFlag) p |= 0x01
        if (this.zeroFlag) p |= 0x02
        if (this.interruptsDisabled) p |= 0x04
        if (this.decimalModeFlag) p |= 0x08
        p |= 0x20 // bit 5 总是设置的
        if (this.overflowFlag) p |= 0x40
        if (this.negativeFlag) p |= 0x80

        return p
    }

    public setP(value: number): void {

        // 从P状态寄存器设置标志位
        this.carryFlag = (value & 0x01) !== 0
        this.zeroFlag = (value & 0x02) !== 0
        this.interruptsDisabled = (value & 0x04) !== 0
        this.decimalModeFlag = (value & 0x08) !== 0

        // bit 4 在BRK中使用，bit 5 总是1
        this.overflowFlag = (value & 0x40) !== 0
        this.negativeFlag = (value & 0x80) !== 0
    }

    public setCPUState(state: any): void {
        this.PC = state.PC
        this.A = state.A
        this.X = state.X
        this.Y = state.Y
        this.S = state.SP
        this.setP(state.P)
        this.cycles = state.cycles
    }

    public getCPUState(): any {
        return {
            PC: this.PC,
            A: this.A,
            X: this.X,
            Y: this.Y,
            SP: this.S,
            P: this.getP(),
            cycles: this.cycles,
        }
    }
    
    public getCycles(): number { return this.cycles }
    
    public setA(value: number): void { this.A = value & 0xff }

    public setX(value: number): void { this.X = value & 0xff }

    public setY(value: number): void { this.Y = value & 0xff }

    public setS(value: number): void { this.S = value & 0xff }

    public setPC(value: number): void { this.PC = value & 0xffff }

    // 调试方法：执行单条指令
    public debugExecuteInstruction(): void {
        const instr = this.ram.read(this.PC++)
        this.executeInstruction(instr)
    }

    // 调试方法：读取内存
    public debugRead(addr: number): number {
        return this.ram.read(addr)
    }

    public setNMI(value: boolean): void { this.nmi = value }
}
