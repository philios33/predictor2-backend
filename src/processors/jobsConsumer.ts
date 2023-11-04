import { GenericMeta, Job } from "../lib/jobsBusEngine";
import { JobType, PredictorJobBus, RebuildCompetitionTablePostPhaseJobMeta, RebuildTournamentStructureJobMeta, RebuildTournamentTablePostPhaseJobMeta } from "../lib/predictorJobBus";
import { PredictorStorage } from "../lib/predictorStorage";
import { RebuildCompetitionTablePostPhaseJob } from "./jobs/rebuildCompetitionTablePostPhase";
import { RebuildTournamentStructureJob } from "./jobs/rebuildTournamentStructure";
import { RebuildTournamentTablePostPhaseJob } from "./jobs/rebuildTournamentTablePostPhase";

export class JobsConsumer {

    private storage: PredictorStorage;
    private jobBus: PredictorJobBus;

    constructor(storage: PredictorStorage, jobBus: PredictorJobBus) {
        this.storage = storage;
        this.jobBus = jobBus;
    }

    // This is the entry point for the production lambda
    async processJob(job: Job<GenericMeta>, timeNow: Date) : Promise<string> {

        const jobType = job.type as JobType;
        if (jobType === "REBUILD-TOURNAMENT-STRUCTURE") {
            const rtsJob = job as Job<RebuildTournamentStructureJobMeta>;
            const processor = new RebuildTournamentStructureJob(this.storage, this.jobBus);
            await processor.processJob(rtsJob.meta, timeNow);
            return "REBUILD-TOURNAMENT-STRUCTURE_" + rtsJob.meta.tournamentId;

        } else if (jobType === "REBUILD-TOURNAMENT-TABLE-POST-PHASE") {
            const rttppJob = job as Job<RebuildTournamentTablePostPhaseJobMeta>;
            const processor = new RebuildTournamentTablePostPhaseJob(this.storage, this.jobBus);
            await processor.processJob(rttppJob.meta, timeNow);
            return "REBUILD-TOURNAMENT-TABLE-POST-PHASE_" + rttppJob.meta.tournamentId + "_" + rttppJob.meta.phaseId;

        } else if (jobType === "REBUILD-COMPETITION-TABLE-POST-PHASE") {
            const rctppJob = job as Job<RebuildCompetitionTablePostPhaseJobMeta>;
            const processor = new RebuildCompetitionTablePostPhaseJob(this.storage, this.jobBus);
            await processor.processJob(rctppJob.meta, timeNow);
            return "REBUILD-COMPETITION-TABLE-POST-PHASE" + rctppJob.meta.competitionId + "_" + rctppJob.meta.phaseId;
        
        } else {
            throw new Error("Unknown job type: " + job.type);
        }
    }

    // This is the entry point for a test harness that wants to process everything until the queue is empty
    async processAllJobsNow(timeNow: Date) : Promise<Array<string>> {
        let nextJob: Job<GenericMeta> | null = await this.jobBus.consumeNextJob();
        let jobHistory = [];
        while (nextJob !== null) {
            const jobIdent = await this.processJob(nextJob, timeNow);
            jobHistory.push(jobIdent);
            await this.jobBus.deleteThisJob(nextJob.id);
            nextJob = await this.jobBus.consumeNextJob();
        }
        console.log("Processed job count: " + jobHistory.length);
        return jobHistory;
    }
}