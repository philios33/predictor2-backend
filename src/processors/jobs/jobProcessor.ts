
import { PredictorJobBus } from "../../lib/predictorJobBus";
import { PredictorStorage } from "../../lib/predictorStorage";

export abstract class JobProcessor {

    protected storage: PredictorStorage;
    protected jobBus: PredictorJobBus;

    constructor(storage: PredictorStorage, jobBus: PredictorJobBus) {
        this.storage = storage;
        this.jobBus = jobBus;
    }

    abstract processJob(jobMeta: any, timeNow: Date) : Promise<void>;
}