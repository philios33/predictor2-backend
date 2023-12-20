
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
  } from "@aws-sdk/client-apigatewaymanagementapi";

import { AWSSocket, FIFOMessage, SocketMessage, VersionedDataSystem } from '../../../../dist/src/lib/versionedDataSystem.js';
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
// Note: No need to setup FIFO queue pushing, because we are consuming FIFO events, not pushing them.

export const handler: APIGatewayProxyHandlerV2 = async (event) => {

    console.log("EVENT", JSON.stringify(event));

    try {
        if (!event.body) {
            throw new Error("Missing POSTed body");
        }
        const parsedBody = JSON.parse(event.body);
        if (parsedBody.message) {
            if (typeof parsedBody.message.data === "string") {
                const msgData = Buffer.from(parsedBody.message.data, "base64").toString();
                if (typeof parsedBody.message.orderingKey === "string") {
                    const fifoMessage: FIFOMessage = {
                        orderingKey: parsedBody.message.orderingKey,
                        data: msgData,
                    }
                    try {
                        await versionSystem.handleFIFOMessage(fifoMessage);
                        return {
                            statusCode: 200,
                        }
                    } catch(e) {
                        console.error("ERROR HANDLING MESSAGE, THIS WILL RETRY FOREVER. Purge the subscription or fix the handler code: ", JSON.stringify(fifoMessage));
                        console.error(e);
                        return {
                            statusCode: 500,
                        }
                    }
                } else {
                    throw new Error("Missing key: message.orderingKey");
                }
            } else {
                throw new Error("Missing key: message.data");
            }
        } else {
            throw new Error("Missing key: message");
        }
    } catch(e) {
        console.warn("Warning, 200 accepting malformed message: " + (e as Error).message);
        console.error(e);
        return {
            statusCode: 200,
        }
    }
}
