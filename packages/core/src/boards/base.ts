import type { NES } from 'src/nes'

/* Estimated number of games with mapper (other mappers had <10 games)
Mapper 004: 569
Mapper 001: 481
Mapper 000: 260
Mapper 002: 200
Mapper 003: 145
Mapper 007: 56
Mapper 011: 35
Mapper 019: 32
Mapper 016: 26
Mapper 099: 25
Mapper 005: 24
Mapper 018: 16
Mapper 066: 16
Mapper 033: 15
Mapper 079: 15
Mapper 045: 14
Mapper 071: 14
Mapper 113: 12
Mapper 245: 11
Mapper 023: 11
Mapper 069: 11 
*/

class BaseMapper {
    joy1StrobeState = 0
    joy2StrobeState = 0
    joypadLastWrite = 0
  
    zapperFired = false
    zapperX = 0
    zapperY = 0
    
    constructor(public nes: NES) {}

    reset() {
        this.joy1StrobeState = 0
        this.joy2StrobeState = 0
        this.joypadLastWrite = 0
    
        this.zapperFired = false
        this.zapperX = 0
        this.zapperY = 0
    }
          
    toJSON() {
        const obj: any = {}
        for (const key in this) {
            if (key === 'nes') {
                continue
            }
            obj[key] = this[key]
        }

        return obj
    }
      
    fromJSON(s: BaseMapper) {
        Object.assign(this, s)
    }  
}

export { BaseMapper }
