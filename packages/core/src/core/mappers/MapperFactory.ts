
import type { ROMLoader } from '../ROMLoader'
import type { Mapper } from './Mapper'
import { MAPPER_LIST } from './list'
import { dynamicMappers } from './dyn'

/**
 * Mapper注册器 - 用于管理和动态加载Mapper
 */
export class MapperRegistry {
    private static instance: MapperRegistry
    private loadedMappers: Map<string, typeof Mapper> = new Map()

    private constructor() {}

    /**
   * 获取注册器单例
   */
    public static getInstance(): MapperRegistry {
        if (!MapperRegistry.instance) {
            MapperRegistry.instance = new MapperRegistry()
        }

        return MapperRegistry.instance
    }

    /**
   * 获取Mapper构造函数
   * @param mapperNumber Mapper编号
   * @param submapper Submapper编号（用于区分同一mapper编号下的不同变体）
   */
    public async getMapperConstructor(mapperNumber: number, submapper?: number): Promise<typeof Mapper | null> {

        // 特殊处理：Mapper 4根据submapper区分MMC3和MMC6
        if (mapperNumber === 4) {
            const mapperTypeString = submapper === 1 ? 'MMC6Mapper' : 'MMC3Mapper'
            if (dynamicMappers[mapperTypeString]) {

                // 检查是否已经加载
                if (this.loadedMappers.has(mapperTypeString)) {

                    return this.loadedMappers.get(mapperTypeString)!
                }
        
                // 动态加载
                try {
                    const mod = await dynamicMappers[mapperTypeString]()
                    const MapperClass = mod.default
                    this.loadedMappers.set(mapperTypeString, MapperClass)
        
                    return MapperClass
                }
                catch(error) {
                    console.error(`Failed to load mapper ${mapperNumber}:${submapper}:`, error)
        
                    return null
                }
            }
        }

        // 通用处理
        const mapperTypeString = MAPPER_LIST[mapperNumber]

        if (mapperTypeString && dynamicMappers[mapperTypeString]) {

            // 检查是否已经加载
            if (this.loadedMappers.has(mapperTypeString)) {

                return this.loadedMappers.get(mapperTypeString)!
            }
    
            // 动态加载
            try {
                const mod = await dynamicMappers[mapperTypeString]()
                const MapperClass = mod.default
                this.loadedMappers.set(mapperTypeString, MapperClass)
    
                return MapperClass
            }
            catch(error) {
                console.error(`Failed to load mapper ${mapperNumber}:`, error)
    
                return null
            }
        }
        else {
            return null
        }

    }

    /**
   * 创建Mapper实例
   * @param loader ROM加载器
   */
    public async createMapper(loader: ROMLoader): Promise<Mapper | null> {
        const mapperClass = await this.getMapperConstructor(loader.mappertype, loader.submapper)
        if (!mapperClass) {
            return null
        }

        return new mapperClass(loader)
    }

}

/**
 * Mapper工厂 - 根据ROM头部信息创建对应的Mapper
 */
export async function getMapper(loader: ROMLoader): Promise<Mapper> {

    const mapperRegistry = MapperRegistry.getInstance()
    try {

        const mapper = await mapperRegistry.createMapper(loader)
        if (!mapper) {
            throw new Error(`Unsupport Mapper Type: ${loader.mappertype}`)  
        }

        return mapper
    }
    catch(err) {
        console.error(err)
        throw new Error(`Unsupport Mapper Type: ${loader.mappertype}`)  
    }
}
