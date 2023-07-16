import { MongoClient as Mongo } from 'mongodb';

// Wraps mongo client functionality by setting up a auto reconnecting mongo client with warnings reporting to console
// Centralises reconnection strategy and gives better debugging

export class MongoClient {

    client: Mongo;
    connectionName: string;
    lastConnectedAt: null | Date;
    lastDisconnectAt: null | Date;
    disconnectWarning: boolean;

    constructor(connectionName: string, connectionString: string) {

        this.connectionName = connectionName;
        this.lastConnectedAt = null;
        this.lastDisconnectAt = null;
        this.disconnectWarning = false;

        this.client = new Mongo(connectionString, {
            maxConnecting: 1,
            maxPoolSize: 1,
            serverSelectionTimeoutMS: 30 * 1000, // Should throw error after 30 seconds rather than just blocking forever if it cannot connect
        });
    }

    async connect() {
        

        this.client.on("connectionPoolCleared", () => {
            if (this.lastDisconnectAt === null) {
                this.lastDisconnectAt = new Date();
                console.warn("[Mongo: " + this.connectionName + "] Warning, we are disconnected from mongo!");
            }
            const now = new Date();
            const timeReconnecting = now.getTime() - this.lastDisconnectAt.getTime();
            if (timeReconnecting > 15 * 1000) {
                if (!this.disconnectWarning) {
                    this.disconnectWarning = true;
                    console.warn("[Mongo: " + this.connectionName + "] Warning, been disconnected from mongo for " + timeReconnecting + " ms...");
                }
            }
        });

        this.client.on("connectionPoolReady", () => {
            if (this.lastDisconnectAt !== null) {
                const duration = Math.round(((new Date()).getTime() - this.lastDisconnectAt.getTime()) / 1000);
                console.log("[Mongo: " + this.connectionName + "] Re-connected to Mongo after being down for " + duration + " secs");
            } else {
                console.log("[Mongo: " + this.connectionName + "] Connected to Mongo!");
            }
            
            this.disconnectWarning = false;
            this.lastDisconnectAt = null;
            this.lastConnectedAt = new Date();
        });
        
        this.client.on("error", (e) => {
            console.warn("[Mongo: " + this.connectionName + "] Error - " + e);
        });

        await this.client.connect();
    }

    getClient() : Mongo {
        return this.client;
    }
}
