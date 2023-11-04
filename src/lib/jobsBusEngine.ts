// This is an interface for the Jobs bus.  
// An ordered FIFO queue that uses a single groupID to execute 1 job at a time using a single lambda consumer.
// JobProcessors can enqueue new jobs and get the next job to execute.
// We can mock this in memory for testing and implement an AWS SQS FIFO implementation for production use.

export type Job<T> = {
    id: string
    type: string
    meta: T
}

export type GenericMeta = Record<string, any>;

export interface IJobsBusEngine {
    // Queue producer function
    enqueueNewJob<T extends GenericMeta>(jobType: string, jobMeta: T) : Promise<void>; // Adds a job to the list

    // Queue consumer functions
    consumeNextJob() : Promise<Job<any> | null>; // Consumes the next job to execute (We don't know what its type will be). You cant consume more than one at a time.
    deleteThisJob(jobId: string): Promise<void>; // This removes the job from the queue since it was successfully processed and allows another job consumption.
}
