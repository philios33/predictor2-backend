import { EntityRecord, IEntityStorageEngineV2 } from "./entityStorageV2";

export class MemoryEntityStorageEngineV2 implements IEntityStorageEngineV2 {

    private storage: Record<string, any>; // Record of entity ids to their corresponding objects

    constructor() {
        this.storage = {};
    }

    async putEntity<T extends EntityRecord>(document: T): Promise<void> {
        const idKey = document.entityId;
        if (typeof idKey === "undefined") {
            throw new Error("Cannot put entity, missing key: entityId");
        }
        this.storage[idKey] = document;
    }

    async putEntityIfNotExists<T extends EntityRecord>(document: T): Promise<void> {
        const idKey = document.entityId;
        if (typeof idKey === "undefined") {
            throw new Error("Cannot put entity, missing key: entityId");
        }
        if (idKey in this.storage) {
            // Skip
        } else {
            this.storage[idKey] = document;
        }
    }

    async deleteEntity(keyValue: string): Promise<void> {
        const idKey = keyValue;
        if (idKey in this.storage) {
            delete this.storage[idKey];
        }
    }

    async fetchEntity<T extends EntityRecord>(keyValue: string): Promise<T | null> {
        const idKey = keyValue;
        if (idKey in this.storage) {
            return this.storage[idKey];
        } else {
            return null;
        }
    }

    async setMapKeyValueOfEntity(keyValue: string, entityMapKey: string, mapKeyId: string, mapValue: Record<string, any>): Promise<void> {
        const idKey = keyValue;
        if (idKey in this.storage) {
            // Found entity
            const found = this.storage[idKey];
            if (typeof found[entityMapKey] === "object" && typeof found[entityMapKey] !== null) {
                // The map key exists, set the value for this id
                found[entityMapKey][mapKeyId] = mapValue;
            }
        } else {
            throw new Error("Not found entity: " + keyValue);
        }
    }

    async removeMapKeyValueOfEntity(keyValue: string, entityMapKey: string, mapKeyId: string): Promise<void> {
        const idKey = keyValue;
        if (idKey in this.storage) {
            // Found entity
            const found = this.storage[idKey];
            if (typeof found[entityMapKey] === "object" && typeof found[entityMapKey] !== null) {
                // The map key exists, remove the value for this id
                delete found[entityMapKey][mapKeyId];
            }
        } else {
            throw new Error("Not found entity: " + keyValue);
        }
    }

    async updateEntity(keyValue: string, updates: Record<string, any>): Promise<void> {
        // We mutate the storage value
        const idKey = keyValue;
        if (idKey in this.storage) {
            // Found entity
            const found = this.storage[idKey];
            for (const keyId in updates) {
                const newValue = updates[keyId];
                found[keyId] = newValue;
            }
        } else {
            throw new Error("Not found entity: " + keyValue);
        }
    }
}
