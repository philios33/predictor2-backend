
export type QueueIdResponse = {
    queueId: string | null,
    waitMs: number,
}

// Queue Processing Schedulers handle the tracking of which queues need to be processed next.
// Stateless processors run getNextQueueIdToProcess to obtain some work to do.  
// The implementation should essentially register that a process is handling a queue.
// Regular heartbeats/reports should be made by a processor for logging purposes and for determining process liveness.
// If a heartbeat is not received in time, we need another process to flag it as reassignable.
// If a heartbeat fails to send from the process after 30 seconds, the process should die so that connection issues longer than 30 seconds are detected properly.
// When a queue is triggered, it is flagged to be processed once at some timestamp.

// Initially I imagined a mongo implementation of this, but perhaps Redis can do this too with a reliable queue pattern.
// Queue ids get pushed to a single processing queue.
// A process pops the next one in to the in_progress queue.
// It also sets a state object in a hashmap to keep track of the progress.
// A heartbeat can only be considered successful if it occurs within 60 seconds of the previous value and is of the same process id.
// Otherwise the process should kill itself since its life becomes meaningless.
// When a processor requests a new job, it checks all the in progress ids first and moves any dead ones back on to the queue (doing the job of a central processor within the replica).
// BUT Redis would offer no locking since a queue could have repeating ids in it.  
// Doing it as a set would not work because we need to specifically choose one queue that isnt being processed yet rather than just a random queue id, or the next queue id.  
// The scheduler must NEVER assign the same queue to multiple processors, but we also need to allow for the fact that a queue might be triggered many times at once.
// So, we MUST use a DB such as mongo to control this scheduling with heartbeats

// Update: CodeVersionId must match when allocating queues, so we can share a scheduler DB across different systems
// codeVersionId is set upon instantiation


export abstract class QueueProcessingSchedule {

    codeVersionId: string;

    constructor(codeVersionId: string) {
        this.codeVersionId = codeVersionId;
    }

    abstract getNextQueueIdToProcess(processorId: string) : Promise<QueueIdResponse>;
    abstract reportQueueProcessingProgress(processorId: string, queueId: string, messagesProcessed: number, messagesRemaining: number) : Promise<"OK" | "DIE">;
    abstract reportQueueProcessingCompleted(processorId: string, queueId: string, messagesProcessed: number, startedProcessingAt: Date) : Promise<void>;
    abstract triggerQueueForProcessing(queueId: string): Promise<void>;
}