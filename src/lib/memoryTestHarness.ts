
import { JobsConsumer } from "../processors/jobsConsumer";
import { PredictorActionsHandler } from "./predictorActionsHandler";
import { MemoryEntityStorageEngine } from "./memoryEntityStorageEngine";
import { MemoryJobBusEngine } from "./memoryJobBusEngine";
import { PredictorJobBus } from "./predictorJobBus";
import { PredictorStorage } from "./predictorStorage";

export function instantiateMemorySystemForTestPurposes() {
    const storageEngine = new MemoryEntityStorageEngine();
    const jobBusEngine = new MemoryJobBusEngine();

    const predictorStorage = new PredictorStorage(storageEngine);
    const predictorJobBus = new PredictorJobBus(jobBusEngine);

    const predictorHandler = new PredictorActionsHandler(predictorStorage, predictorJobBus);

    const jobsConsumer = new JobsConsumer(predictorStorage, predictorJobBus);

    return {
        predictorHandler, // Use to perform actions on the system
        jobsConsumer, // When the test has finished performing the actions, call await jobsConsumer.processAllJobsNow() before testing the storage result.
        predictorStorage, // Access to storage so we can test final state
    }
}
