import { GenericMeta, IJobsBusEngine, Job } from "./jobsBusEngine";
import { v4 as uuid } from "uuid";

export class MemoryJobBusEngine implements IJobsBusEngine {

    private queue: Array<Job<GenericMeta>>;
    private isProcessing: boolean;

    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    async enqueueNewJob<T extends GenericMeta>(jobType: string, jobMeta: T): Promise<void> {
        const job: Job<T> = {
            id: uuid(),
            type: jobType,
            meta: jobMeta,
        };
        this.queue.push(job);
    }

    async consumeNextJob(): Promise<Job<any> | null> {
        if (this.isProcessing) {
            throw new Error("You called consumeNextJob too soon without deleting the previous job.  This indicates misuse of this class.");
        } else {
            if (this.queue.length === 0) {
                return null;
            } else {
                const firstItem = this.queue[0];
                this.isProcessing = true;
                return firstItem;
            }
        }
    }

    async deleteThisJob(jobId: string): Promise<void> {
        if (!this.isProcessing) {
            throw new Error("You called deleteThisJob but we are not processing any job.  This indicates misuse of this class.");
        } else {
            if (this.queue.length === 0) {
                throw new Error("The queue is already empty, cannot delete a job.  This indicates misuse of this class.");
            } else {
                const firstItem = this.queue[0];
                if (firstItem.id === jobId) {
                    const extracted = this.queue.shift();
                    if (extracted) {
                        if (extracted.id === jobId) {
                            this.isProcessing = false;
                            return;
                        } else {
                            throw new Error("IMPOSSIBLE: Wrong job id found at head of array, even though the first item matched");
                        }
                    } else {
                        throw new Error("IMPOSSIBLE: Failed to shift the array but the array is not empty");
                    }
                } else {
                    throw new Error("Incorrect job id to delete, expecting " + firstItem.id + " but received " + jobId + ", this indicates misuse of this class.");
                }
            }
        }
    }

}