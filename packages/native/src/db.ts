class DB<T = any> {
    private _dataFactory = window.indexedDB
    private _dbName: string
    private _storeName: string
    private _database!: IDBDatabase
    private _res: IDBRequest

    constructor(dbName: string, storeName: string, version = 1) {
        this._dbName = dbName
        this._storeName = storeName
        this._res = this._dataFactory.open(this._dbName, version)

        this._res.addEventListener('success', () => {
            this._database = this._res.result
            if (!this._database.objectStoreNames.contains(this._storeName)) {
                this._database.createObjectStore(this._storeName, { keyPath: 'id' })
            }
        })
        this._res.addEventListener('error', () => {
            console.error('indexedDB load error')
        })
        this._res.addEventListener('upgradeneeded', () => {
            this._database = this._res.result
            if (!this._database.objectStoreNames.contains(this._storeName)) {
                this._database.createObjectStore(this._storeName, { keyPath: 'id' })
            }
        })
    }

    private get _store() {
        return this._database.transaction([this._storeName], 'readwrite').objectStore(this._storeName)
    }

    setItem(id: string, data: T) {
        this._store.put({ id, data })
    }

    getItem(id: string): Promise<T> {
        const res = this._store.get(id)

        return new Promise((resolve, reject) => {
            res.addEventListener('success', () => {
                resolve(res.result.data)
            })
            res.addEventListener('error', reject)
        })
    }

    removeItem(id: string) {
        this._store.delete(id)
    }

    clear() {
        this._store.clear()
    }
}

export { DB }
