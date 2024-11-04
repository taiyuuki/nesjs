function obejctKeys<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[]
}

function keyIn<T extends object>(key: number | string | symbol, obj: T): key is keyof T {
    return Object.prototype.hasOwnProperty.call(obj, key)
}

function fiilArray<T>(length: number, value: T) {
    return Array.from<T>({ length }).fill(value)
}

export {
    obejctKeys, 
    fiilArray,
    keyIn,
}
