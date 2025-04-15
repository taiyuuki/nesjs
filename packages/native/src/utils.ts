function obejctKeys<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[]
}

function keyIn<T extends object>(key: number | string | symbol, obj: T): key is keyof T {
    return Reflect.has(obj, key)
}

function fiilArray<T>(length: number, value: T) {
    return Array.from<T>({ length }).fill(value)
}

function randomString(length = 10) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    return result
}

export {
    obejctKeys, 
    fiilArray,
    keyIn,
    randomString,
}
