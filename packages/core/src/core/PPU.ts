
import type { Mapper } from './mappers/Mapper'
import { TVType, Utils } from './types'
import { compressArrayIfPossible, decompressArray } from './utils'

export class PPU {
    public mapper: Mapper
    public scanline: number = 0
    public cycles: number = 0
    public readonly pal: Uint8Array
    
    private oamaddr: number = 0
    private oamstart: number = 0
    private readbuffer: number = 0
    private loopyV: number = 0x0 
    private loopyT: number = 0x0 
    private loopyX: number = 0 
    private framecount: number = 0
    private div: number = 2
    private debugLogCount: number = 0 
    
    private readonly OAM: Uint8Array = new Uint8Array(256).fill(0xff)
    private readonly secOAM: Uint8Array = new Uint8Array(32).fill(0)
    private readonly spriteshiftregH: Uint8Array = new Uint8Array(8)
    private readonly spriteshiftregL: Uint8Array = new Uint8Array(8)
    private readonly spriteXlatch: Uint8Array = new Uint8Array(8)
    private readonly spritepals: Uint8Array = new Uint8Array(8)
    private readonly bitmap: Uint8Array = new Uint8Array(240 * 256)
    private readonly bgcolors: Uint8Array = new Uint8Array(256)
    
    private readonly spritebgflags: Uint8Array = new Uint8Array(8) // 用0/1代替boolean

    private dotcrawl: boolean = true
    private sprite0here: boolean = false
    
    private even: boolean = true
    private bgpattern: boolean = false
    private sprpattern: boolean = false
    private spritesize: boolean = false
    private nmicontrol: boolean = false
    private grayscale: boolean = false
    private bgClip: boolean = false
    private spriteClip: boolean = false
    private bgOn: boolean = false
    private spritesOn: boolean = false
    private vblankflag: boolean = false
    private sprite0hit: boolean = false
    private spriteoverflow: boolean = false
    
    private emph: number = 0
    private vraminc: number = 1
    private openbus: number = 0 
    private nextattr: number = 0
    private linelowbits: number = 0
    private linehighbits: number = 0
    private penultimateattr: number = 0
    private numscanlines: number = 262
    private vblankline: number = 241
    private readonly cpudivider: Uint8Array = new Uint8Array([3, 3, 3, 3, 3])
    
    private tileAddr: number = 0
    private cpudividerctr: number = 0

    private found: number = 0
    private bgShiftRegH: number = 0
    private bgShiftRegL: number = 0
    private _bgAttrShiftRegH: number = 0
    private _bgAttrShiftRegL: number = 0
    
    get bgAttrShiftRegH(): number {
        return this._bgAttrShiftRegH
    }
    
    set bgAttrShiftRegH(value: number) {
        this._bgAttrShiftRegH = value >>> 0 & 0xFFFF
    }
    
    get bgAttrShiftRegL(): number {
        return this._bgAttrShiftRegL
    }
    
    set bgAttrShiftRegL(value: number) {
        this._bgAttrShiftRegL = value >>> 0 & 0xFFFF
    }

    constructor(mapper: Mapper) {
        
        this.pal = new Uint8Array([
            0x0F, 0x01, 0x00, 0x01, 0x00, 0x02, 0x02, 0x0D,
            0x08, 0x10, 0x08, 0x24, 0x00, 0x00, 0x04, 0x2C,
            0x0F, 0x01, 0x34, 0x03, 0x00, 0x04, 0x00, 0x14,
            0x08, 0x3A, 0x00, 0x02, 0x00, 0x20, 0x2C, 0x08,
        ])
        
        this.mapper = mapper
        this.setParameters()
    }

    /**
     * 根据电视制式设置 PPU 参数
     */
    private setParameters(): void {
        
        switch (this.mapper.getTVType()) {
            case TVType.PAL:
                this.numscanlines = 312
                this.vblankline = 241
                this.cpudivider[0] = 4
                break
            case TVType.DENDY:
                this.numscanlines = 312
                this.vblankline = 291
                this.cpudivider[0] = 3
                break
            case TVType.NTSC:
            default:
                this.numscanlines = 262
                this.vblankline = 241
                this.cpudivider[0] = 3
                break
        }
    }

    /**
     * 运行一帧的 PPU 模拟
     */
    public runFrame(): void {
        for (let line = 0; line < this.numscanlines; ++line) {
            this.clockLine(line)
        }
        
    }

    /**
     * �?PPU 寄存器读取数据，完全按照Java版本实现
     * @param regnum 寄存器号�?-7�?
     * @returns 读取的�?
     */
    public read(regnum: number): number {
        switch (regnum) {
            case 2: 
                this.even = true
                if (this.scanline === 241) {
                    if (this.cycles === 1) {
                        
                        this.vblankflag = false
                    }
                }
                this.openbus = (this.vblankflag ? 0x80 : 0)
                    | (this.sprite0hit ? 0x40 : 0)
                    | (this.spriteoverflow ? 0x20 : 0)
                    | this.openbus & 0x1f
                this.vblankflag = false
                break

            case 4: 
                
                this.openbus = this.OAM[this.oamaddr]
                if (this.renderingOn() && this.scanline <= 240) {
                    if (this.cycles < 64) {
                        return 0xFF
                    }
                    else if (this.cycles <= 256) {
                        return 0x00
                    }
                    else if (this.cycles < 320) {
                        return 0xFF
                    }
                    else {
                        return this.secOAM[0]
                    }
                }
                break

            case 7: 
                
                let temp: number
                if ((this.loopyV & 0x3fff) < 0x3f00) {
                    temp = this.readbuffer
                    this.readbuffer = this.mapper.ppuRead(this.loopyV & 0x3fff)
                }
                else {
                    this.readbuffer = this.mapper.ppuRead((this.loopyV & 0x3fff) - 0x1000)
                    temp = this.mapper.ppuRead(this.loopyV)
                }
                
                if (!this.renderingOn() || this.scanline > 240 && this.scanline < this.numscanlines - 1) {
                    this.loopyV += this.vraminc
                }
                else {
                    
                    this.incLoopyVHoriz()
                    this.incLoopyVVert()
                }
                this.openbus = temp
                break

            default:
                return this.openbus 
        }

        return this.openbus
    }

    /**
     * �?PPU 寄存器写入数据，完全按照Java版本实现
     * @param regnum 寄存器号�?-7�?
     * @param data 要写入寄存器的值（0x00 �?0xff 有效�?
     */
    public write(regnum: number, data: number): void {
        
        this.openbus = data
        switch (regnum) {
            case 0: 
                
                this.loopyT &= ~0xc00
                this.loopyT |= (data & 3) << 10
                
                this.vraminc = (data & Utils.BIT2) === 0 ? 1 : 32
                this.sprpattern = (data & Utils.BIT3) !== 0
                this.bgpattern = (data & Utils.BIT4) !== 0
                this.spritesize = (data & Utils.BIT5) !== 0
                this.nmicontrol = (data & Utils.BIT7) !== 0
                
                if (this.vblankflag && this.nmicontrol) {
                    this.mapper.cpu?.setNMI(true)
                }
                else if (!this.nmicontrol) {
                    
                    this.mapper.cpu?.setNMI(false)
                }
                break

            case 1: 
                this.grayscale = (data & Utils.BIT0) !== 0
                this.bgClip = !((data & Utils.BIT1) !== 0) 
                this.spriteClip = !((data & Utils.BIT2) !== 0)

                this.bgOn = (data & Utils.BIT3) !== 0
                this.spritesOn = (data & Utils.BIT4) !== 0
                this.emph = (data & 0xe0) << 1
                
                if (this.numscanlines === 312) {
                    
                    const red = this.emph >> 6 & 1
                    const green = this.emph >> 7 & 1
                    this.emph &= 0xf3f
                    this.emph |= red << 7 | green << 6
                }
                break

            case 3: 
                this.oamaddr = data & 0xff
                break

            case 4: 
                if ((this.oamaddr & 3) === 2) {
                    this.OAM[this.oamaddr++] = data & 0xE3
                }
                else {
                    this.OAM[this.oamaddr++] = data
                }
                this.oamaddr &= 0xff
                break

            case 5: 
                if (this.even) {
                    
                    this.loopyT &= ~0x1f
                    this.loopyX = data & 7
                    this.loopyT |= data >> 3
                    this.even = false
                }
                else {
                    
                    this.loopyT &= ~0x7000
                    this.loopyT |= (data & 7) << 12
                    this.loopyT &= ~0x3e0
                    this.loopyT |= (data & 0xf8) << 2
                    this.even = true
                }
                break

            case 6: 
                if (this.even) {
                    
                    this.loopyT &= 0xc0ff
                    this.loopyT |= (data & 0x3f) << 8
                    this.loopyT &= 0x3fff
                    this.even = false
                }
                else {
                    this.loopyT &= 0xfff00
                    this.loopyT |= data
                    this.loopyV = this.loopyT
                    this.even = true
                }
                break

            case 7: 
                this.mapper.ppuWrite(this.loopyV & 0x3fff, data)
                if (!this.renderingOn() || this.scanline > 240 && this.scanline < this.numscanlines - 1) {
                    this.loopyV += this.vraminc
                }
                else if ((this.loopyV & 0x7000) === 0x7000) {
                    const YScroll = this.loopyV & 0x3E0
                    this.loopyV &= 0xFFF
                    switch (YScroll) {
                        case 0x3A0:
                            this.loopyV ^= 0xBA0
                            break
                        case 0x3E0:
                            this.loopyV ^= 0x3E0
                            break
                        default:
                            this.loopyV += 0x20
                            break
                    }
                }
                else {
                    this.loopyV += 0x1000
                }
                break
        }
    }

    /**
     * 如果启用了背景或精灵，PPU 就处于开启状�?
     */
    public renderingOn(): boolean {
        return this.bgOn || this.spritesOn
    }

    /**
     * MMC3扫描行计数器时钟判断
     */
    public mmc3CounterClocking(): boolean {
        return this.bgpattern !== this.sprpattern && this.renderingOn()
    }

    /**
     * 为一�?NES 扫描行运�?PPU 模拟
     */
    public clockLine(scanline: number): void {
        
        this.scanline = scanline
        
        const skip = this.numscanlines === 262
            && scanline === 0
            && this.renderingOn()
            && !((this.framecount & Utils.BIT1) !== 0) ? 1 : 0
        
        for (this.cycles = skip; this.cycles < 341; ++this.cycles) {
            this.clock()
        }
    }

    /**
     * PPU 时钟周期运行模拟
     */
    public clock(): void {
        
        if (this.cycles === 1) {
            if (this.scanline === 0) {
                this.dotcrawl = this.renderingOn()
            }
            if (this.scanline < 240) {
                this.bgcolors[this.scanline] = this.pal[0]
            }
        }
        
        if (this.scanline < 240 || this.scanline === this.numscanlines - 1) {
            
            if (this.renderingOn()
                && (this.cycles >= 1 && this.cycles <= 256
                    || this.cycles >= 321 && this.cycles <= 336)) {
                
                this.bgFetch()
            }
            else if (this.cycles === 257 && this.renderingOn()) {
                
                this.loopyV &= ~0x41f
                this.loopyV |= this.loopyT & 0x41f
            }
            else if (this.cycles > 257 && this.cycles <= 341) {
                
                this.oamaddr = 0
            }
            
            if (this.cycles === 340 && this.renderingOn()) {
                
                this.fetchNTByte()
                this.fetchNTByte()
            }
            
            if (this.cycles === 65 && this.renderingOn()) {
                this.oamstart = this.oamaddr
            }
            
            if (this.cycles === 260 && this.renderingOn()) {
                
                this.evalSprites()
            }
            
            if (this.scanline === this.numscanlines - 1) {
                if (this.cycles === 0) {
                    
                    this.vblankflag = false
                    this.sprite0hit = false
                    this.spriteoverflow = false
                }
                else if (this.cycles >= 280 && this.cycles <= 304 && this.renderingOn()) {
                    
                    this.loopyV = this.loopyT
                }
            }
        }
        else if (this.scanline === this.vblankline && this.cycles === 1) {
            
            this.vblankflag = true
        }
        
        if (!this.renderingOn() || this.scanline > 240 && this.scanline < this.numscanlines - 1) {
            
            this.mapper.checkA12(this.loopyV & 0x3fff)
        }
        
        if (this.scanline < 240 && this.cycles >= 1 && this.cycles <= 256) {
            const bufferoffset = (this.scanline << 8) + (this.cycles - 1)
            
            if (this.bgOn) {
                const isBG = this.drawBGPixel(bufferoffset)
                
                this.drawSprites(this.scanline, this.cycles - 1, isBG)
            }
            else if (this.spritesOn) {
                
                const bgcolor = this.loopyV > 0x3f00 && this.loopyV < 0x3fff ? this.mapper.ppuRead(this.loopyV) : this.pal[0]
                this.bitmap[bufferoffset] = bgcolor
                this.drawSprites(this.scanline, this.cycles - 1, true)
            }
            else {
                
                const bgcolor = this.loopyV > 0x3f00 && this.loopyV < 0x3fff ? this.mapper.ppuRead(this.loopyV) : this.pal[0]
                this.bitmap[bufferoffset] = bgcolor
            }
            
            if (this.grayscale) {
                this.bitmap[bufferoffset] &= 0x30
            }
            
            this.bitmap[bufferoffset] = this.bitmap[bufferoffset] & 0x3f | this.emph
        }
        
        if (this.vblankflag && this.nmicontrol) {
            
            this.mapper.cpu?.setNMI(true)
        }
        else {

            this.mapper.cpu?.setNMI(false)
        }
        
        this.div = (this.div + 1) % this.cpudivider[this.cpudividerctr]
        if (this.div === 0) {
            this.mapper.cpu?.runcycle()
            this.mapper.cpucycle(1)
            
            // FDS Mapper IRQ时钟更新
            if ('clockIRQ' in this.mapper && typeof this.mapper.clockIRQ === 'function') {
                (this.mapper as any).clockIRQ(1)
            }
            
            this.cpudividerctr = (this.cpudividerctr + 1) % this.cpudivider.length
        }
        
        if (this.cycles === 257) {
            this.mapper.notifyscanline(this.scanline)
        }
        else if (this.cycles === 340) {
            this.scanline = (this.scanline + 1) % this.numscanlines

        }
    }

    /**
     * 背景获取逻辑，确�?6位无符号整数行为
     */
    private bgFetch(): void {
        
        const attrBitH = this.nextattr >> 1 & 1
        const attrBitL = this.nextattr & 1
        
        const tempH = this.bgAttrShiftRegH | attrBitH
        const tempL = this.bgAttrShiftRegL | attrBitL
        
        this.bgAttrShiftRegH = tempH >>> 0 & 0xFFFF
        this.bgAttrShiftRegL = tempL >>> 0 & 0xFFFF
        
        switch (this.cycles - 1 & 7) {
            case 1:
                this.fetchNTByte()
                break
            case 3:
                
                this.penultimateattr = this.getAttribute(
                    (this.loopyV & 0xc00) + 0x23c0,
                    this.loopyV & 0x1f,
                    (this.loopyV & 0x3e0) >> 5,
                )
                break
            case 5:
                
                this.linelowbits = this.mapper.ppuRead(this.tileAddr + ((this.loopyV & 0x7000) >> 12))
                break
            case 7:
                
                this.linehighbits = this.mapper.ppuRead(this.tileAddr + 8 + ((this.loopyV & 0x7000) >> 12))
                this.bgShiftRegL |= this.linelowbits
                this.bgShiftRegH |= this.linehighbits
                
                this.nextattr = this.penultimateattr
                
                if (this.cycles === 256) {
                    this.incLoopyVVert()
                }
                else {
                    this.incLoopyVHoriz()
                }
                break
            default:
                
                break
        }
        
        if (this.cycles >= 321 && this.cycles <= 336) {
            this.bgShiftClock()
        }
    }

    /**
     * 垂直增加 loopyV
     */
    private incLoopyVVert(): void {
        
        if ((this.loopyV & 0x7000) === 0x7000) {
            
            this.loopyV &= ~0x7000
            let y = (this.loopyV & 0x03E0) >> 5
            if (y === 29) {
                
                y = 0
                this.loopyV ^= 0x0800
            }
            else {
                
                y = y + 1 & 31
            }
            this.loopyV = this.loopyV & ~0x03E0 | y << 5
        }
        else {
            
            this.loopyV += 0x1000
        }
    }

    /**
     * 水平增加 loopyV
     */
    private incLoopyVHoriz(): void {
        
        if ((this.loopyV & 0x001F) === 31) { 
            this.loopyV &= ~0x001F 
            this.loopyV ^= 0x0400 
        }
        else {
            this.loopyV += 1 
        }
    }

    /**
     * 获取名称表字�?
     */
    private fetchNTByte(): void {
        
        this.tileAddr = this.mapper.ppuRead((this.loopyV & 0xc00 | 0x2000) + (this.loopyV & 0x3ff)) * 16 + (this.bgpattern ? 0x1000 : 0)
    }

    /**
     * 绘制背景像素
     */
    private drawBGPixel(bufferoffset: number): boolean {
        
        let isBG: boolean
        if (this.bgClip && (bufferoffset & 0xff) < 8) {
            
            this.bitmap[bufferoffset] = this.pal[0]
            isBG = true
        }
        else {
            const bgShiftAmount = 16 - this.loopyX
            const attrShiftAmount = 8 - this.loopyX
            
            const bgPix = ((this.bgShiftRegH >> bgShiftAmount & 1) << 1)
                + (this.bgShiftRegL >> bgShiftAmount & 1)
            const bgPal = ((this.bgAttrShiftRegH >> attrShiftAmount & 1) << 1)
                + (this.bgAttrShiftRegL >> attrShiftAmount & 1)
            isBG = bgPix === 0
            this.bitmap[bufferoffset] = isBG ? this.pal[0] : this.pal[(bgPal << 2) + bgPix]
        }
        this.bgShiftClock()

        return isBG
    }

    /**
     * 背景移位时钟 - 确保16位无符号整数行为
     */
    private bgShiftClock(): void {
        
        this.bgShiftRegH <<= 1
        this.bgShiftRegL <<= 1
        
        const tempH = this.bgAttrShiftRegH << 1
        const tempL = this.bgAttrShiftRegL << 1
        
        this.bgAttrShiftRegH = tempH >>> 0 & 0xFFFF
        this.bgAttrShiftRegL = tempL >>> 0 & 0xFFFF

    }

    /**
     * 为下一扫描行评�?PPU 精灵
     */
    private evalSprites(): void {
        this.sprite0here = false
        let ypos: number
        let offset: number
        this.found = 0
        this.secOAM.fill(0xff)
        
        for (let spritestart = this.oamstart; spritestart < 255; spritestart += 4) {
            
            ypos = this.OAM[spritestart]
            offset = this.scanline - ypos
            if (ypos > this.scanline || offset > (this.spritesize ? 15 : 7)) {
                
                continue
            }
            
            if (spritestart === 0) {
                this.sprite0here = true
            }
            
            if (this.found >= 8) {
                
                this.spriteoverflow = true
                break
            }
            else {
                
                this.secOAM[this.found * 4] = this.OAM[spritestart]
                
                const oamextra = this.OAM[spritestart + 2]
                
                // 精灵背景优先级标志 (0=前景, 1=背景)
                this.spritebgflags[this.found] = oamextra & Utils.BIT5 ? 1 : 0
                
                this.spriteXlatch[this.found] = this.OAM[spritestart + 3]
                this.spritepals[this.found] = ((oamextra & 3) + 4) * 4
                
                if ((oamextra & Utils.BIT7) !== 0) {
                    
                    offset = (this.spritesize ? 15 : 7) - offset
                }
                
                if (offset > 7) {
                    offset += 8
                }
                
                const tilenum = this.OAM[spritestart + 1]
                this.spriteFetch(this.spritesize, tilenum, offset, oamextra)
                ++this.found
            }
        }
        
        for (let i = this.found; i < 8; ++i) {
            
            this.spriteshiftregL[this.found] = 0
            this.spriteshiftregH[this.found] = 0
            
            this.spriteFetch(this.spritesize, 0xff, 0, 0)
        }
    }

    /**
     * 精灵获取
     */
    private spriteFetch(spritesize: boolean, tilenum: number, offset: number, oamextra: number): void {
        let tilefetched: number
        if (spritesize) {
            tilefetched = (tilenum & 1) * 0x1000 + (tilenum & 0xfe) * 16
        }
        else {
            tilefetched = tilenum * 16 + (this.sprpattern ? 0x1000 : 0)
        }
        tilefetched += offset
        
        const hflip = (oamextra & Utils.BIT6) !== 0
        if (hflip) {
            this.spriteshiftregL[this.found] = this.mapper.ppuRead(tilefetched)
            this.spriteshiftregH[this.found] = this.mapper.ppuRead(tilefetched + 8)
        }
        else {
            this.spriteshiftregL[this.found] = Utils.reverseByte(this.mapper.ppuRead(tilefetched))
            this.spriteshiftregH[this.found] = Utils.reverseByte(this.mapper.ppuRead(tilefetched + 8))
        }
    }

    /**
     * 绘制精灵评估选择的适当像素
     */
    private drawSprites(line: number, x: number, bgflag: boolean): void {
        const startdraw = this.spriteClip ? 8 : 0 
        let sprpxl = 0
        let index = 7
        
        for (let y = this.found - 1; y >= 0; --y) {
            const off = x - this.spriteXlatch[y]
            if (off >= 0 && off <= 8) {
                if ((this.spriteshiftregH[y] & 1) + (this.spriteshiftregL[y] & 1) !== 0) {
                    
                    index = y
                    sprpxl 
                        = ((this.spriteshiftregH[y] & 1) << 1) + (this.spriteshiftregL[y] & 1)
                }
                this.spriteshiftregH[y] >>= 1
                this.spriteshiftregL[y] >>= 1
            }
        }
        
        if (sprpxl === 0 || x < startdraw || !this.spritesOn) {
            
            return
        }
        
        if (this.sprite0here && index === 0 && !bgflag && x < 255) {
            
            this.sprite0hit = true
        }
        
        if (this.spritebgflags[index] === 0 || bgflag) {
            this.bitmap[(line << 8) + x] = this.pal[this.spritepals[index] + sprpxl]
        }
    }

    /**
     * 读取当前瓦片的适当颜色属性字�?
     */
    private getAttribute(ntstart: number, tileX: number, tileY: number): number {
        const attrAddr = ntstart + (tileX >> 2) + 8 * (tileY >> 2)
        const base = this.mapper.ppuRead(attrAddr)
        
        let result: number
        if ((tileY & Utils.BIT1) !== 0) {
            if ((tileX & Utils.BIT1) === 0) {
                result = base >> 4 & 3
            }
            else {
                result = base >> 6 & 3
            }
        }
        else if ((tileX & Utils.BIT1) === 0) {
            result = base & 3
        }
        else {
            result = base >> 2 & 3
        }
        
        return result
    }

    /**
     * 获取当前帧的位图数据
     */
    public getBitmap(): Uint8Array {
        return this.bitmap.slice()
    }

    /**
     * 获取当前帧的背景颜色数组
     */
    public getBgColors(): Uint8Array {
        return this.bgcolors.slice()
    }

    /**
     * 获取点爬行状�?
     */
    public getDotCrawl(): boolean {
        return this.dotcrawl
    }

    /**
     * 获取PPU状态（用于存档�?
     */
    public getPPUState(): any {
        return {
            
            control: {
                bgpattern: this.bgpattern,
                sprpattern: this.sprpattern,
                spritesize: this.spritesize,
                nmicontrol: this.nmicontrol,
                vraminc: this.vraminc,
            },
            mask: {
                grayscale: this.grayscale,
                bgClip: this.bgClip,
                spriteClip: this.spriteClip,
                bgOn: this.bgOn,
                spritesOn: this.spritesOn,
                emph: this.emph,
            },
            status: {
                vblankflag: this.vblankflag,
                sprite0hit: this.sprite0hit,
                spriteoverflow: this.spriteoverflow,
            },
            palette: compressArrayIfPossible(this.pal),
            oam: compressArrayIfPossible(this.OAM),
            oamaddr: this.oamaddr,
            scanline: this.scanline,
            cycles: this.cycles,
            loopyV: this.loopyV,
            loopyT: this.loopyT,
            loopyX: this.loopyX,
            readbuffer: this.readbuffer,
            openbus: this.openbus,
            framecount: this.framecount,
            div: this.div,
            
            bgShiftRegH: this.bgShiftRegH,
            bgShiftRegL: this.bgShiftRegL,
            bgAttrShiftRegH: this.bgAttrShiftRegH,
            bgAttrShiftRegL: this.bgAttrShiftRegL,
            nextattr: this.nextattr,
            linelowbits: this.linelowbits,
            linehighbits: this.linehighbits,
            penultimateattr: this.penultimateattr,
            tileAddr: this.tileAddr,
            found: this.found,
            
            sprite0here: this.sprite0here,
            even: this.even,
            secOAM: compressArrayIfPossible(this.secOAM),
            spriteshiftregH: compressArrayIfPossible(this.spriteshiftregH),
            spriteshiftregL: compressArrayIfPossible(this.spriteshiftregL),
            spriteXlatch: compressArrayIfPossible(this.spriteXlatch),
            spritepals: compressArrayIfPossible(this.spritepals),
            spritebgflags: compressArrayIfPossible(this.spritebgflags),
            oamstart: this.oamstart,
            dotcrawl: this.dotcrawl,
            cpudividerctr: this.cpudividerctr,
        }
    }

    /**
     * 统一的数组恢复函数
     */
    private restoreTypedArray(target: Uint8Array, source: any): void {
        if (!source) return
        const decompressed = decompressArray(source)
        if (decompressed.length === target.length) {
            target.set(decompressed)
        }
    }

    /**
     * 设置PPU状态（用于加载存档�?
     */
    public setPPUState(state: any): void {
        
        if (state.control) {
            this.bgpattern = state.control.bgpattern || false
            this.sprpattern = state.control.sprpattern || false
            this.spritesize = state.control.spritesize || false
            this.nmicontrol = state.control.nmicontrol || false
            this.vraminc = state.control.vraminc || 1
        }
        
        if (state.mask) {
            this.grayscale = state.mask.grayscale || false
            this.bgClip = state.mask.bgClip || false
            this.spriteClip = state.mask.spriteClip || false
            this.bgOn = state.mask.bgOn || false
            this.spritesOn = state.mask.spritesOn || false
            this.emph = state.mask.emph || 0
        }
        
        if (state.status) {
            this.vblankflag = state.status.vblankflag || false
            this.sprite0hit = state.status.sprite0hit || false
            this.spriteoverflow = state.status.spriteoverflow || false
        }
        
        // 使用统一的数组恢复逻辑
        this.restoreTypedArray(this.pal, state.palette)
        this.restoreTypedArray(this.OAM, state.oam)
        this.restoreTypedArray(this.secOAM, state.secOAM)
        this.restoreTypedArray(this.spriteshiftregH, state.spriteshiftregH)
        this.restoreTypedArray(this.spriteshiftregL, state.spriteshiftregL)
        this.restoreTypedArray(this.spriteXlatch, state.spriteXlatch)
        this.restoreTypedArray(this.spritepals, state.spritepals)
        this.restoreTypedArray(this.spritebgflags, state.spritebgflags)
        
        // 基础属性恢复，已知存在的属性直接赋值
        this.oamaddr = state.oamaddr || 0
        this.scanline = state.scanline || 0
        this.cycles = state.cycles || 0
        this.loopyV = state.loopyV || 0
        this.loopyT = state.loopyT || 0
        this.loopyX = state.loopyX || 0
        this.readbuffer = state.readbuffer || 0
        this.openbus = state.openbus || 0
        this.framecount = state.framecount || 0
        this.div = state.div || 2
        
        this.bgShiftRegH = state.bgShiftRegH || 0
        this.bgShiftRegL = state.bgShiftRegL || 0
        this.bgAttrShiftRegH = state.bgAttrShiftRegH || 0
        this.bgAttrShiftRegL = state.bgAttrShiftRegL || 0
        this.nextattr = state.nextattr || 0
        this.linelowbits = state.linelowbits || 0
        this.linehighbits = state.linehighbits || 0
        this.penultimateattr = state.penultimateattr || 0
        this.tileAddr = state.tileAddr || 0
        this.found = state.found || 0
        
        this.sprite0here = state.sprite0here || false
        this.even = state.even ?? true
        this.oamstart = state.oamstart || 0
        this.dotcrawl = state.dotcrawl ?? true
        this.cpudividerctr = state.cpudividerctr || 0
        
        const isAtFrameBoundary = this.scanline === 0 && this.cycles === 341
        
        if (isAtFrameBoundary && this.renderingOn()) {
            
            this.oamstart = 0
            
            if (state.bgShiftRegH !== undefined && state.bgShiftRegL !== undefined) {
                this.bgShiftRegH = state.bgShiftRegH
                this.bgShiftRegL = state.bgShiftRegL
            }
            if (state.bgAttrShiftRegH !== undefined && state.bgAttrShiftRegL !== undefined) {
                this.bgAttrShiftRegH = state.bgAttrShiftRegH
                this.bgAttrShiftRegL = state.bgAttrShiftRegL
            }
            
            this.div = state.div ?? 0
        }
    }

    /**
     * 清除渲染缓存
     */
    private clearRenderCache(): void {
        
        this.bgShiftRegH = 0
        this.bgShiftRegL = 0
        this.bgAttrShiftRegH = 0
        this.bgAttrShiftRegL = 0
        
        this.spriteshiftregH.fill(0)
        this.spriteshiftregL.fill(0)
        this.spriteXlatch.fill(0)
        this.spritepals.fill(0)
        this.spritebgflags.fill(0) // 0 = 前景优先级
        
        this.sprite0here = false
        this.found = 0
        
        this.nextattr = 0
        this.linelowbits = 0
        this.linehighbits = 0
        this.penultimateattr = 0
        this.tileAddr = 0
        
        this.secOAM.fill(0)
        
        this.readbuffer = 0
        
        this.bitmap.fill(0)
        this.bgcolors.fill(0)
    }

    /**
     * 重新同步移位寄存�?- 修复扫描线中间恢复状态的问题
     */
    private resyncShiftRegisters(): void {
        
        if (this.scanline === 0 && this.cycles >= 280) {

            return
        }
        
        if (this.scanline >= 240) {

            return
        }
        
        if (this.cycles < 1 || this.cycles > 256) {

            return
        }
        
        const cycleInTile = this.cycles - 1 & 7
        
        if (cycleInTile > 0 && cycleInTile < 8) {
            
            if ((this.bgShiftRegH & 0xff00) === 0 && (this.bgShiftRegL & 0xff00) === 0) {
                
                if (this.renderingOn()) {
                    
                    this.fetchNTByte()
                    this.penultimateattr = this.getAttribute(
                        (this.loopyV & 0xc00) + 0x23c0,
                        this.loopyV & 0x1f,
                        (this.loopyV & 0x3e0) >> 5,
                    )
                    this.linelowbits = this.mapper.ppuRead(this.tileAddr + ((this.loopyV & 0x7000) >> 12))
                    this.linehighbits = this.mapper.ppuRead(this.tileAddr + 8 + ((this.loopyV & 0x7000) >> 12))
                    
                    this.bgShiftRegL = this.bgShiftRegL & 0x00ff | this.linelowbits << 8
                    this.bgShiftRegH = this.bgShiftRegH & 0x00ff | this.linehighbits << 8
                    
                    const attr = this.penultimateattr
                    
                    this.bgAttrShiftRegL = (this.bgAttrShiftRegL & 0x00ff | (attr & 1 ? 0xff00 : 0x0000)) & 0xFFFF
                    this.bgAttrShiftRegH = (this.bgAttrShiftRegH & 0x00ff | (attr & 2 ? 0xff00 : 0x0000)) & 0xFFFF
                    
                }
            }
        }
        
    }
}
