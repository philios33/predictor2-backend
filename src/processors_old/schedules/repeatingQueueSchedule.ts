import { QueueIdResponse, QueueProcessingSchedule } from "./queueProcessingSchedule";

// This schedule continuously loops through a list of queues.  It is not queue thread safe, and could allocate the same queue to different processors.
// This is only used for testing.

export class RepeatingQueueSchedule extends QueueProcessingSchedule {

    queueIds: Array<string>;
    counter: number;

    constructor(queueIds: Array<string>) {
        super("");
        this.queueIds = queueIds;

        this.counter = 0;
    }

    async getNextQueueIdToProcess(processorId: string) : Promise<QueueIdResponse> {
        const nextQueueId = this.queueIds[this.counter % this.queueIds.length];
        this.counter++;
        return {
            queueId: nextQueueId,
            waitMs: 10 * 1000,
        }
    }

    async reportQueueProcessingProgress(processorId: string, queueId: string, messagesProcessed: number, messagesRemaining: number) : Promise<"OK" | "DIE"> {
        console.log("Queue being processed: " + queueId + " by " + processorId + " done " + messagesProcessed + ", remaining " + messagesRemaining);
        return "OK";
    }

    async reportQueueProcessingCompleted(processorId: string, queueId: string, messagesProcessed: number, startedProcessingAt: Date): Promise<void> {
        console.log("Queue finished processing: " + queueId + " by " + processorId + " done " + messagesProcessed);
    }

    async triggerQueueForProcessing(queueId: string) {
        console.log("Queue was triggered for processing: " + queueId);
    }
}