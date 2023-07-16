
import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";
import { MessageHandler } from "./messageHandler";
import { QueueProcessingSchedule } from "./schedules/queueProcessingSchedule";
import { sleep } from "./sleep";
import { v4 as uuidv4 } from "uuid";
import { GenericMessageWithId } from "redis-state-management/dist/types";

export class MessageProcessor {

    processorId: string;
    queues: RedisQueuesController;
    reader: RedisStorageStateReader;
    writer: RedisStorageStateWriter;
    handlers: Record<string, MessageHandler<string, any>>;
    startedProcessing: boolean;

    constructor(queues: RedisQueuesController, reader: RedisStorageStateReader, writer: RedisStorageStateWriter) {
        this.processorId = uuidv4();
        this.handlers = {};
        this.queues = queues;
        this.reader = reader;
        this.writer = writer;
        this.startedProcessing = false;
    }

    registerMessageHandler<T extends string, M>(handler: MessageHandler<T,M>) {
        const messageType = handler.getMessageType();
        if (messageType in this.handlers) {
            throw new Error("Already registered handler for this message type: " + messageType);
        }
        this.handlers[messageType] = handler;
    }

    private getMessageHandler(messageType: string) {
        if (messageType in this.handlers) {
            return this.handlers[messageType];
        } else {
            return null;
        }
    }

    // You define a mechanism for processing queues when you startup the system.
    startProcessing(schedule: QueueProcessingSchedule) {
        if (this.startedProcessing) {
            throw new Error("Already started processing");
        }
        this.startedProcessing = true;

        // The schedule decides which queues to process and when
        // A processor only processes a queue and repeats
        let killProcess = false;

        setTimeout(async () => {
            while(!killProcess) {
                try {
                    const { queueId, waitMs } = await schedule.getNextQueueIdToProcess(this.processorId);
                    
                    if (queueId !== null) {
                        console.log("Processing queue: " + queueId);
                        await this.processQueue(queueId, schedule);
                        console.log("Finished processing queue: " + queueId);
                    } else {
                        console.log("Nothing to do");
                    }

                    if (killProcess) {
                        break;
                    }

                    console.log("---");
                    if (waitMs > 0) {
                        console.log("Waiting " + waitMs + "ms");
                        await sleep(waitMs);
                    }
                    console.log("---");

                } catch(e) {
                    console.error(e);
                    console.error("Crashing after 30 seconds...");
                    await sleep(30 * 1000);
                    process.exit(1); // Crash here
                }
            }

            // Graceful death
            process.exit(0);

        }, 1);

        process.on("SIGINT", () => {
            console.log("SIGINT - Gracefully shutting down message queue processor");
            killProcess = true;
        });
        process.on("SIGTERM", () => {
            console.log("SIGTERM - Gracefully shutting down message queue processor");
            killProcess = true;
        });

        // TODO Timeout after X seconds
    }

    async processQueue(queueId: string, schedule: QueueProcessingSchedule) {
        // Just get every message from this queue and hand it off to the appropriate handler

        // We could implement a timeout for how long a processor takes to handle a message.
        // Or a timeout for how long a processor gets to lock a queue and process it.
        // But interrupting a processor could cause more issues than it solves, since we have no idea how long a handler can take, or how many messages there might be
        // E.g. A handler may be waiting for redis to come back online for ages.  Since redis will auto reconnect and all the ops are atomic, it should be recoverable.
        // For this reason, a processor is allowed to lock a queue forever.  
        // Since this can indicate processing issues, this timeout will warn in the console if the processor is taking a long time.
        // BUT this method is not recoverable.  A better method is to report back to the scheduler with heartbeats confirming that the processing is taking place, 
        // but then the scheduler can decide to kill the process if it decides it is taking too long, and ultimately retrigger a queue if the handling process crashed during processing.

        const timeoutWarningAfter = 60 * 1000;
        const timeoutWarningEvery = 300 * 1000;
        const processingStart = new Date();
        let intervalRoutine: NodeJS.Timer | null = null;
        const timeoutRoutine = setTimeout(() => {
            const warn = () => {
                const now = new Date();
                const age = now.getTime() - processingStart.getTime();
                console.warn("Warning, processor is processing queue '" + queueId + "' for a long time: " + age + " ms");
            };
            warn();
            intervalRoutine = setInterval(() => {
                warn();
            }, timeoutWarningEvery);
        }, timeoutWarningAfter);
        const stopTimeout = () => {
            clearTimeout(timeoutRoutine);
            if (intervalRoutine !== null) {
                clearInterval(intervalRoutine);
            }
        }

        let progressInterval: NodeJS.Timer | null = null;

        try {
            let messagesRemaining = await this.queues.getQueueSize(queueId);
            let messagesProcessed = 0;

            const reportProgress = async () => {
                const result = await schedule.reportQueueProcessingProgress(this.processorId, queueId, messagesProcessed, messagesRemaining);
                if (result === "DIE") {
                    throw new Error("Reporting call returned DIE signal, possibly due to an old heartbeat or incorrect process id");
                }
            }

            progressInterval = setInterval(async () => {
                try {
                    await reportProgress();
                } catch(e) {
                    console.error(e);
                    process.exit(1);
                }
            }, 15 * 1000);

            // Report now and every 15 seconds until the queue is empty
            await reportProgress();
            
            let repeat = true;
            do {
                const message: GenericMessageWithId | null = await this.queues.popNextMessage(queueId);
                if (message === null) {
                    repeat = false;
                } else {
                    const handler = this.getMessageHandler(message.message.type);
                    if (handler !== null) {
                        console.log("Processing message: " + message.id);
                        await handler.processMessage(message.message, this.reader, this.writer, schedule, this.queues);
                        console.log("DONE processing message: " + message.id);
                        await this.queues.confirmMessageById(queueId, message.id);
                        messagesProcessed++;
                        // messagesRemaining = await this.queues.getQueueSize(queueId);
                        messagesRemaining--;
                    } else {
                        throw new Error("Handler not registered for message type: " + message.message.type + " when processing queue: " + queueId);
                    }
                }
            } while (repeat);

            stopTimeout();
            clearInterval(progressInterval);
            
            await schedule.reportQueueProcessingCompleted(this.processorId, queueId, messagesProcessed, processingStart);

        } catch(e) {
            stopTimeout();
            if (progressInterval !== null) {
                clearInterval(progressInterval);
            }
            throw e;
        }
    }
}
