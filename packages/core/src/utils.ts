import type { From, HasJSON, To } from './type'

function copyArrayElements<T>(
    src: Array<T>,
    srcPos: number,
    dest: Array<T>, 
    destPos: number, length: number,
) {
    for (let i = 0; i < length; ++i) {
        dest[destPos + i] = src[srcPos + i]
    }
}

function copyArray<T>(src: Array<T>) {
    return src.slice(0)
}

function toJSON<O extends HasJSON>(obj: From<O>): To<O> {
    const json = {} as To<O>
    for (let i = 0; i < obj.JSON_PROPERTIES.length; ++i) {
        json[obj.JSON_PROPERTIES[i]] = obj[obj.JSON_PROPERTIES[i]]
    }

    return json
}

function fromJSON<O extends HasJSON>(obj: From<O>, json: To<O>) {
    for (let i = 0; i < obj.JSON_PROPERTIES.length; ++i) {
        obj[obj.JSON_PROPERTIES[i]] = json[obj.JSON_PROPERTIES[i]]
    }
}

export {
    copyArrayElements,
    copyArray,
    toJSON,
    fromJSON,
}
