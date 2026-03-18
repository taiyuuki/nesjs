/**
 * ROM database entry for mapper corrections
 */
export type ROMDBEntry = [crc32: number, mapper: number]

// ROM database for mapper corrections (CRC32 -> correct mapper)
export const ROM_DATABASE: ROMDBEntry[] = [
    [0xbc7b1d0f, 33], // Bakushou!! Jinsei Gekijou 2
    [0xe84274c5, 66], // Mississippi Satsujin Jiken (J) - header says 8, should be 66
    [0xbde3ae9b, 66], // Doraemon 
    [0x9552e8df, 66], // Dragon Ball 
    [0x811f06d9, 66], // Dragon Power 
    [0xd26efd78, 66], // SMB Duck Hunt 
    [0x7678f1d5, 207], // Fudou Myouou Den (J) - header often says 80, should be 207
    [0x1c098942, 162], // Xi You Ji Hou Zhuan (Ch) - header says 163, should be 162
]
