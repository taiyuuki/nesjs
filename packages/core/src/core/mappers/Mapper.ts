
import type { ROMLoader } from '../ROMLoader'
import type { CPU } from '../CPU'
import type { PPU } from '../PPU'
import type { CPURAM } from '../CPURAM'
import { MirrorType, TVType } from '../types'
import { CRC32 } from '../CRC'
import type { NES } from '../NES'
import { compressArrayIfPossible, decompressArray } from '../utils'

/**
 * 自动判断值是否应该被序列化
 */
function _shouldSerializeProperty(key: string, value: any): boolean {

    // 排除函数
    if (typeof value === 'function') return false
    
    // 排除 undefined
    if (value === undefined) return false
    
    // 排除特定的系统属性
    const excludeList = [
        'loader', 'nes', 'cpu', 'cpuram', 'ppu', 'crc', 'region', 'bios',
        'prg', 'chrsize', 'prgsize', 'prgoff', 'chroff', 'mappertype', 'submapper',
        'haschrram', 'hasprgram', 'savesram',
        'nt0', 'nt1', 'nt2', 'nt3', // nametable 指针
        'soundchip', // 声音芯片
    ]
    
    if (excludeList.includes(key)) return false
    
    // 排除以 _ 开头的私有属性
    if (key.startsWith('_')) return false
    
    return true
}

/**
 * 自动序列化值
 */
function _autoSerializeValue(key: string, value: any, mapper: Mapper): any {

    // 特殊处理 CHR 数据
    if (key === 'chr') {

        // 使用 any 类型绕过访问限制
        return (mapper as any).haschrram ? Array.from(value) : null
    }
    
    // 特殊处理大容量数组：对于全零或重复数据进行压缩
    if (value instanceof Uint8Array || Array.isArray(value)) {
        return compressArrayIfPossible(value)
    }
    
    // 基本类型直接返回
    return value
}

/**
 * 自动反序列化值
 */
function _autoDeserializeValue(key: string, value: any, mapper: Mapper, originalValue: any): any {

    // 特殊处理 CHR 数据
    if (key === 'chr') {
        const mapperAny = mapper as any
        if (mapperAny.haschrram && Array.isArray(value) && value.length === mapperAny.chrsize) {
            return value
        }

        return undefined // 跳过
    }
    
    // 处理压缩数据
    if (value && typeof value === 'object' && value._compressed) {
        return decompressArray(value)
    }
    
    // 如果原值是 Uint8Array，转换回 Uint8Array
    if (originalValue instanceof Uint8Array && Array.isArray(value)) {
        return new Uint8Array(value)
    }
    
    // 如果原值是数组，确保返回数组
    if (Array.isArray(originalValue) && Array.isArray(value)) {
        return [...value]
    }
    
    return value
}

/**
 * Mapper 基类
 * 提供所有 Mapper 的通用功能
 */
export class Mapper {
    protected loader!: ROMLoader
    protected mappertype: number = 0
    protected submapper: number = 0
    protected prgsize: number = 0
    protected prgoff: number = 0
    protected chroff: number = 0
    protected chrsize: number = 0
    
    public nes?: NES
    public cpu?: CPU
    public cpuram?: CPURAM
    public ppu?: PPU 
    
    protected prg: number[] = []
    protected chr: number[] = []
    public chr_map: number[] = []
    protected prg_map: number[] = []
    protected prgram: Uint8Array = new Uint8Array(8192)
    protected scrolltype: MirrorType = MirrorType.H_MIRROR
    protected haschrram: boolean = false
    protected hasprgram: boolean = true
    protected savesram: boolean = false
    
    // CRAM 相关属性
    protected cram?: number[] // Character RAM，用于某些mapper
    protected cramUsed?: number[] // CRAM 使用标记，用于存档状态
    
    // PPU nametables
    protected readonly pput0: number[] = new Array(0x400).fill(0)
    protected readonly pput1: number[] = new Array(0x400).fill(0)
    protected readonly pput2: number[] = new Array(0x400).fill(0)
    protected readonly pput3: number[] = new Array(0x400).fill(0)
    
    // 99% 的游戏只使用其中的 2 个，但我们必须创建 4 个并使用指针指向它们
    // 用于那些有额外 RAM 的 4 屏镜像
    protected nt0: number[] = []
    protected nt1: number[] = []
    protected nt2: number[] = []
    protected nt3: number[] = []

    // 这些是指向 nametables 的指针，所以对于单屏当我们切换
    // 然后再切换回来时，其他单屏 NT 中的数据不会丢失。
    
    protected crc: number = 0
    protected region: TVType = TVType.NTSC

    constructor(loader: ROMLoader) {

        this.setLoader(loader)
    }

    public supportsSaves(): boolean {
        return this.savesram
    }

    public getMapperType(): number {
        return this.mappertype
    }

    public getPRGSize(): number {
        return this.prgsize
    }

    public getCHRSize(): number {
        return this.chrsize
    }

    public destroy(): void {
        this.cpu = void 0
        this.cpuram = void 0
        this.ppu = void 0
    }

    public static crc32(array: number[]): number {

        const c = new CRC32()
        for (const i of array) {
            c.update(i)
        }

        return c.getValue()
    }

    public loadROM(): void {
        this.loader.parseHeader()
        this.prgsize = this.loader.prgsize
        this.mappertype = this.loader.mappertype
        this.prgoff = this.loader.prgoff
        this.chroff = this.loader.chroff
        this.chrsize = this.loader.chrsize
        this.scrolltype = this.loader.scrolltype
        this.savesram = this.loader.savesram
        this.prg = this.loader.load(this.prgsize, this.prgoff)
        this.region = this.loader.tvtype
        this.submapper = this.loader.submapper
        this.crc = Mapper.crc32(this.prg)
        console.log(`Loaded ROM with CRC32: ${this.crc.toString(16).toUpperCase()}`)
        
        // CRC "数据库" 用于某些无法识别的游戏
        if (this.crc === 0x41243492 // low g man (u)
            || this.crc === 0x98CCD385) { // low g man (e)
            this.hasprgram = false
        }
        
        this.chr = this.loader.load(this.chrsize, this.chroff)

        if (this.chrsize === 0) { // chr ram
            this.haschrram = true
            this.chrsize = 8192
            this.chr = new Array(8192).fill(0)
        }
        
        this.prg_map = new Array(32)
        for (let i = 0; i < 32; ++i) {
            this.prg_map[i] = 1024 * i & this.prgsize - 1
        }
        
        this.chr_map = new Array(8)
        for (let i = 0; i < 8; ++i) {
            this.chr_map[i] = 1024 * i & this.chrsize - 1
        }
        
        this.pput0.fill(0xa0)
        this.pput1.fill(0xb0)
        this.pput2.fill(0xc0)
        this.pput3.fill(0xd0)
        this.setmirroring(this.scrolltype)
    }

    public reset(): void {

        // 这是空的，所以没有特定软复位指令的 mapper 无需实现这个
    }

    // 写入卡带的地址空间
    public cartWrite(addr: number, data: number): void {

        // 默认无 mapper 操作只在 PRG RAM 范围内写入
        if (addr >= 0x6000 && addr < 0x8000) {
            this.prgram[addr & 0x1fff] = data
        }
    }

    public cartRead(addr: number): number {

        // 默认在 0x6000 有 wram，在 0x8000-0xfff 有卡带
        // 但一些 mapper 有不同的设置，所以为那些重写
        if (addr >= 0x8000) {
            return this.prg[this.prg_map[(addr & 0x7fff) >> 10] + (addr & 1023)]
        }
        else if (addr >= 0x6000 && this.hasprgram) {
            return this.prgram[addr & 0x1fff]
        }

        return addr >> 8 // open bus
    }

    public ppuRead(addr: number): number {
        if (addr < 0x2000) {
            const chrIndex = this.chr_map[addr >> 10] + (addr & 1023)
            
            // 检查是否使用CRAM
            if (this.cram && chrIndex < this.cram.length) {
                return this.cram[chrIndex]
            }
            
            return this.chr[chrIndex]
        }
        else {
            switch (addr & 0xc00) {
                case 0:
                    return this.nt0[addr & 0x3ff]
                case 0x400:
                    return this.nt1[addr & 0x3ff]
                case 0x800:
                    return this.nt2[addr & 0x3ff]
                case 0xc00:
                default:
                    if (addr >= 0x3f00) {
                        addr &= 0x1f
                        if (addr >= 0x10 && (addr & 3) === 0) {
                            addr -= 0x10
                        }

                        return this.ppu?.pal[addr] ?? 0
                    }
                    else {
                        return this.nt3[addr & 0x3ff]
                    }
            }
        }
    }

    public ppuWrite(addr: number, data: number): void {
        addr &= 0x3fff
        if (addr < 0x2000) {
            const chrIndex = this.chr_map[addr >> 10] + (addr & 1023)
            
            // 检查是否使用CRAM
            if (this.cram && chrIndex < this.cram.length) {
                this.cram[chrIndex] = data

                return
            }
            
            if (this.haschrram) {
                this.chr[chrIndex] = data
            }
        }
        else {
            switch (addr & 0xc00) {
                case 0x0:
                    this.nt0[addr & 0x3ff] = data
                    break
                case 0x400:
                    this.nt1[addr & 0x3ff] = data
                    break
                case 0x800:
                    this.nt2[addr & 0x3ff] = data
                    break
                case 0xc00:
                    if (addr >= 0x3f00 && addr <= 0x3fff) {
                        addr &= 0x1f

                        if (addr >= 0x10 && (addr & 3) === 0) { // 0x10,0x14,0x18 等是 0x0, 0x4,0x8 等的镜像
                            addr -= 0x10
                        }
                        this.ppu!.pal[addr] = data & 0x3f
                    }
                    else {
                        this.nt3[addr & 0x3ff] = data
                    }
                    break
                default:
                    console.error('where?')
            }
        }
    }

    public notifyscanline(_scanline: number): void {

        // 这是空的，所以没有扫描线计数器的 mapper 无需实现
    }

    /**
     * 检查A12线的变化，用于MMC3等mapper
     * @param addr 地址
     */
    public checkA12(_addr: number): void {

        // 默认实现为空
    }

    /**
     * CPU周期通知，用于一些mapper的时钟
     * @param cycles 周期数
     */
    public cpucycle(_cycles: number): void {

        // 默认实现为空
    }

    public getROMInfo(): string {
        return 'ROM INFO:\n'
            + `Mapper Type:  ${this.mappertype}\n`
            + `PRG Size:     ${this.prgsize}\n`
            + `CHR Size:     ${this.chrsize}\n`
            + `Mirroring:    ${this.scrolltype}\n`
            + `Battery Save: ${this.savesram ? 'Yes' : 'No'}\n`
            + `CRC32:        ${this.crc.toString(16).toUpperCase()}\n`
    }

    public setmirroring(type: MirrorType): void {
        
        switch (type) {
            case MirrorType.H_MIRROR:
                this.nt0 = this.pput0
                this.nt1 = this.pput0
                this.nt2 = this.pput1
                this.nt3 = this.pput1
                break
            case MirrorType.V_MIRROR:
                this.nt0 = this.pput0
                this.nt1 = this.pput1
                this.nt2 = this.pput0
                this.nt3 = this.pput1
                break
            case MirrorType.SS_MIRROR0:
                this.nt0 = this.pput0
                this.nt1 = this.pput0
                this.nt2 = this.pput0
                this.nt3 = this.pput0
                break
            case MirrorType.SS_MIRROR1:
                this.nt0 = this.pput1
                this.nt1 = this.pput1
                this.nt2 = this.pput1
                this.nt3 = this.pput1
                break
            case MirrorType.FOUR_SCREEN_MIRROR:
            default:
                this.nt0 = this.pput0
                this.nt1 = this.pput1
                this.nt2 = this.pput2
                this.nt3 = this.pput3
                break
        }
    }

    public hasSRAM() {
        return this.savesram
    }

    public getTVType(): TVType {

        return this.region
    }

    public setPRGRAM(newprgram: number[]): void {

        // const expectedPrgRamSize = this.mapper.getPRGRam()?.length ?? 8192
        // if (newprgram.length !== this.prgsize) {
        //     throw new Error(`PRG RAM must be exactly ${this.prgsize}bytes`)
        // }
        this.prgram = new Uint8Array(newprgram)
    }

    public getPRGRam() {
        return Array.from(this.prgram)
    }

    public getCRC(): number {
        return this.crc
    }

    public getCPURAM() {
        return this.cpuram
    }

    public init(): void {

        // NSF 初始化需要
    }

    /**
     * 自动设置属性值，智能处理不同类型
     */
    private setPropertyValueAuto(propertyName: string, value: any): void {
        const target = this as any
        const originalValue = target[propertyName]
        
        // 使用自动反序列化
        const deserializedValue = _autoDeserializeValue(propertyName, value, this, originalValue)
        
        // 如果返回 undefined，跳过此属性
        if (deserializedValue === undefined) return
        
        // 智能设置值
        if (originalValue instanceof Uint8Array && deserializedValue instanceof Uint8Array) {

            // Uint8Array 使用 set 方法
            originalValue.set(deserializedValue)
        } 
        else if (Array.isArray(originalValue) && Array.isArray(deserializedValue)) {

            // 数组使用 splice 保持引用
            originalValue.splice(0, originalValue.length, ...deserializedValue)
        } 
        else {

            // 其他类型直接赋值
            target[propertyName] = deserializedValue
        }
    }

    /**
     * 获取Mapper状态（用于存档）
     * 完全自动化，无需子类重写
     */
    public getMapperState(): any {
        const state: any = { type: this.mappertype }
        
        // 自动遍历所有属性
        for (const key in this) {
            if (!Object.prototype.hasOwnProperty.call(this, key)) continue
            
            const value = (this as any)[key]
            
            // 判断是否应该序列化
            if (_shouldSerializeProperty(key, value)) {
                const serializedValue = _autoSerializeValue(key, value, this)
                if (serializedValue !== null) {
                    state[key] = serializedValue
                }
            }
        }

        // 添加镜像配置以确保正确恢复
        state.actualMirrorConfig = {
            nt0: this.nt0 === this.pput0 ? 0 : this.nt0 === this.pput1 ? 1 : this.nt0 === this.pput2 ? 2 : this.nt0 === this.pput3 ? 3 : -1,
            nt1: this.nt1 === this.pput0 ? 0 : this.nt1 === this.pput1 ? 1 : this.nt1 === this.pput2 ? 2 : this.nt1 === this.pput3 ? 3 : -1,
            nt2: this.nt2 === this.pput0 ? 0 : this.nt2 === this.pput1 ? 1 : this.nt2 === this.pput2 ? 2 : this.nt2 === this.pput3 ? 3 : -1,
            nt3: this.nt3 === this.pput0 ? 0 : this.nt3 === this.pput1 ? 1 : this.nt3 === this.pput2 ? 2 : this.nt3 === this.pput3 ? 3 : -1,
        }

        // 添加标志以便读档时知道是否需要恢复CHR
        state.haschrram = this.haschrram

        return state
    }

    /**
     * 设置Mapper状态（用于加载存档）
     * 完全自动化，子类只需要在 postLoadState 中处理特殊逻辑
     */
    public setMapperState(state: any): void {
        if (!state) return

        // 如果状态是包装格式（有.state属性），则使用内部状态
        const actualState = state.state || state

        // 自动恢复所有属性
        for (const key in actualState) {
            if (key === 'actualMirrorConfig' || key === 'haschrram' || key === 'type') continue
            
            // 检查当前对象是否有这个属性
            if (key in this) {
                this.setPropertyValueAuto(key, actualState[key])
            }
        }

        // 恢复镜像配置
        if (actualState.actualMirrorConfig) {
            const mirrorConfig = actualState.actualMirrorConfig
            this.nt0 = this.getPputByIndex(mirrorConfig.nt0)
            this.nt1 = this.getPputByIndex(mirrorConfig.nt1)
            this.nt2 = this.getPputByIndex(mirrorConfig.nt2)
            this.nt3 = this.getPputByIndex(mirrorConfig.nt3)
        } 
        else if (actualState.scrolltype !== undefined) {

            // 兼容旧存档：重新设置镜像
            this.setmirroring(actualState.scrolltype)
        }
        
        // 调用子类的后处理方法
        this.postLoadState(actualState)
    }

    /**
     * 子类可以重写此方法来处理加载状态后的特殊逻辑
     * 比如重新设置银行映射、重新创建声音芯片等
     */
    protected postLoadState(_state: any): void {

        // 默认为空，子类可以重写
    }

    /**
     * 根据索引获取对应的 pput 数组
     */
    private getPputByIndex(index: number): number[] {
        switch (index) {
            case 0: return this.pput0
            case 1: return this.pput1
            case 2: return this.pput2
            case 3: return this.pput3
            default: return this.pput0
        }
    }

    // 子类必须实现的构造函数设置
    protected setLoader(loader: ROMLoader): void {
        this.loader = loader
    }

    // ========== Bank Management Methods ==========

    /**
     * 直接设置VROM银行指针和类型
     * @param page 页码 (0-7) 
     * @param data 数据数组
     * @param offset 数据偏移
     * @param length 数据长度
     */
    protected setVROMBank(page: number, data: number[], offset: number = 0, length?: number): void {
        if (length === undefined) {
            length = data.length - offset
        }
        
        // 设置CHR映射，直接指向提供的数据的偏移位置
        this.chr_map[page] = offset
        
        // 如果需要替换整个chr数据，可以在这里处理
        // 但通常我们只是改变映射指针
    }

    /**
     * 设置PRG 8K银行
     * @param page 页码 (4-7)
     * @param bank 银行号
     */
    protected setPROM8KBank(page: number, bank: number): void {
        const bankSize = this.prgsize >> 13 // prgsize / 8192
        const safeBank = bank % bankSize
        const baseIndex = (page - 4) * 8
        const baseOffset = safeBank * 8192

        for (let i = 0; i < 8; i++) {
            this.prg_map[baseIndex + i] = (baseOffset + i * 1024) % this.prgsize
        }
    }

    /**
     * 设置PRG 16K银行
     * @param page 页码 (4, 6)
     * @param bank 银行号
     */
    protected setPROM16KBank(page: number, bank: number): void {
        const bankSize = this.prgsize >> 14 // prgsize / 16384
        const safeBank = bank % bankSize
        this.setPROM8KBank(page, safeBank * 2)
        this.setPROM8KBank(page + 1, safeBank * 2 + 1)
    }

    /**
     * 设置PRG 32K银行
     * @param bank 银行号
     */
    protected setPROM32KBank(bank: number): void {
        const bankSize = this.prgsize >> 15 // prgsize / 32768
        const safeBank = bank % bankSize
        this.setPROM8KBank(4, safeBank * 4)
        this.setPROM8KBank(5, safeBank * 4 + 1)
        this.setPROM8KBank(6, safeBank * 4 + 2)
        this.setPROM8KBank(7, safeBank * 4 + 3)
    }

    /**
     * 设置PRG 32K银行（4个单独的8K银行）
     * @param bank0 银行0
     * @param bank1 银行1
     * @param bank2 银行2
     * @param bank3 银行3
     */
    protected setPROM32KBank4(bank0: number, bank1: number, bank2: number, bank3: number): void {
        this.setPROM8KBank(4, bank0)
        this.setPROM8KBank(5, bank1)
        this.setPROM8KBank(6, bank2)
        this.setPROM8KBank(7, bank3)
    }

    /**
     * 设置CRAM 1K银行 (通常用于CIRAM)
     * @param page 页码 (0-7)
     * @param bank 银行号
     */
    protected setCRAM1KBank(page: number, bank: number): void {

        // 限制银行号在有效范围内 (0x1F = 31)
        bank &= 0x1F
        
        // 在TypeScript实现中，我们需要创建一个CRAM数组如果还没有的话
        if (!this.cram) {
            this.cram = new Array(32 * 1024).fill(0) // 32K CRAM
        }
        
        // 设置CHR映射指向CRAM
        this.chr_map[page] = bank * 1024 % this.cram.length
        
        // 标记CRAM已使用 (用于存档状态)
        if (!this.cramUsed) {
            this.cramUsed = new Array(16).fill(0)
        }
        this.cramUsed[bank >> 2] = 0xFF
    }

    /**
     * 设置CRAM 2K银行
     * @param page 页码 (0-6, 偶数)
     * @param bank 银行号
     */
    protected setCRAM2KBank(page: number, bank: number): void {
        this.setCRAM1KBank(page, bank * 2)
        this.setCRAM1KBank(page + 1, bank * 2 + 1)
    }

    /**
     * 设置CRAM 4K银行
     * @param page 页码 (0, 4)
     * @param bank 银行号
     */
    protected setCRAM4KBank(page: number, bank: number): void {
        this.setCRAM1KBank(page, bank * 4)
        this.setCRAM1KBank(page + 1, bank * 4 + 1)
        this.setCRAM1KBank(page + 2, bank * 4 + 2)
        this.setCRAM1KBank(page + 3, bank * 4 + 3)
    }

    /**
     * 设置CRAM 8K银行
     * @param bank 银行号
     */
    protected setCRAM8KBank(bank: number): void {
        for (let i = 0; i < 8; i++) {
            this.setCRAM1KBank(i, bank * 8 + i)
        }
    }

    /**
     * 设置VROM 1K银行
     * @param page 页码 (0-7)
     * @param bank 银行号
     */
    protected setVROM1KBank(page: number, bank: number): void {
        if (this.chrsize > 0) {
            const bankSize = this.chrsize >> 10 // chrsize / 1024
            const safeBank = bank % bankSize
            this.chr_map[page] = safeBank * 1024
        }
    }

    /**
     * 设置VROM 2K银行
     * @param page 页码 (0, 2, 4, 6)
     * @param bank 银行号
     */
    protected setVROM2KBank(page: number, bank: number): void {
        this.setVROM1KBank(page, bank * 2)
        this.setVROM1KBank(page + 1, bank * 2 + 1)
    }

    /**
     * 设置VROM 4K银行
     * @param page 页码 (0, 4)
     * @param bank 银行号
     */
    protected setVROM4KBank(page: number, bank: number): void {
        this.setVROM1KBank(page, bank * 4)
        this.setVROM1KBank(page + 1, bank * 4 + 1)
        this.setVROM1KBank(page + 2, bank * 4 + 2)
        this.setVROM1KBank(page + 3, bank * 4 + 3)
    }

    /**
     * 设置VROM 8K银行
     * @param bank 银行号
     */
    protected setVROM8KBank(bank: number): void {
        for (let i = 0; i < 8; i++) {
            this.setVROM1KBank(i, bank * 8 + i)
        }
    }

    /**
     * 设置VROM 8K银行（8个单独的1K银行）
     * @param bank0-bank7 各个银行号
     */
    protected setVROM8KBank8(
        bank0: number, bank1: number, bank2: number, bank3: number,
        bank4: number, bank5: number, bank6: number, bank7: number,
    ): void {
        this.setVROM1KBank(0, bank0)
        this.setVROM1KBank(1, bank1)
        this.setVROM1KBank(2, bank2)
        this.setVROM1KBank(3, bank3)
        this.setVROM1KBank(4, bank4)
        this.setVROM1KBank(5, bank5)
        this.setVROM1KBank(6, bank6)
        this.setVROM1KBank(7, bank7)
    }

    /**
     * 获取PRG 8K银行大小
     */
    protected getPROM8KSize(): number {
        return this.prgsize >> 13 // prgsize / 8192
    }

    /**
     * 获取PRG 16K银行大小
     */
    protected getPROM16KSize(): number {
        return this.prgsize >> 14 // prgsize / 16384
    }

    /**
     * 获取PRG 32K银行大小
     */
    protected getPROM32KSize(): number {
        return this.prgsize >> 15 // prgsize / 32768
    }

    /**
     * 获取VROM 1K银行大小
     */
    protected getVROM1KSize(): number {
        return this.chrsize >> 10 // chrsize / 1024
    }

    /**
     * 获取VROM 2K银行大小
     */
    protected getVROM2KSize(): number {
        return this.chrsize >> 11 // chrsize / 2048
    }

    /**
     * 获取VROM 4K银行大小
     */
    protected getVROM4KSize(): number {
        return this.chrsize >> 12 // chrsize / 4096
    }

    /**
     * 获取VROM 8K银行大小
     */
    protected getVROM8KSize(): number {
        return this.chrsize >> 13 // chrsize / 8192
    }

    /**
     * 设置自定义VRAM镜像
     * @param bank0-bank3 各个银行映射
     */
    protected setVRAMMirrorCustom(bank0: number, bank1: number, bank2: number, bank3: number): void {

        // 确保银行号在有效范围内
        const validBank0 = bank0 & 3
        const validBank1 = bank1 & 3
        const validBank2 = bank2 & 3
        const validBank3 = bank3 & 3

        // 根据银行号设置nametable指针
        this.nt0 = this.getPputByIndex(validBank0)
        this.nt1 = this.getPputByIndex(validBank1)
        this.nt2 = this.getPputByIndex(validBank2)
        this.nt3 = this.getPputByIndex(validBank3)
    }
}
