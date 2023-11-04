import { GenericMeta, IJobsBusEngine } from "./jobsBusEngine";

export type ContentUpdates = Array<{
    id: string
    contentHash: string
}>

export type RebuildTournamentStructureJobMeta = {
    tournamentId: string

    contentUpdates: ContentUpdates
}

export type RebuildTournamentTablePostPhaseJobMeta = {
    tournamentId: string
    phaseId: string

    contentUpdates: ContentUpdates
}

export type RebuildCompetitionTablePostPhaseJobMeta = {
    competitionId: string
    phaseId: string

    contentUpdates: ContentUpdates
}

export type JobType = "REBUILD-TOURNAMENT-STRUCTURE" | "REBUILD-TOURNAMENT-TABLE-POST-PHASE" | "REBUILD-COMPETITION-TABLE-POST-PHASE";

export class PredictorJobBus {
    private engine: IJobsBusEngine;

    constructor(engine: IJobsBusEngine) {
        this.engine = engine;
    }

    private async enqueueNewJob<T extends GenericMeta>(type: JobType, meta: T) {
        return await this.engine.enqueueNewJob<T>(type, meta);
    }

    async consumeNextJob() {
        return await this.engine.consumeNextJob();
    }

    async deleteThisJob(jobId: string) {
        return await this.engine.deleteThisJob(jobId);
    }
    
    async enqueueRebuildTournamentStructure(tournamentId: string) {
        return await this.enqueueNewJob<RebuildTournamentStructureJobMeta>("REBUILD-TOURNAMENT-STRUCTURE", {
            tournamentId,
        });
    }

    async enqueueRebuildTournamentTablePostPhase(tournamentId: string, phaseId: string) {
        return await this.enqueueNewJob<RebuildTournamentTablePostPhaseJobMeta>("REBUILD-TOURNAMENT-TABLE-POST-PHASE", {
            tournamentId,
            phaseId,
        });
    }

    async enqueueRebuildCompetitionTablePostPhase(competitionId: string, phaseId: string) {
        return await this.enqueueNewJob<RebuildCompetitionTablePostPhaseJobMeta>("REBUILD-COMPETITION-TABLE-POST-PHASE", {
            competitionId,
            phaseId,
        });
    }
}
