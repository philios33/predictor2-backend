// The idea of versioned data is that any updates to a versioned data key will be sent as diffs to the listening sockets
// This is a stateless encapsulation class of the logic which can be instantiated by production lambdas, or locally for testing purposes.
// The system expects to receive signals such as connectedSocket, disconnectedSocket, subscribe (to handle connections), and queue synchronised writeData message
// The system allows for the overriding of handling the writeData function so we can add it to some queue.

import { IEntityStorageEngineV2 } from "./entityStorageV2"
import hash from "object-hash";
import { compare as calculateObjectDelta } from 'deep-diff-patcher';

export type AWSSocket = {
    domainName: string
    stage: string
    connectionId: string
}

export type SubscribeRequest = {
    dataNamespace: string
    dataKeyId: string
    lastKnownVersionId?: number
}
export type UnsubscribeRequest = {
    dataNamespace: string
    dataKeyId: string
}

export type SocketMessage = {
    type: string
    meta: Record<string, any>
}

export type FIFOMessage = {
    // AWS SQS format
    /*
    messageGroupId: string
    messageDeduplicationId: string
    messageBody: string
    */

    // GCP PubSub format
    orderingKey: string
    data: string
}

export type FIFOMessageBody = {
    type: string
    meta: Record<string, any>
}

export type SocketEntity = {
    entityId: string
    socketDomainName: string
    socketStage: string
    socketConnectionId: string
    subscribedEntities: Record<string, SocketSubscriptionMeta>
    createdAt: string
}
export type SocketSubscriptionMeta = {
    subscribedAt: string
}
export type DataEntity = {
    entityId: string
    data: string
    versionId: number
    subscriptions: Record<string, DataSubscriptionsMeta>
}
export type DataSubscriptionsMeta = {
    domainName: string
    stage: string
    connectionId: string
}

export class VersionedDataSystem {

    private socketNotifyCallback: (socket: AWSSocket, message: SocketMessage) => Promise<void>;
    private enqueuedFIFOMessageHandler: (message: FIFOMessage) => Promise<void>;
    private entityStorage: IEntityStorageEngineV2;

    constructor(entityStorage: IEntityStorageEngineV2) {
        this.socketNotifyCallback = async (socket: AWSSocket, message: SocketMessage) => {
            // console.log("Sending socket message to " + socket.connectionId + ": " + JSON.stringify(message));
            throw new Error("Please override this using setSocketNotifyCallback");
        }

        this.enqueuedFIFOMessageHandler = async (message: FIFOMessage) => {
            await this.handleFIFOMessage(message);
        }

        this.entityStorage = entityStorage;
    }

    public async socketConnect(socket: AWSSocket) {
        // Insert socket entity
        const entityId = "SOCKET_" + socket.domainName + "_" + socket.stage + "_" + socket.connectionId;
        const now = new Date();
        const nowIso = now.toISOString();
        const document = {
            entityId: entityId,
            socketDomainName: socket.domainName,
            socketStage: socket.stage,
            socketConnectionId: socket.connectionId,
            subscribedEntities: {},
            createdAt: nowIso,
        }
        await this.entityStorage.putEntity(document);
        console.log("Successful socket insert: " + socket.connectionId);
    }

    public async socketDisconnect(socket: AWSSocket) {
        const socketEntityId = "SOCKET_" + socket.domainName + "_" + socket.stage + "_" + socket.connectionId;
        // Automatically unsubscribe from the subscribed datas by looking up the socket entity

        const found = await this.entityStorage.fetchEntity<SocketEntity>(socketEntityId);
        if (found === null) {
            throw new Error("Unknown socket: " + socket.connectionId);
        }

        console.log("FOUND SOCKET TO DELETE", JSON.stringify(found));

        const subscriptions = found.subscribedEntities || {};
        for (const dataEntityId in subscriptions) {
            // Remove this socket from the subscriptions
            await this.entityStorage.removeMapKeyValueOfEntity(dataEntityId, "subscriptions", socketEntityId);
            console.log("auto unsubscribeSocketFromDataKey (during deleteSocket) socketEntityId " + socketEntityId + " and dataEntityId " + dataEntityId);
        }
        
        await this.entityStorage.deleteEntity(socketEntityId);
        console.log("Successful socket deletion: " + socket.connectionId);
    }

    public async socketSubscribe(socket: AWSSocket, subscribeRequest: SubscribeRequest) {
        // Get current state of this data
        const dataEntityId = "DATA_" + subscribeRequest.dataNamespace + "_" + subscribeRequest.dataKeyId;
        const socketEntityId = "SOCKET_" + socket.domainName + "_" + socket.stage + "_" + socket.connectionId;

        // First, attempt to subscribe to this data key
        await this.entityStorage.setMapKeyValueOfEntity<DataSubscriptionsMeta>(dataEntityId, "subscriptions", socketEntityId, {
            domainName: socket.domainName,
            stage: socket.stage,
            connectionId: socket.connectionId,
        });
        
        // Store a double mapping of the subscription so we can unsubscribe all handles when the socket disconnects
        // The socket should already exist in the database, so we can just add this entityId to the socket
        const now = new Date();
        const nowIso = now.toISOString();
        await this.entityStorage.setMapKeyValueOfEntity<SocketSubscriptionMeta>(socketEntityId, "subscribedEntities", dataEntityId, {
            subscribedAt: nowIso
        });

        console.log("SUBSCRIBED", socketEntityId, dataEntityId);

        const found = await this.entityStorage.fetchEntity<DataEntity>(dataEntityId);
        if (found === null) {
            throw new Error("Data entity not found: " + dataEntityId);
        }

        if (typeof found.data !== "string") {
            throw new Error("Entity found but with missing data");
        }

        const currentVersionId = typeof found.versionId === "number" ? found.versionId : null;

        if (currentVersionId === null) {
            throw new Error("Current version id is null");
        }

        let reportFullState = true;
        if (typeof subscribeRequest.lastKnownVersionId === "number") {
            if (currentVersionId > subscribeRequest.lastKnownVersionId) {
                // Last known id specified, but data has moved on since then
                // Report the full state
            } else if (currentVersionId < subscribeRequest.lastKnownVersionId) {
                // throw new Error("Impossible, this version of the data has never happened");
                // But just report anyway
            } else {
                // Equal, no need to report state
                reportFullState = false;
            }
        }
        if (reportFullState) {
            const message = {
                type: "FULL_STATE",
                meta: {
                    dataNamespace: subscribeRequest.dataNamespace,
                    dataKeyId: subscribeRequest.dataKeyId,
                    state: JSON.parse(found.data),
                    versionId: currentVersionId
                }
            }
            await this.socketNotifyCallback(socket, message);
        }
    }

    public async socketUnsubscribe(socket: AWSSocket, unsubscribeRequest: UnsubscribeRequest) {
        // Remove the subscription from the data entity
        const dataEntityId = "DATA_" + unsubscribeRequest.dataNamespace + "_" + unsubscribeRequest.dataKeyId;
        const socketEntityId = "SOCKET_" + socket.domainName + "_" + socket.stage + "_" + socket.connectionId;
        
        // Remove the subscription from the data entity
        await this.entityStorage.removeMapKeyValueOfEntity(dataEntityId, "subscriptions", socketEntityId);

        // Remove the subscription from the socket entity
        await this.entityStorage.removeMapKeyValueOfEntity(socketEntityId, "subscribedEntities", dataEntityId);

        console.log("UNSUBSCRIBED", socketEntityId, dataEntityId);
    }

    public async writeData(dataNamespace: string, dataKeyId: string, dataValue: any, timestamp: number) {
        // Write a message down the FIFO queue to synchronise the calls
        const random =  Math.round(Math.random() * 99999);
        // const messageDeduplicationId = hash([dataNamespace, dataKeyId, dataValue, timestamp, random]);
        const messageGroupId = "DATAKEY_" + dataNamespace + "-" + dataKeyId;
        const messagePayload: FIFOMessageBody = {
            type: "writeData",
            meta: {
                dataNamespace,
                dataKeyId,
                dataValue,
            }
        }
        await this.enqueueFIFOMessage({
            orderingKey: messageGroupId,
            // messageDeduplicationId,
            data: JSON.stringify(messagePayload)
        });
    }

    private async enqueueFIFOMessage(message: FIFOMessage) {
        // How this is handled is overridable, but the default is to just pass it through to the handler now.
        return await this.enqueuedFIFOMessageHandler(message);
    }
    public async handleFIFOMessage(message: FIFOMessage) : Promise<void> {
        const content = JSON.parse(message.data);

        const eventType = content.type;
        const eventMeta = content.meta;

        if (eventType === "writeData") {
            // Write (or update) this data in dynamoDB
            const dataNamespace = eventMeta.dataNamespace;
            const dataKeyId = eventMeta.dataKeyId;
            const dataValue = eventMeta.dataValue;

            const dataEntityId = "DATA_" + dataNamespace + "_" + dataKeyId;
            const now = new Date();
            const nowIso = now.toISOString();

            const current = await this.entityStorage.fetchEntity<DataEntity>(dataEntityId);
            if (current === null) {
                const namespaceEntityId = "NAMESPACE_" + dataNamespace;
                await this.entityStorage.putEntityIfNotExists({
                    entityId: namespaceEntityId,
                    dataKeys: {}
                });

                await this.entityStorage.putEntity({
                    entityId: dataEntityId,
                    dataNamespace,
                    dataKeyId,
                    versionId: 1,
                    data: JSON.stringify(dataValue),
                    updatedAt: nowIso,
                    subscriptions: {}
                });

                // Create mirror in the namespace entity to keep track of this data key id
                await this.entityStorage.setMapKeyValueOfEntity<SocketSubscriptionMeta>(namespaceEntityId, "dataKeys", dataKeyId, {
                    subscribedAt: nowIso
                });
                
            } else {
                if (typeof current.data !== "string") {
                    throw new Error("Missing data key in data entity that exists: " + dataKeyId);
                }
                const currentObj = JSON.parse(current.data);

                // Note, using deep-equal bloats my bundle to 100Kb, using object-hash is much more efficient
                /*
                if (deepEqual(currentObj, dataValue, { strict: true })) {
                    console.log("Noop, data has not changed");
                    return;
                }
                */
                const hashCurrent = hash(currentObj);
                const hashNew = hash(dataValue);
                if (hashCurrent === hashNew) {
                    console.log("Noop, data has not changed");
                    return;
                }

                const nextVersion = current.versionId + 1;

                await this.entityStorage.updateEntity(dataEntityId, {
                    data: JSON.stringify(dataValue),
                    versionId: nextVersion,
                    updatedAt: nowIso,
                });

                console.log("Successful update of " + dataEntityId + " to version " + nextVersion);

                if (Object.keys(current.subscriptions || {}).length > 0) {
                    
                    // Calculate the diff between the two states
                    const calculatedDiff = calculateObjectDelta(currentObj, dataValue);

                    for (const socketId in current.subscriptions) {
                        // Send this diff event to each socket
                        const socket = current.subscriptions[socketId];
                        console.log("Socket " + socketId, JSON.stringify(socket));
                        const message = {
                            type: "DELTA_STATE",
                            meta: {
                                dataNamespace,
                                dataKeyId,
                                toVersionId: nextVersion,
                                diff: calculatedDiff,
                            }
                        }
                        await this.socketNotifyCallback(socket, message);
                        console.log("Send delta to socket: " + socket.connectionId);
                    }
                }
            }
        } else {
            throw new Error("Unknown event type: " + eventType);
        }
    }

    setSocketNotifyCallback(callback: (socket: AWSSocket, message: SocketMessage) => Promise<void>) {
        this.socketNotifyCallback = callback;
    }

    setEnqueuedFIFOMessageHandler(callback: (message: FIFOMessage) => Promise<void>) {
        this.enqueuedFIFOMessageHandler = callback;
    }
}