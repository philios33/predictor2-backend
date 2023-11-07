import { IEntityStorageEngine } from "./entityStorage";

export class MemoryEntityStorageEngine implements IEntityStorageEngine {

    private storage: Record<string, Record<string, any>>;

    constructor() {
        this.storage = {};
    }

    storeEntity<T>(type: string, dims: string[], data: T): Promise<void> {
        if (!(type in this.storage)) {
            this.storage[type] = {};
        }
        const idKey = dims.join('_');
        this.storage[type][idKey] = data;
        return Promise.resolve();
    }

    fetchEntity<T>(type: string, dims: string[]): Promise<T | null> {
        if (!(type in this.storage)) {
            return Promise.resolve(null);
        }
        const idKey = dims.join('_');
        if (!(idKey in this.storage[type])) {
            return Promise.resolve(null);
        } else {
            return Promise.resolve(this.storage[type][idKey]);
        }
    }

    removeEntity(type: string, dims: string[]): Promise<void> {
        if (!(type in this.storage)) {
            return Promise.resolve();
        }
        const idKey = dims.join('_');
        if (!(idKey in this.storage[type])) {
            return Promise.resolve();
        } else {
            delete this.storage[type][idKey];
            return Promise.resolve();
        }
    }

    findByLookupId<T>(type: string, lookupId: string): Promise<T[]> {
        if (!(type in this.storage)) {
            return Promise.resolve([]);
        } else {
            const all = Object.values(this.storage[type]);
            const relevant = all.filter((item) => {
                return item.meta.lookupId === lookupId;
            });
            return Promise.resolve(relevant);
        }
    }
    
}