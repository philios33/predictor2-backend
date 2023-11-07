
// 
export interface IEntityStorageEngine {

    storeEntity<T>(type: string, dims: Array<string>, data: T): Promise<void>;
    fetchEntity<T>(type: string, dims: Array<string>): Promise<T | null>;
    removeEntity(type: string, dims: Array<string>): Promise<void>;
    findByLookupId<T>(type: string, lookupId: string): Promise<Array<T>>;
    

}