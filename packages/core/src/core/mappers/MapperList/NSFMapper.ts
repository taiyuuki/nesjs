import { decompressArray } from 'src/core/utils'
import { Mapper } from '../Mapper'
import { BadMapperException, MirrorType, TVType, Utils } from '../../types'
import { Namco163SoundChip } from '../../audio/Namco163SoundChip'
import { VRC6SoundChip } from '../../audio/VRC6SoundChip'
import { VRC7SoundChip } from '../../audio/VRC7SoundChip'
import { Sunsoft5BSoundChip } from '../../audio/Sunsoft5BSoundChip'
import { MMC5SoundChip } from '../../audio/MMC5SoundChip'
import { FDSSoundChip } from '../../audio/FDSSoundChip'

export default class NSFMapper extends Mapper {
    private loadAddr = 0
    private initAddr = 0
    private playAddr = 0
    private song = 0
    private numSongs = 0

    public nsfBanking = false
    public nsfStartBanks: number[] = new Array(10).fill(0)
    public nsfBanks: number[] = new Array(10).fill(0)
    private sndchip = 0

    private vrc6 = false
    private vrc7 = false
    private mmc5 = false
    private n163 = false
    private s5b = false
    private hasInitSound = false
    private fds = false

    private n163autoincrement = false
    private n163soundAddr = 0
    private mmc5multiplier1 = 0
    private mmc5multiplier2 = 0
    private vrc7regaddr = 0
    private s5bSoundCommand = 0

    private n163Audio?: Namco163SoundChip
    private vrc6Audio?: VRC6SoundChip
    private vrc7Audio?: VRC7SoundChip
    private s5bAudio?: Sunsoft5BSoundChip
    private mmc5Audio?: MMC5SoundChip
    private fdsAudio?: FDSSoundChip

    // UI/控制用
    private control = 0
    private prevcontrol = 0
    private unfinishedcounter = 0
    private time = 4
    private playFrames = 0

    public override loadROM(): void {

        // 解析 NSF 头
        this.loader.parseHeader()

        this.prgsize = this.loader.prgsize
        this.mappertype = this.loader.mappertype // 对于 NSF，这里应为 -1
        this.prgoff = 0

        // 读取 0x70-0x77 的起始 bank 配置，非零表示启用 banking
        for (let i = 0x70; i < 0x78; ++i) {
            if (this.loader.header[i] !== 0) {
                this.nsfBanking = true
                this.nsfStartBanks[i - 0x70] = this.loader.header[i]
            }
        }

        // 从头部读取各项地址/曲目信息
        this.loadAddr = this.loader.header[0x08] + (this.loader.header[0x09] << 8)
        this.initAddr = this.loader.header[0x0a] + (this.loader.header[0x0b] << 8)
        this.playAddr = this.loader.header[0x0c] + (this.loader.header[0x0d] << 8)
        this.numSongs = this.loader.header[6] - 1
        this.song = this.loader.header[7] - 1

        // TV 制式
        if (this.loader.header[0x7a] === 1) {
            this.region = TVType.PAL
        }
        else {
            this.region = TVType.NTSC
        }

        this.chroff = 0
        this.chrsize = 0
        this.scrolltype = MirrorType.V_MIRROR
        this.sndchip = this.loader.header[0x7B]

        if (!this.nsfBanking && this.loadAddr < 0x8000) {
            throw new BadMapperException('NSF with no banking loading low')
        }

        // 按照 4KB 对齐做 padding，并把 NSF 负载拷贝到大 PRG 空间
        const paddingLen = this.nsfBanking ? this.loadAddr & 0x0fff : this.loadAddr - 0x8000
        this.prg = new Array(1024 * 1024).fill(0)
        const payload = this.loader.load(this.loader.romlen(), 0)
        for (let i = 0; i < payload.length; i++) {
            this.prg[paddingLen + i] = payload[i]
        }

        this.crc = NSFMapper.crc32(this.prg)

        // NSF 使用 CHR-RAM
        this.haschrram = true
        this.chrsize = 8192

        // this.chr = new Array(8192).fill(0)

        // prg_map: FDS 扩展音频时需要 40 槽位（6000-7FFF 也用 banks）
        this.prg_map = new Array((this.sndchip & Utils.BIT2) === 0 ? 32 : 40)

        if (!this.nsfBanking) {
            for (let i = 0; i < 8; ++i) this.nsfStartBanks[i] = i
        }

        // FDS 特例：为 0x6000-0x7FFF 复制 2 个 bank
        if ((this.sndchip & Utils.BIT2) !== 0) {
            this.nsfStartBanks[8] = this.nsfStartBanks[6]
            this.nsfStartBanks[9] = this.nsfStartBanks[7]
        }

        // CHR 映射初始化
        this.chr_map = new Array(8)
        for (let i = 0; i < 8; ++i) { 
            this.chr_map[i] = 1024 * i & this.chrsize - 1 
        }

        // 初始化NT表内存与镜像（PPU稍后由 NES 注入）
        this.pput0.fill(0x00)
        this.setmirroring(this.scrolltype)

        this.chr = decompressArray({
            _compressed: 'rle',
            _originalLength: 8192,
            _data: [
                0, 255, 0, 255, 0, 18, -1, 24, 60, 3, -4, 24, 24, 0, 24, 0, 8, 108,
                3, 0, 13, -7, 108, 108, 254, 108, 254, 108, 108, 0, 9, -7, 48, 124, 192,
                120, 12, 248, 48, 0, 10, -6, 198, 204, 24, 48, 102, 198, 0, 9, -7,
                56, 108, 56, 118, 220, 204, 118, 0, 9, -3, 96, 96, 192, 0, 13, -2,
                24, 48, 96, 3, -2, 48, 24, 0, 9, -2, 96, 48, 24, 3, -2, 48,
                96, 0, 10, -5, 102, 60, 255, 60, 102, 0, 11, -5, 48, 48, 252, 48,
                48, 0, 15, -3, 48, 48, 96, 0, 11, -1, 252, 0, 17, -2, 48, 48,
                0, 9, -7, 6, 12, 24, 48, 96, 192, 128, 0, 9, -2, 56, 76, 198,
                3, -2, 100, 56, 0, 9, -2, 24, 56, 24, 4, -1, 126, 0, 9, -7,
                124, 198, 14, 60, 120, 224, 254, 0, 9, -7, 126, 12, 24, 60, 6, 198,
                124, 0, 9, -7, 28, 60, 108, 204, 254, 12, 12, 0, 9, -7, 252, 192, 252,
                6, 6, 198, 124, 0, 9, -7, 60, 96, 192, 252, 198, 198, 124, 0, 9, -4,
                254, 198, 12, 24, 48, 3, 0, 9, -7, 124, 198, 198, 124, 198, 198, 124, 0,
                9, -7, 124, 198, 198, 126, 6, 12, 120, 0, 10, -6, 48, 48, 0, 0, 48,
                48, 0, 10, -7, 48, 48, 0, 0, 48, 48, 96, 0, 8, -7, 24, 48, 96,
                192, 96, 48, 24, 0, 11, -4, 252, 0, 0, 252, 0, 10, -7, 96, 48, 24,
                12, 24, 48, 96, 0, 9, -7, 120, 204, 12, 24, 48, 0, 48, 0, 9, -2,
                124, 198, 222, 3, -2, 192, 120, 0, 9, -7, 56, 108, 198, 198, 254, 198, 198,
                0, 9, -7, 252, 198, 198, 252, 198, 198, 252, 0, 9, -2, 60, 102, 192, 3,
                -2, 102, 60, 0, 9, -2, 248, 204, 198, 3, -2, 204, 248, 0, 9, -7, 254,
                192, 192, 252, 192, 192, 254, 0, 9, -4, 254, 192, 192, 252, 192, 3, 0, 9,
                -7, 62, 96, 192, 206, 198, 102, 62, 0, 9, 198, 3, -1, 254, 198, 3, 0,
                9, -1, 126, 24, 5, -1, 126, 0, 9, -1, 30, 6, 3, -3, 198, 198, 124,
                0, 9, -7, 198, 204, 216, 240, 248, 220, 206, 0, 9, 96, 6, -1, 126, 0,
                9, -7, 198, 238, 254, 254, 214, 198, 198, 0, 9, -7, 198, 230, 246, 254, 222,
                206, 198, 0, 9, -1, 124, 198, 5, -1, 124, 0, 9, -1, 252, 198, 3, -3,
                252, 192, 192, 0, 9, -1, 124, 198, 3, -3, 222, 204, 122, 0, 9, -7, 252,
                198, 198, 206, 248, 220, 206, 0, 9, -7, 120, 204, 192, 124, 6, 198, 124, 0,
                9, -1, 126, 24, 6, 0, 9, 198, 6, -1, 124, 0, 9, 198, 3, -4, 238,
                124, 56, 16, 0, 9, -7, 198, 198, 214, 254, 254, 238, 198, 0, 9, -7, 198,
                238, 124, 56, 124, 238, 198, 0, 9, 102, 3, -1, 60, 24, 3, 0, 9, -7,
                254, 14, 28, 56, 112, 224, 254, 0, 9, -1, 120, 96, 5, -1, 120, 0, 9,
                -7, 192, 96, 48, 24, 12, 6, 2, 0, 9, -1, 120, 24, 5, -1, 120, 0,
                9, -4, 16, 56, 108, 198, 0, 19, -1, 255, 0, 8, -3, 48, 48, 24, 0,
                15, -1, 60, 102, 3, -1, 59, 0, 9, -3, 96, 96, 124, 102, 3, -1, 124,
                0, 11, -1, 62, 96, 3, -1, 62, 0, 9, -3, 6, 6, 62, 102, 3, -1,
                62, 0, 11, -5, 60, 102, 126, 96, 62, 0, 9, -4, 14, 24, 24, 126, 24,
                3, 0, 11, -6, 62, 102, 102, 62, 6, 60, 0, 8, 96, 3, -1, 124, 102,
                3, 0, 10, -2, 24, 0, 24, 4, 0, 10, -2, 6, 0, 6, 3, -2, 102,
                60, 0, 8, -7, 96, 96, 98, 100, 104, 124, 102, 0, 9, 24, 7, 0, 11,
                -1, 118, 107, 4, 0, 11, -1, 124, 102, 4, 0, 11, -1, 60, 102, 3, -1,
                60, 0, 11, -6, 124, 102, 102, 124, 96, 96, 0, 10, -6, 62, 102, 102, 62,
                6, 6, 0, 10, -2, 110, 112, 96, 3, 0, 11, -5, 60, 64, 60, 6, 124,
                0, 9, -3, 48, 48, 252, 48, 3, -1, 28, 0, 11, 102, 4, -1, 60, 0,
                11, 102, 3, -2, 36, 24, 0, 11, -1, 99, 107, 3, -1, 54, 0, 11, -5,
                99, 54, 28, 54, 99, 0, 11, -6, 102, 102, 44, 24, 48, 96, 0, 10, -5,
                126, 12, 24, 48, 126, 0, 9, -7, 28, 48, 48, 224, 48, 48, 28, 0, 9,
                24, 3, -1, 0, 24, 3, 0, 9, -7, 224, 48, 48, 28, 48, 48, 224, 0,
                9, -2, 118, 220, 0, 15, -6, 16, 56, 108, 198, 198, 254, 0, 255, 0, 255,
                0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0,
                255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255,
                0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 33,
            ],
        })
    }

    public override init(): void {

        // 初始化 CPU/内存，遵循 NSF 规范
        this.nsfBanks = this.nsfStartBanks.slice()
        this.setBanks()
        
        // NSF 初始化
        if (this.ppu) {
            this.ppu.pal[0] = 0x3f
            const col = 0x20 + this.crc % 12
            this.ppu.pal[1] = col
            this.ppu.pal[2] = col
            this.ppu.pal[3] = col
        }

        // 清 RAM 0x0000-0x07FF
        if (this.cpuram) {
            for (let i = 0; i <= 0x7ff; ++i) this.cpuram.write(i, 0)

            // 初始化 APU 寄存器
            for (let i = 0x4000; i <= 0x4013; ++i) this.cpuram.write(i, 0)
            this.cpuram.write(0x4015, 0x0f)
            this.cpuram.write(0x4017, 0x40)
        }

        // 设置 CPU 状态并跳转到 init 例程
        if (this.cpu) {

            // 确保退出空闲状态（CPU 在 $FFFB 的自跳转会将 idle 置为 true）
            this.cpu.idle = false
            this.cpu.push(0xff)
            this.cpu.push(0xfa)
            this.cpu.setPC(this.initAddr)
            this.cpu.interrupt = -99999

            // A 采用 0 基曲目号
            this.cpu.setA(this.song)
            this.cpu.setX(this.region === TVType.PAL ? 0x01 : 0x00)
            
            // 预设 CPU 寄存器与入口
        }

        if (!this.hasInitSound) {
            this.setSoundChip()
            
            if (this.cpuram?.apu) {
                this.hasInitSound = true
            }
        }

        // 清屏
        this.clearScreen()
        
        this.drawEnhancedInterface()

        // 播放计时：初始化为 00:00:00
        this.playFrames = 0

        // 切歌/重置时，等待 init 返回：清零等待计数，避免本帧继续调用上一曲目的 play
        this.unfinishedcounter = 0

        // 非 FDS 情况下清 0x6000-0x7FFF
        if (!this.fds && this.cpuram) {
            for (let i = 0x6000; i <= 0x7fff; ++i) {
                this.cpuram.write(i, 0) 
            }
        }
    }

    public override reset(): void {

        // 复位为默认曲目 - 模拟切歌行为
        this.song = this.loader.header[7] - 1
        
        // 重置音频初始化状态，确保音频芯片被重新初始化
        this.hasInitSound = false
        
        // 只调用init()，不额外设置PC，完全模拟切歌时的行为
        this.init()
        
        // 注意：APU重置现在由NES.reset()统一处理
    }

    public override cartWrite(addr: number, data: number): void {

        // 处理外设与银行寄存器写入
        if (this.n163 && addr === 0xF800) {
            this.n163autoincrement = (data & Utils.BIT7) !== 0
            this.n163soundAddr = data & 0x7f
        }
        else if (this.n163 && addr === 0x4800) {
            this.n163Audio?.write(this.n163soundAddr, data)
            if (this.n163autoincrement) this.n163soundAddr = this.n163soundAddr + 1 & 0x7f
        }
        else if (this.s5b && addr === 0xE000) {
            this.s5bAudio?.write(this.s5bSoundCommand, data)
        }
        else if (this.s5b && addr === 0xC000) {
            this.s5bSoundCommand = data & 0xF
        }
        else if (this.vrc6 && addr >= 0xB000 && addr <= 0xB002) {
            this.vrc6Audio?.write((addr & 0xf000) + (addr & 3), data)
        }
        else if (this.vrc6 && addr >= 0xA000 && addr <= 0xA002) {
            this.vrc6Audio?.write((addr & 0xf000) + (addr & 3), data)
        }
        else if (this.vrc7 && addr === 0x9030) {
            if (this.vrc7Audio) this.vrc7Audio.write(this.vrc7regaddr, data)
        }
        else if (this.vrc7 && addr === 0x9010) {
            this.vrc7regaddr = data
        }
        else if (this.vrc6 && addr >= 0x9000 && addr <= 0x9002) {
            this.vrc6Audio?.write((addr & 0xf000) + (addr & 3), data)
        }
        else if (this.fds && this.nsfBanking && addr >= 0x6000) {
            if (addr < 0x8000) {
                const fuuu = this.prg_map[(addr - 0x6000 >> 10) + 32] + (addr & 1023)
                this.prg[fuuu] = data
            }
            else {
                const fuuu = this.prg_map[(addr & 0x7fff) >> 10] + (addr & 1023)
                this.prg[fuuu] = data
            }
        }
        else if (this.fds && !this.nsfBanking && addr >= 0x6000) {
            if (addr < 0x8000) {
                this.prgram[addr - 0x6000] = data
            }
            else {
                const fuuu = this.prg_map[(addr & 0x7fff) >> 10] + (addr & 1023)
                this.prg[fuuu] = data
            }
        }
        else if (addr >= 0x6000 && addr < 0x8000) {
            this.prgram[addr & 0x1fff] = data
        }
        else if (addr >= 0x5ff8 && addr < 0x6000) {
            this.nsfBanks[addr - 0x5ff8] = data
            this.setBanks()
        }
        else if (this.fds && this.nsfBanking && addr === 0x5ff6) {
            this.nsfBanks[8] = data
            this.setBanks()
        }
        else if (this.fds && this.nsfBanking && addr >= 0x5ff7) {
            this.nsfBanks[9] = data
            this.setBanks()
        }
        else if (this.mmc5 && addr >= 0x5C00 && addr <= 0x5FF5) {
            this.prgram[addr - 0x5C00] = data // ExRAM 模拟
        }
        else if (this.mmc5 && addr === 0x5206) {
            this.mmc5multiplier2 = data
        }
        else if (this.mmc5 && addr === 0x5205) {
            this.mmc5multiplier1 = data
        }
        else if (this.mmc5 && addr >= 0x5000 && addr <= 0x5015) {
            this.mmc5Audio?.write(addr - 0x5000, data)
        }
        else if (this.fds && addr >= 0x4040 && addr <= 0x4092) {
            this.fdsAudio?.write(addr, data)
        }
    }

    public override cartRead(addr: number): number {
        
        // 读取外设与银行寄存器
        if (addr >= 0x8000) {
            if (addr > 0xfffa) {

                // 固定返回向量，确保执行落入 $FFFB
                switch (addr) {
                    case 0xfffb: return 0x4c // JMP abs
                    case 0xfffc: return 0xfb
                    case 0xfffd: return 0xff
                    default: return 0x00
                }
            }
            const fuuu = this.prg_map[(addr & 0x7fff) >> 10] + (addr & 1023)

            return this.prg[fuuu]
        }
        else if (addr >= 0x6000 && this.hasprgram) {
            if (this.fds && this.nsfBanking) {
                const fuuu = this.prg_map[(addr - 0x6000 >> 10) + 32] + (addr & 1023)

                return this.prg[fuuu]
            }
            else {
                return this.prgram[addr & 0x1fff]
            }
        }
        else if (addr >= 0x5ff8) {
            return this.nsfBanks[addr - 0x5ff8]
        }
        else if (this.fds && this.nsfBanking && addr === 0x5ff6) {
            return this.nsfBanks[8]
        }
        else if (this.fds && this.nsfBanking && addr === 0x5ff7) {
            return this.nsfBanks[9]
        }
        else if (this.mmc5 && addr >= 0x5C00) {
            return this.prgram[addr - 0x5C00]
        }
        else if (this.mmc5 && addr === 0x5206) {
            return this.mmc5multiplier1 * this.mmc5multiplier2 >> 8 & 0xff
        }
        else if (this.mmc5 && addr === 0x5205) {
            return this.mmc5multiplier1 * this.mmc5multiplier2 & 0xff
        }
        else if (this.mmc5 && addr === 0x5015) {
            return this.mmc5Audio?.status() ?? 0
        }
        else if (this.n163 && addr === 0x4800) {
            const retval = this.n163Audio ? this.n163Audio.read(this.n163soundAddr) : 0
            if (this.n163autoincrement) this.n163soundAddr = this.n163soundAddr + 1 & 0x7f

            return retval
        }
        else if (this.fds && addr >= 0x4040 && addr < 0x4093) {
            return this.fdsAudio ? this.fdsAudio.read(addr) : 0x40
        }

        return addr >> 8
    }

    public override notifyscanline(scanline: number): void {

        if (scanline === 240) {

            if (this.cpu) {
                if (this.cpu.getPC() === 0xFFFB) {
                    this.unfinishedcounter = this.time
                }
                else if (this.unfinishedcounter < this.time) {
                    
                    // init 仍未返回，最多等待 time 帧
                    ++this.unfinishedcounter
                    
                    return
                }
            }

            // 启用渲染
            if (this.ppu) {
                this.ppu.write(6, 0)
                this.ppu.write(6, 0)
                this.ppu.write(5, 0) 
                this.ppu.write(0, 0)
                this.ppu.write(1, Utils.BIT1 | Utils.BIT3 | Utils.BIT4)
            }
            this.updateTimeDisplay()

            // 读取控制器
            this.prevcontrol = this.control
            this.control = 0
            if (this.cpuram) {
                this.cpuram.write(0x4016, 1)
                this.cpuram.write(0x4016, 0)
                for (let i = 0; i < 8; ++i) {

                    // CPURAM.read(0x4016) -> APU.read(0x16)
                    const v = this.cpuram.read(0x4016)
                    this.control = (this.control << 1) + ((v & 3) === 0 ? 0 : 1)
                }
            }

            // 切换曲目：A(下一首)/B(上一首)
            const nextPressed = (this.control & 0x80) !== 0 && (this.prevcontrol & 0x80) === 0
            const prevPressed = (this.control & 0x40) !== 0 && (this.prevcontrol & 0x40) === 0
            if (nextPressed) {
                ++this.song
                if (this.song > this.numSongs) this.song = 0
                this.init()
            }
            else if (prevPressed) {
                --this.song
                if (this.song < 0) this.song = this.numSongs
                this.init()
            }
            
            if (this.cpu && this.unfinishedcounter >= this.time) {
                const ret = this.cpu.getPC() - 1

                // 清除 idle，避免 CPU 因自跳转而停在空闲态
                this.cpu.idle = false
                this.cpu.push(ret >> 8)
                this.cpu.push(ret & 0xff)
                this.cpu.setPC(this.playAddr)
            }
        }
    }

    public override getROMInfo(): string {
        return 'NSF INFO:\n'
            + `Size:     ${Math.floor(this.loader.romlen() / 1024)} K\n`
            + `Expansion Sound:  ${this.expSound()}\n`
            + `Track: ${this.song + 1} / ${this.numSongs + 1}\n`
            + `Load Address:  ${Utils.hex(this.loadAddr)}\n`
            + `Init Address:  ${Utils.hex(this.initAddr)}\n`
            + `Play Address:  ${Utils.hex(this.playAddr)}\n`
            + `Banking?      ${this.nsfBanking ? 'Yes' : 'No'}\n`
            + `CRC:          ${Utils.hex(this.crc)}`
    }

    private expSound(): string {
        const chips: string[] = []
        if (this.vrc6) chips.push('VRC6')
        if (this.vrc7) chips.push('VRC7')
        if (this.n163) chips.push('Namco 163')
        if (this.mmc5) chips.push('MMC5')
        if (this.s5b) chips.push('Sunsoft 5B')
        if (this.fds) chips.push('FDS')

        return chips.length > 0 ? chips.join(' ') : 'None'
    }

    private getDetailedChipInfo(): { primary: string; secondary?: string } {
        const expansionChips: string[] = []

        if (this.vrc6) expansionChips.push('VRC6')
        if (this.vrc7) expansionChips.push('VRC7')
        if (this.n163) expansionChips.push('Namco163')
        if (this.mmc5) expansionChips.push('MMC5')
        if (this.s5b) expansionChips.push('Sunsoft5B')
        if (this.fds) expansionChips.push('FDS')

        const primary = expansionChips.length > 0 
            ? `APU + ${expansionChips.join(', ')}` 
            : 'Standard APU Only'

        return { primary }
    }

    private setBanks(): void {
        for (let i = 0; i < this.prg_map.length; ++i) {
            const bank4k = this.nsfBanks[Math.floor(i / 4)] | 0
            this.prg_map[i] = 4096 * bank4k + 1024 * (i % 4)
            if (this.prg_map[i] >= this.prg.length) {
                this.prg_map[i] %= this.prg.length
            }
        }
    }

    private setSoundChip(): void {
        const apu = this.cpuram?.apu
        if (!apu) return

        if ((this.sndchip & Utils.BIT0) !== 0) {
            this.vrc6 = true
            this.vrc6Audio = new VRC6SoundChip()
            apu.addExpnSound(this.vrc6Audio)
        }
        if ((this.sndchip & Utils.BIT1) !== 0) {
            this.vrc7 = true
            this.vrc7Audio = new VRC7SoundChip()
            apu.addExpnSound(this.vrc7Audio)
        }
        if ((this.sndchip & Utils.BIT2) !== 0) {
            this.fds = true
            this.fdsAudio = new FDSSoundChip()
            apu.addExpnSound(this.fdsAudio)
        }
        if ((this.sndchip & Utils.BIT3) !== 0) {
            this.mmc5 = true
            this.mmc5Audio = new MMC5SoundChip()
            apu.addExpnSound(this.mmc5Audio)
        }
        if ((this.sndchip & Utils.BIT4) !== 0) {
            this.n163 = true
            this.n163Audio = new Namco163SoundChip()
            apu.addExpnSound(this.n163Audio)
        }
        if ((this.sndchip & Utils.BIT5) !== 0) {
            this.s5b = true
            this.s5bAudio = new Sunsoft5BSoundChip()
            apu.addExpnSound(this.s5bAudio)
        }
    }

    private writeTracks() {
        const cur = `Track ${`${this.song + 1}`.padStart(2, '0')} / ${`${this.numSongs + 1}`.padStart(2, '0')}`
        this.centerText(17, cur)
    }

    private drawEnhancedInterface(): void {

        // 读取 NSF 头中的 Title/Artist/Copyright（各 32 字节，起始于 0x0E）
        const title = this.getHeaderString(0x0E, 32) || 'Untitled'
        const artist = this.getHeaderString(0x2E, 32) || 'Unknown Artist'
        const copyright = this.getHeaderString(0x4E, 32) || 'Unknown Copyright'

        // 绘制外边框，避开边界8像素区域
        this.drawBorder()
        
        // 头部标题区域
        // this.drawBox(2, 3, 28, 4)
        this.centerText(4, 'NES SOUND FORMAT PLAYER')
        this.centerText(5, '==========================')
        
        // 歌曲信息区域
        this.drawBox(2, 8, 28, 5)
        this.centerText(9, title.length > 23 ? `${title.substring(0, 23)}...` : title)
        this.centerText(10, artist.length > 23 ? `${artist.substring(0, 23)}...` : artist)
        this.centerText(11, copyright.length > 23 ? `${copyright.substring(0, 23)}...` : copyright)
        
        // 播放状态区域
        this.drawBox(2, 14, 28, 6)
        this.centerText(15, 'PLAYBACK STATUS')
        
        // 音频芯片信息区域  
        this.drawBox(2, 21, 28, 4)
        this.centerText(22, 'SOUND CHIPS')
        const chipInfo = this.getDetailedChipInfo()
        this.centerText(23, chipInfo.primary)
        
        // 控制提示区域
        this.centerText(26, 'B: Prev          A: Next')
    }

    private drawBorder(): void {

        // 绘制边框，下边框上移一行到第28行
        for (let col = 1; col < 31; col++) {
            this.writeText(1, col, '#')
            this.writeText(28, col, '#')
        }
        for (let row = 2; row < 28; row++) {
            this.writeText(row, 1, '#')
            this.writeText(row, 30, '#')
        }

        // 四个角
        // this.writeText(1, 1, '#')
        // this.writeText(1, 30, '#')
        // this.writeText(28, 1, '#')
        // this.writeText(28, 30, '#')
    }

    private drawBox(x: number, y: number, width: number, height: number): void {

        // 绘制矩形框，使用简单ASCII字符
        for (let col = x; col < x + width; col++) {
            this.writeText(y, col, '-')
            this.writeText(y + height - 1, col, '-')
        }

        // for (let row = y + 1; row < y + height - 1; row++) {
        //     this.writeText(row, x, '|')
        //     this.writeText(row, x + width - 1, '|')
        // }

        // 四个角
        // this.writeText(y, x, '+')
        // this.writeText(y, x + width - 1, '+')
        // this.writeText(y + height - 1, x, '+')
        // this.writeText(y + height - 1, x + width - 1, '+')
    }

    private drawProgressBar(row: number, progress: number): void {
        const barWidth = 22
        const filledWidth = Math.floor(progress * barWidth)
        
        this.writeText(row, 4, '[')
        for (let i = 0; i < barWidth; i++) {
            this.writeText(row, 5 + i, i < filledWidth ? '#' : '-')
        }
        this.writeText(row, 5 + barWidth, ']')
    }

    private animatedChars = ['*', 'o', '.', 'o']
    private animFrame = 0

    private getAnimatedMusicNote(): string {
        return this.animatedChars[Math.floor(this.animFrame / 15) % this.animatedChars.length]
    }

    private getPlayingStatusText(): string {
        const statusTexts = [' Music Playing   ', ' Music Playing.  ', ' Music Playing.. ', ' Music Playing...']
        
        return statusTexts[Math.floor(this.animFrame / 30) % statusTexts.length]
    }

    // private drawVolumeIndicators(): void {

    //     // 在播放状态区域显示音量指示器
    //     const channels = this.getChannelLevels()
    //     const channelNames = ['P1', 'P2', 'TR', 'NO']
        
    //     for (let i = 0; i < Math.min(channels.length, channelNames.length); i++) {
    //         const level = channels[i]
    //         const col = 4 + i * 6
            
    //         // 显示通道名称
    //         this.writeText(16, col, channelNames[i])
            
    //         // 显示音量条，使用简单ASCII字符
    //         const barChars = level > 0.7 ? '###' : level > 0.4 ? '##-' : level > 0.1 ? '#--' : '---'
    //         this.writeText(16, col, barChars)
    //     }
    // }

    // private drawAudioSpectrum(): void {

    //     // 简单的频谱可视化，基于 APU 寄存器状态
    //     if (!this.cpuram) return

    //     const spectrumRow = 20
    //     const spectrumStart = 6
    //     const spectrumWidth = 20

    //     // 清除之前的频谱显示
    //     for (let i = 0; i < spectrumWidth; i++) {
    //         this.writeText(spectrumRow, spectrumStart + i, ' ')
    //     }

    //     // 基于当前 APU 通道状态绘制简单频谱
    //     const channels = this.getChannelLevels()
        
    //     for (let i = 0; i < Math.min(channels.length, spectrumWidth / 4); i++) {
    //         const level = channels[i]
    //         const barHeight = Math.min(3, Math.floor(level * 4))
    //         const startPos = spectrumStart + i * 5

    //         // 绘制每个通道的音量条，使用简单字符
    //         for (let h = 0; h < barHeight; h++) {
    //             const char = h === 0 ? '_' : h === 1 ? '=' : '#'
    //             this.writeText(spectrumRow, startPos + h, char)
    //         }
            
    //         if (level > 0) {
    //             this.writeText(spectrumRow, startPos + 3, '*')
    //         }
    //     }
    // }

    // private getChannelLevels(): number[] {

    //     // 读取 APU 寄存器获取各通道状态
    //     if (!this.cpuram) return [0, 0, 0, 0]

    //     const levels: number[] = []
        
    //     // Pulse 1 (0x4000-0x4003)
    //     const pulse1Vol = this.cpuram.read(0x4000) & 0x0F
    //     const pulse1Enable = (this.cpuram.read(0x4015) & 0x01) !== 0
    //     levels.push(pulse1Enable ? pulse1Vol / 15 : 0)

    //     // Pulse 2 (0x4004-0x4007)
    //     const pulse2Vol = this.cpuram.read(0x4004) & 0x0F
    //     const pulse2Enable = (this.cpuram.read(0x4015) & 0x02) !== 0
    //     levels.push(pulse2Enable ? pulse2Vol / 15 : 0)

    //     // Triangle (0x4008-0x400B)
    //     const triangleEnable = (this.cpuram.read(0x4015) & 0x04) !== 0
    //     const triangleLinear = this.cpuram.read(0x4008) & 0x7F
    //     levels.push(triangleEnable && triangleLinear > 0 ? 0.8 : 0)

    //     // Noise (0x400C-0x400F)
    //     const noiseVol = this.cpuram.read(0x400C) & 0x0F
    //     const noiseEnable = (this.cpuram.read(0x4015) & 0x08) !== 0
    //     levels.push(noiseEnable ? noiseVol / 15 : 0)

    //     return levels
    // }

    private getFps(): number {
        return this.region === TVType.PAL ? 50 : 60
    }

    private formatTime(frames: number): string {
        const fps = this.getFps()
        const totalSec = Math.floor(frames / fps)
        const ss = totalSec % 60
        const mm = Math.floor(totalSec / 60) % 60
        const hh = Math.floor(totalSec / 3600)

        const pad2 = (n: number) => n.toString().padStart(2, '0')

        return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`
    }

    private updateTimeDisplay(): void {

        // 帧计数增加
        this.playFrames++
        
        // 更新动画帧计数
        this.animFrame++

        // 将时间置于播放状态区域内
        const timeStr = this.formatTime(this.playFrames)
        this.centerText(16, `Time: ${timeStr}`)
        
        // 显示当前曲目信息
        this.writeTracks()
        
        // 显示播放状态动画（避免重叠）
        const musicNote = this.getAnimatedMusicNote()
        const playingText = this.getPlayingStatusText()
        this.writeText(18, 4, `${musicNote} ${playingText}`)
        this.writeText(18, 27, `${musicNote}`)
        
        // 绘制简单的进度条效果（基于播放时间的秒数）
        const fps = this.getFps()
        const cycleFrames = fps * 10
        const progress = this.playFrames % cycleFrames / cycleFrames
        this.drawProgressBar(19, progress)
    }

    private clearScreen(): void {

        // 使用空格(0x20)填充 32x30 名表区域
        for (let r = 0; r < 30; ++r) {
            for (let c = 0; c < 32; ++c) {
                this.pput0[r * 32 + c] = 0x20
            }
        }
    }

    private writeText(row: number, col: number, text: string): void {
        if (!this.pput0) return
        const r = Math.max(0, Math.min(29, row | 0))
        let c = Math.max(0, Math.min(31, col | 0))
        for (let i = 0; i < text.length && c < 32; ++i, ++c) {
            const ch = text.charCodeAt(i) & 0xff
            this.pput0[r * 32 + c] = ch
        }
    }

    private centerText(row: number, text: string): void {
        const startCol = Math.max(0, Math.floor((32 - text.length) / 2))
        this.writeText(row, startCol, text)
    }

    private drawSeparator(row: number, ch: string = '-'): void {
        const sep = ch.repeat(32).slice(0, 32)
        this.writeText(row, 0, sep)
    }

    private getHeaderString(offset: number, length: number): string {
        const end = Math.min(this.loader.header.length, offset + length)
        let out = ''
        for (let i = offset; i < end; ++i) {
            const b = this.loader.header[i]
            if (b === 0) break
            out += String.fromCharCode(b)
        }

        return out.trim()
    }
}
