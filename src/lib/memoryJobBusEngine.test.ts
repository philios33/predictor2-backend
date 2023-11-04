import { MemoryJobBusEngine } from "./memoryJobBusEngine";

const engine = new MemoryJobBusEngine();

describe('Basic functionality', () => {
    
    it('should return null when trying to consume from empty queue', async () => {
        const result = await engine.consumeNextJob();
        expect(result).toEqual(null);
    });

    it('should accept a produced job', async () => {
        await engine.enqueueNewJob("TEST", {
            name: "myJob1"
        });
    });

    it('should accept more produced jobs', async () => {
        await engine.enqueueNewJob("TEST", {
            name: "myJob2"
        });
        await engine.enqueueNewJob("TEST", {
            name: "myJob3"
        });
    });

    let jobId: string | null = null;
    it('should deliver the jobs in order', async () => {
        const result = await engine.consumeNextJob();
        if (result) {
            jobId = result.id;
            expect(result.type).toEqual("TEST");
            expect(result.meta.name).toEqual("myJob1");
        } else {
            throw new Error("No result in queue, but there should be");
        }
    });

    it('should not allow consuming more than one job at a time', async () => {
        const f = async () => {
            const result = await engine.consumeNextJob();
        }
        expect(f).rejects.toThrow();
    });

    it('should handle deleting the job id', async () => {
        expect(jobId).not.toEqual(null);
        if (jobId === null) {
            throw new Error("Job id is null");
        }
        await engine.deleteThisJob(jobId);
    });

    it('should serve up the rest in order', async () => {
        const job2 = await engine.consumeNextJob();
        expect(job2).not.toEqual(null);
        if (job2 === null) {
            throw new Error("No more jobs");
        }
        // console.log("Running job", job2);
        await engine.deleteThisJob(job2.id);

        const job3 = await engine.consumeNextJob();
        expect(job3).not.toEqual(null);
        if (job3 === null) {
            throw new Error("No more jobs");
        }
        //console.log("Running job", job3);
        await engine.deleteThisJob(job3.id);

        const job4 = await engine.consumeNextJob();
        expect(job4).toEqual(null);
    })
    

});