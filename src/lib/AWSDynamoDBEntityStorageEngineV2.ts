import { DynamoDBClient, PutItemCommandInput, PutItemCommand, DeleteItemCommandInput, DeleteItemCommand, QueryCommandInput, QueryCommand, UpdateItemCommandInput, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { EntityRecord, IEntityStorageEngineV2 } from "./entityStorageV2";

export class AWSDynamoDBEntityStorageEngineV2 implements IEntityStorageEngineV2 {

    private client: DynamoDBClient;
    private tableName: string;

    constructor(client: DynamoDBClient, tableName: string) {
        this.client = client;
        this.tableName = tableName;
    }

    async putEntity<T extends EntityRecord>(document: T): Promise<void> {
        const idKey = document.entityId;
        if (typeof idKey === "undefined") {
            throw new Error("Cannot put entity, missing key: entityId");
        }
        const putInput: PutItemCommandInput = {
            TableName: this.tableName,
            Item: marshall(document)
        }
        await this.client.send(new PutItemCommand(putInput));
    }

    async putEntityIfNotExists<T extends EntityRecord>(document: T): Promise<void> {
        const idKey = document.entityId;
        if (typeof idKey === "undefined") {
            throw new Error("Cannot put entity, missing key: entityId");
        }
        const putInput: PutItemCommandInput = {
            TableName: this.tableName,
            Item: marshall(document),
            ConditionExpression: 'attribute_not_exists(entityId)'
        }
        try {
            await this.client.send(new PutItemCommand(putInput));
        } catch(e) {
            if ((e as Error).name === "ConditionalCheckFailedException") {
                // This is not really an error we care about.  In fact, this should silently skip the PUT if the entity already exists.
            } else {
                throw e;
            }
        }
    }

    async deleteEntity(keyValue: string): Promise<void> {
        const delInput: DeleteItemCommandInput = {
            TableName: this.tableName,
            Key: {
                "entityId": {
                    S: keyValue
                }
            }
        }
        await this.client.send(new DeleteItemCommand(delInput));
    }

    async fetchEntity<T extends EntityRecord>(keyValue: string): Promise<T | null> {
        const queryParams: QueryCommandInput = {
            TableName: this.tableName,
            KeyConditionExpression: "entityId = :entityId",
            ExpressionAttributeValues: {
                ":entityId": {
                    S: keyValue
                }
            }
        }
        const fetchResult = await this.client.send(new QueryCommand(queryParams));
        if (fetchResult.Count === 0) {
            return null;
        } else if (fetchResult.Items && fetchResult.Count === 1) {
            // Found this data
            const found = unmarshall(fetchResult.Items[0]);
            return found as never as T;
        } else {
            throw new Error("Possible duplicate entity: " + keyValue);
        }
    }

    async setMapKeyValueOfEntity<T extends Record<string, any>>(keyValue: string, entityMapKey: string, mapKeyId: string, mapValue: T): Promise<void> {
        const updateParams: UpdateItemCommandInput = {
            TableName: this.tableName,
            Key: {
                "entityId": {
                    S: keyValue
                }
            },
            UpdateExpression: "SET #entityMapKey.#mapKeyId = :mapVal",
            ExpressionAttributeNames: {
                "#entityMapKey": entityMapKey,
                "#mapKeyId": mapKeyId,
            },
            ExpressionAttributeValues: {
                ":mapVal": {
                    M: marshall(mapValue, {convertTopLevelContainer: false}),
                }
            }
        };
        await this.client.send(new UpdateItemCommand(updateParams));
    }

    async removeMapKeyValueOfEntity(keyValue: string, entityMapKey: string, mapKeyId: string): Promise<void> {
        const updateParams: UpdateItemCommandInput = {
            TableName: this.tableName,
            Key: {
                "entityId": {
                    S: keyValue
                }
            },
            UpdateExpression: "REMOVE #entityMapKey.#mapKeyId",
            ExpressionAttributeNames: {
                "#entityMapKey": entityMapKey,
                "#mapKeyId": mapKeyId,
            },
        };
        await this.client.send(new UpdateItemCommand(updateParams));
    }

    async updateEntity(keyValue: string, updates: Record<string, any>): Promise<void> {
        
        const updateExpressions = [];
        const attrNames: Record<string, string> = {};
        const attrValues: Record<string, any> = {};
        for (const fieldId in updates) {
            const newValue = updates[fieldId];
            updateExpressions.push("#" + fieldId + " = :" + fieldId);
            attrNames["#" + fieldId] = fieldId;
            attrValues[":" + fieldId] = marshall(newValue);
        }

        const updateParams: UpdateItemCommandInput = {
            TableName: "data-storage",
            Key: {
                "entityId": {
                    S: keyValue
                }
            },
            UpdateExpression: "SET " + updateExpressions.join(", "),
            ExpressionAttributeNames: attrNames,
            ExpressionAttributeValues: attrValues,
        };
        await this.client.send(new UpdateItemCommand(updateParams));
    }
}
