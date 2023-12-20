import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
  } from "@aws-sdk/client-apigatewaymanagementapi";

import { AWSSocket, SocketMessage, VersionedDataSystem } from '../../../../dist/src/lib/versionedDataSystem.js';
import { AWSDynamoDBEntityStorageEngineV2 } from '../../../../dist/src/lib/AWSDynamoDBEntityStorageEngineV2.js';

const docClient = new DynamoDBClient();
const storage = new AWSDynamoDBEntityStorageEngineV2(docClient, "data-storage");
const versionSystem = new VersionedDataSystem(storage);
versionSystem.setSocketNotifyCallback(async (socket: AWSSocket, message: SocketMessage) => {
    // Send to the actual API Gateway client
    const callbackUrl = `https://${socket.domainName}/${socket.stage}`;
    const client = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });
    const messagePayload = JSON.stringify(message);
    const requestParams = {
        ConnectionId: socket.connectionId,
        Data: messagePayload,
    };
    const command = new PostToConnectionCommand(requestParams);
    try {
        await client.send(command);
    } catch (error) {
        console.log(error);
    }
});
// Note: If we want to call .writeData, we need to connect the Queue system to GCP PubSub system
// but it is unlikely that the incoming socket commands will need to use writeData commands directly


export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    try {       
        const socket: AWSSocket = {
            domainName: event.requestContext.domainName,
            stage: event.requestContext.stage,
            connectionId: event.requestContext.connectionId,
        }

        if (event.requestContext.routeKey === "$connect") {
            // Connection
            console.log("Connection event", JSON.stringify(event));

            await versionSystem.socketConnect(socket);

            return {
                statusCode: 200,
                body: JSON.stringify("OK"),
            };

        } else if (event.requestContext.routeKey === "$disconnect") {
            // Disconnection
            console.log("Disconnection event", JSON.stringify(event));

            await versionSystem.socketDisconnect(socket);

            return {
                statusCode: 200,
                body: JSON.stringify("OK"),
            };
            
        } else {
            
            if (event.body) {
                const content = JSON.parse(event.body);
                console.log("Other Event", JSON.stringify(content));

                if (content.action === "subscribe") {
                    console.log("Subscribe event", JSON.stringify(event));

                    if (content.subscriptions && content.subscriptions instanceof Array) {
                        for (const subscription of content.subscriptions) {
                            // Validate each subscription
                            const dataNamespace = subscription.namespace;
                            const dataKeyId = subscription.dataKeyId;
                            const lastKnownVersionId = typeof subscription.lastKnownVersionId === "number" ? subscription.lastKnownVersionId : undefined;

                            if (typeof dataNamespace === "string" && typeof dataKeyId === "string") {
                                await versionSystem.socketSubscribe(socket, {
                                    dataNamespace,
                                    dataKeyId,
                                    lastKnownVersionId
                                });
                            } else {
                                console.warn("Bad subscription format", JSON.stringify(subscription));
                                throw new Error("Invalid subscription format");
                            }
                        }
                    }

                    return {
                        statusCode: 200,
                    }

                } else if (content.action === "unsubscribe") {
                    console.log("Unsubscribe event", JSON.stringify(event));

                    if (content.subscriptions && content.subscriptions instanceof Array) {
                        for (const subscription of content.subscriptions) {
                            // Validate each subscription
                            const dataNamespace = subscription.namespace;
                            const dataKeyId = subscription.dataKeyId;
                            
                            if (typeof dataNamespace === "string" && typeof dataKeyId === "string") {
                                await versionSystem.socketUnsubscribe(socket, {
                                    dataNamespace,
                                    dataKeyId,
                                });
                            } else {
                                console.warn("Bad subscription format", JSON.stringify(subscription));
                                throw new Error("Invalid subscription format");
                            }
                        }
                    }

                    return {
                        statusCode: 200,
                    }

                } else {
                    throw new Error("Unknown event: " + content.action);
                }
            } else {
                throw new Error("Missing body");
            }
        }
    } catch (err) {
        console.log("Error", err);
        return {
            statusCode: 500,
            body: JSON.stringify((err as Error).message)
        };
    }
};
