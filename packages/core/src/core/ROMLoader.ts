
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

                // nes 2
                // mapper bits 4-7 在 byte 7
                this.mappertype += this.header[7] >> 4 << 4

                // mapper bits 8-12 在 byte 8  
                this.mappertype += (this.header[8] & 15) << 8

                // submapper number 是 byte 8 的高 4 位
                this.submapper = this.header[8] >> 4

                // extra prg 和 chr bits 在 byte 9
                this.prgsize = Math.min(
                    this.romData.length - 16,
                    16384 * (this.header[4] + ((this.header[9] & 15) << 8)),
                )
                if (this.prgsize === 0) {
                    throw new BadMapperException('No PRG ROM size in header')
                }
                this.chrsize = Math.min(
                    this.romData.length - 16 - this.prgsize,
                    8192 * (this.header[5] + (this.header[9] >> 4 << 8)),
                )

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

                // nes 1 format，带有 hacks
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
                    this.mappertype += this.header[7] >> 4 << 4
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
            this.prgoff = 0
            this.chroff = 0 + this.prgsize
            
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
        const startIndex = offset + this.header.length
        const endIndex = startIndex + size

        return Array.from(this.romData.slice(startIndex, endIndex))
    }

    public romlen(): number {
        return this.romData.length - this.header.length
    }
}
