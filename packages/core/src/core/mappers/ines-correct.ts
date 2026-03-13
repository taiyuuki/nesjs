/**
 * ROM database entry for mapper corrections
 */
export interface ROMDBEntry {
    crc32:  number
    mapper: number
}

// ROM database for mapper corrections (CRC32 -> correct mapper)
export const ROM_DATABASE: ROMDBEntry[] = [
    { crc32: 0xe84274c5, mapper: 66 }, // Mississippi Satsujin Jiken (J) - header says 8, should be 66
    { crc32: 0xbde3ae9b, mapper: 66 }, // Doraemon 
    { crc32: 0x9552e8df, mapper: 66 }, // Dragon Ball 
    { crc32: 0x811f06d9, mapper: 66 }, // Dragon Power 
    { crc32: 0xd26efd78, mapper: 66 }, // SMB Duck Hunt 
    { crc32: 0x1c098942, mapper: 162 }, // Xi You Ji Hou Zhuan (Ch) - header says 163, should be 162
]
