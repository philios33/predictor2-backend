
// The V2 entity storage engine is designed with AWS DynamoDB in mind using known techniques that I have already used for storage
// It does not support lookups by a secondary lookup key yet, but it should be quite easy to support it by just adding an index in the dynamodb table.

export interface EntityRecord {
    entityId: string
}
export interface IEntityStorageEngineV2 {
    putEntity<T extends EntityRecord>(document: T): Promise<void>;
    putEntityIfNotExists<T extends EntityRecord>(document: T): Promise<void>;
    deleteEntity(keyValue: string): Promise<void>;
    fetchEntity<T extends EntityRecord>(keyValue: string): Promise<T | null>;
    setMapKeyValueOfEntity<T extends Record<string, any>>(keyValue: string, entityMapKey: string, mapKeyId: string, mapValue: T): Promise<void>;
    removeMapKeyValueOfEntity(keyValue: string, entityMapKey: string, mapKeyId: string): Promise<void>;

    updateEntity(keyValue: string, updates: Record<string, any>): Promise<void>;
}
