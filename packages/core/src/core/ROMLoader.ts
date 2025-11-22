
import { BadMapperException, MirrorType, TVType, Utils } from './types'

export class ROMLoader {

    public prgsize: number = 0
    public chrsize: number = 0
    public scrolltype: MirrorType = MirrorType.H_MIRROR
    public tvtype: TVType = TVType.NTSC
    public mappertype: number = 0
    public submapper: number = 0
    public prgoff: number = 0
    public chroff: number = 0
    public savesram: boolean = false
    public header: Uint8Array = new Uint8Array()
    private readonly romData: Uint8Array

    // FDS 专用字段
    public isFDS: boolean = false
    public fdsSides: number = 0
    public fdsData: Uint8Array = new Uint8Array()

    constructor(romData: Uint8Array) {
        this.romData = romData
    }

    private readHeader(len: number): void {
        this.header = this.romData.slice(0, len)
    }

    public parseHeader(): void {
        this.readHeader(16)

        // 解码 iNES 1.0 headers
        // 前 4 字节: $4E $45 $53 $1A
        if (this.header[0] === 0x4E && this.header[1] === 0x45
            && this.header[2] === 0x53 && this.header[3] === 0x1A) {

            this.scrolltype = (this.header[6] & Utils.BIT3) === 0
                ? (this.header[6] & Utils.BIT0) === 0
                    ? MirrorType.H_MIRROR
                    : MirrorType.V_MIRROR
                : MirrorType.FOUR_SCREEN_MIRROR

            this.savesram = (this.header[6] & Utils.BIT1) !== 0
            this.mappertype = this.header[6] >> 4

            // 检测 NES 2.0 格式用于 header 的其余部分
            if ((this.header[7] >> 2 & 3) === 2) {

                // nes 2.0 格式
                // mapper bits D0..D3 在 byte 6 的高 4 位
                this.mappertype = this.header[6] >> 4

                // mapper bits D4..D7 在 byte 7 的高 4 位
                this.mappertype |= this.header[7] & 0xF0

                // mapper bits D8..D11 在 byte 8 的低 4 位
                this.mappertype |= (this.header[8] & 0x0F) << 8

                // submapper number 是 byte 8 的高 4 位
                this.submapper = this.header[8] >> 4

                // PRG-ROM 大小解析
                const prgMSB = this.header[9] & 0x0F
                if (prgMSB === 0x0F) {

                    // 指数-乘数表示法
                    const exponent = this.header[4] >> 2 & 0x3F
                    const multiplier = (this.header[4] & 0x03) * 2 + 1
                    this.prgsize = Math.min(
                        this.romData.length - 16,
                        (1 << exponent) * multiplier,
                    )
                }
                else {

                    // 简单表示法: 16KB 单位
                    this.prgsize = Math.min(
                        this.romData.length - 16,
                        16384 * (this.header[4] | prgMSB << 8),
                    )
                }
                if (this.prgsize === 0) {
                    throw new BadMapperException('No PRG ROM size in header')
                }

                // CHR-ROM 大小解析
                const chrMSB = this.header[9] >> 4 & 0x0F
                if (chrMSB === 0x0F) {

                    // 指数-乘数表示法
                    const exponent = this.header[5] >> 2 & 0x3F
                    const multiplier = (this.header[5] & 0x03) * 2 + 1
                    this.chrsize = Math.min(
                        this.romData.length - 16 - this.prgsize,
                        (1 << exponent) * multiplier,
                    )
                }
                else {

                    // 简单表示法: 8KB 单位
                    this.chrsize = Math.min(
                        this.romData.length - 16 - this.prgsize,
                        8192 * (this.header[5] | chrMSB << 8),
                    )
                }

                // prg ram size 在 header byte 10
                // chr ram size byte 11
                // tv type 是 byte 12
                if ((this.header[12] & 3) === 1) {

                    // pal mode only rom
                    this.tvtype = TVType.PAL
                    console.error('pal')
                } 
                else {

                    // 如果 ntsc only 或在两者上都能工作，我们将使用 ntsc
                    this.tvtype = TVType.NTSC
                }

                // byte 13 是 Vs. System palettes，我还没有处理
                // byte 14 和 15 必须是零

            }
            else {

                // iNES 1.0 格式，带有 hacks
                this.prgsize = Math.min(this.romData.length - 16, 16384 * this.header[4])

                if (this.prgsize === 0) {
                    throw new BadMapperException('No PRG ROM size in header')

                    // 有人在 4mb multicart ROM 上将此字段设为零
                    // 还有人为 8k PRG dump (no-intro) 将此设为零
                    // 所以如果有人得到这个错误，制作一些启发式来修复它。
                    // 基本上在 iNES 1.0 格式中没有 > 2mb 的 multicarts
                }
                this.chrsize = Math.min(this.romData.length - 16 - this.prgsize, 8192 * this.header[5])

                if (this.header[11] + this.header[12] + this.header[13] + this.header[14]
                    + this.header[15] === 0) {

                    // 只有当结尾字节为零时才考虑 mapper # 的高位字节
                    // mapper bits D0..D3 在 byte 6 的高 4 位
                    // mapper bits D4..D7 在 byte 7 的高 4 位
                    this.mappertype |= this.header[7] & 0xF0
                    if ((this.header[9] & Utils.BIT0) !== 0) {

                        // 检测 tv type，虽然它实际上没有被使用
                        this.tvtype = TVType.PAL
                    } 
                    else if ((this.header[10] & 3) === 2) {
                        this.tvtype = TVType.PAL
                    } 
                    else {
                        this.tvtype = TVType.NTSC
                    }
                } 
                else {
                    this.tvtype = TVType.NTSC
                }
            }

            // 计算偏移量；header 不包括在这里
            // 检查是否有 trainer (512 bytes at $7000-$71FF)
            const hasTrainer = (this.header[6] & 0x04) !== 0
            
            // CRITICAL FIX: Some ROMs have buggy trainer flags
            // Check if position 528+ is all 0xa1 padding - if so, the PRG actually starts at 16
            let actualPrgOffset = 0
            
            if (hasTrainer && this.romData.length > 544) {

                // Check if the data AFTER supposed trainer (at 528+) is all 0xa1
                const dataAfterTrainer = this.romData.slice(528, 544)
                const isPostTrainerPadding = dataAfterTrainer.every(b => b === 0xa1)
                
                if (isPostTrainerPadding) {

                    // If data at 528+ is padding, the real PRG is at position 16
                    actualPrgOffset = 0
                }
                else {

                    // Normal case: trainer exists, PRG after it
                    actualPrgOffset = 512
                }
            }
            else {
                actualPrgOffset = hasTrainer ? 512 : 0
            }
            
            this.prgoff = actualPrgOffset
            this.chroff = this.prgoff + this.prgsize
            
        } 
        else if (this.header[0] === 0x46 && this.header[1] === 0x44
            && this.header[2] === 0x53 && this.header[3] === 0x1A) {

            // FDS 镜像（原生 .fds）
            // 典型 16 字节头："FDS\x1A"，byte4 通常为盘面数
            this.isFDS = true
            this.mappertype = -2
            this.submapper = 0
            this.scrolltype = MirrorType.H_MIRROR // FDS 使用 CHR-RAM，VRAM 镜像由 PPU 管理
            this.tvtype = TVType.NTSC

            // 重新读取 16 字节 header（已读），解析盘面数（如存在）
            this.fdsSides = this.header[4] || 1

            // FDS 数据紧随其后
            const totalLen = this.romData.length
            const dataStart = 16
            this.fdsData = this.romData.slice(dataStart, totalLen)

            // 对于 FDS，不使用 iNES 的 PRG/CHR 概念
            this.prgsize = 0
            this.chrsize = 0
            this.prgoff = 0
            this.chroff = 0
            this.savesram = true // FDS 具有可写 RAM
        }
        else if (this.header[0] === 0x4E && this.header[1] === 0x45
            && this.header[2] === 0x53 && this.header[3] === 0x4D
            && this.header[4] === 0x1a) {

            // nsf 文件
            this.mappertype = -1

            // 重新读取 header，因为它是 128 字节
            this.readHeader(128)
            this.prgsize = this.romData.length - 128
        } 
        else if (this.header[0] === 0x55) { // 'U'
            throw new BadMapperException('This is a UNIF file with the wrong extension')
        } 
        else {
            throw new BadMapperException('iNES Header Invalid')
        }
    }

    public load(size: number, offset: number): number[] {

        // offset is the absolute offset from the start of file (header.length + prgoff/chroff)
        // Mapper passes prgoff/chroff which already includes trainer offset
        const startIndex = this.header.length + offset
        const endIndex = startIndex + size
        
        const data = Array.from(this.romData.slice(startIndex, endIndex))
        
        return data
    }

    public romlen(): number {
        return this.romData.length - this.header.length
    }
}
