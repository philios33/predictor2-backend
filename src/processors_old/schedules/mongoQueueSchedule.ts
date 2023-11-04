import { MongoClient } from "../mongoClient";
import { QueueIdResponse, QueueProcessingSchedule } from "./queueProcessingSchedule";
import { v4 as uuidv4 } from "uuid";
// This implementation uses a mongo collection to store each queue that is triggered and it keeps track of which process is handling the queue and when the last heartbeat was.
// There is no central thread running, this logic is run by each processor.  
// It is important that a processor checks for old heartbeats (before getting the next queue id) and removes any zombie processes that should die.

type QueueItem = {
    id: string
    codeVersionId: string
    queueId: string
    lastTriggeredAt: Date
    lockedBy: {
        processorId: string
        lastHeartbeat: Date
        messagesProcessed: number | null
        messagesRemaining: number | null
    } | null
}

export class MongoQueueSchedule extends QueueProcessingSchedule {

    client: MongoClient;

    constructor(mongoUrl: string, codeVersionId: string) {
        super(codeVersionId);
        this.client = new MongoClient("Mongo Queue Schedule", mongoUrl);
    }

    async startup() {
        return await this.client.connect();
    }

    private getCollection() {
        const client = this.client.getClient();
        return client.db().collection<QueueItem>("queues");
    }

    private async unlockDeadProcesses() {
        const cutoff = new Date();
        cutoff.setSeconds(cutoff.getSeconds() - 120);  // 2 minutes ago
        const result = await this.getCollection().updateMany({
            lockedBy: {
                $ne: null
            },
            "lockedBy.lastHeartbeat": {
                $lt: cutoff
            },
            codeVersionId: this.codeVersionId,
        }, {
            $set: {
                lockedBy: null
            }
        });
        const unlocked = result.modifiedCount;
        if (unlocked > 0) {
            console.log("Unlocked " + unlocked + " queues for processing");
        }
    }

    async getNextQueueIdToProcess(processorId: string) : Promise<QueueIdResponse> {

        await this.unlockDeadProcesses();

        const result = await this.getCollection().findOneAndUpdate({
            codeVersionId: this.codeVersionId,
            lockedBy: null
        }, {
            $set: {
                lockedBy: {
                    processorId: processorId,
                    lastHeartbeat: new Date(),
                    messagesProcessed: null,
                    messagesRemaining: null,
                }
            }
        }, {
            sort: {
                "lastTriggeredAt" : -1
            }
        });
        if (result.value === null) {
            // Nothing left to process yet
            return {
                queueId: null,
                waitMs: 15 * 1000, // Retry in X seconds
            }
        } else {
            return {
                queueId: result.value.queueId,
                waitMs: 1000,
            }
        }
    }

    private async unlockQueueFromProcess(processorId: string, queueId: string) : Promise<Date> {
        const result = await this.getCollection().findOneAndUpdate({
            codeVersionId: this.codeVersionId,
            queueId: queueId,
            lockedBy: {
                $ne: null
            },
            "lockedBy.processorId": processorId,
        }, {
            $set: {
                lockedBy: null
            }
        });
        if (result.ok && result.value !== null) {
            return result.value.lastTriggeredAt;
        } else {
            throw new Error("Not found queue to unlock, queue " + queueId + ", processor " + processorId);
        }
    }

    // When the queue processing is reported to be completed, we remove the whole QueueItem record from the collection
    // BUT only if nothing else has triggered it since
    async unlockQueueFromProcessByDeleting(processorId: string, queueId: string, startedProcessingAt: Date) : Promise<void> {
        const result = await this.getCollection().findOneAndDelete({
            codeVersionId: this.codeVersionId,
            queueId: queueId,
            lockedBy: {
                $ne: null
            },
            "lockedBy.processorId": processorId,
            lastTriggeredAt: {
                $lt: startedProcessingAt
            }
        });
        if (!result.ok) {
            throw new Error("Result not ok on findOneAndDelete, FIX");
        }
        if (result.value === null) {
            // Nothing was deleted, perhaps due to something else triggering it since
            // If this happens just release the lock in the normal way so that the next processor can work on it
            await this.unlockQueueFromProcess(processorId, queueId);
        } else {
            // Queue document was removed from collection
        }
    }

    async reportQueueProcessingProgress(processorId: string, queueId: string, messagesProcessed: number, messagesRemaining: number) : Promise<"OK" | "DIE"> {
        const now = new Date();
        const result = await this.getCollection().findOneAndUpdate({
            codeVersionId: this.codeVersionId,
            queueId: queueId,
            "lockedBy.processorId": processorId
        }, {
            $set: {
                "lockedBy.lastHeartbeat": now,
                "lockedBy.messagesProcessed": messagesProcessed,
                "lockedBy.messagesRemaining": messagesRemaining,
            }
        });
        if (result.ok && result.value !== null) {
            // Found appropriate record

            // Check that previous heartbeat isn't really old
            const cutoff = new Date();
            cutoff.setSeconds(cutoff.getSeconds() - 120);  // 2 minutes ago
            if (result.value.lockedBy) {
                if (result.value.lockedBy.lastHeartbeat < cutoff) {
                    // Previous heartbeat is way too old
                    console.warn("Triggering process death: Previous heartbeat is too old: " + result.value.lockedBy.lastHeartbeat + " (NOW " + new Date().toISOString());
                    await this.unlockQueueFromProcess(processorId, queueId);
                    return "DIE";
                } else {
                    return "OK";
                }
            } else {
                throw new Error("Impossible");
            }
        } else {
            console.warn("Triggering process death: Could not find appropriate record for this processor in the DB: " + processorId);
            return "DIE";
        }
    }

    async reportQueueProcessingCompleted(processorId: string, queueId: string, messagesProcessed: number, startedProcessingAt: Date): Promise<void> {
        // try {
            await this.reportQueueProcessingProgress(processorId, queueId, messagesProcessed, 0);
            await this.unlockQueueFromProcessByDeleting(processorId, queueId, startedProcessingAt);
        // } catch(e: any) {
        //    console.warn("BUG: Could not unlock queue after processing: " + e.message);
        //    console.warn(e);
        // }
    }

    async triggerQueueForProcessing(queueId: string) {
        const now = new Date();
        await this.getCollection().updateOne({
            queueId,
            codeVersionId: this.codeVersionId,
        }, {
            $setOnInsert: {
                id: uuidv4(),
                queueId,
                codeVersionId: this.codeVersionId,
                lockedBy: null,
            },
            $set: {
                lastTriggeredAt: now,
            }
        }, {
            upsert: true,
        });
    }
}
