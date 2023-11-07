import { GenericMeta, IJobsBusEngine } from "./jobsBusEngine";

/*
export type ContentUpdates = Array<{
    id: string
    contentHash: string
}>
*/

export type RebuildTournamentStructureJobMeta = {
    tournamentId: string

    // contentUpdates: ContentUpdates // No longer used.  Check the hashes have changed before triggering the job.
}

export type RebuildTournamentTablePostPhaseJobMeta = {
    tournamentId: string
    phaseId: string

    // contentUpdates: ContentUpdates // No longer used.  Check the hashes have changed before triggering the job.
}

export type RebuildCompetitionTablePostPhaseJobMeta = {
    competitionId: string
    phaseId: string

    // contentUpdates: ContentUpdates // No longer used.  Check the hashes have changed before triggering the job.
}

export type PutPlayerEvent = {
    type: "PUT-PLAYER",
    meta: {
        playerId: string
    }
}

export type PutTournamentEvent = {
    type: "PUT-TOURNAMENT",
    meta: {
        tournamentId: string
    }
}

export type PutCompetitionEvent = {
    type: "PUT-COMPETITION",
    meta: {
        competitionId: string
    }
}

export type PlayerCompetingEvent = {
    type: "PLAYER-COMPETING",
    meta: {
        playerId: string
        competitionId: string
    }
}

export type PlayerNotCompetingEvent = {
    type: "PLAYER-NOT-COMPETING",
    meta: {
        playerId: string
        competitionId: string
    }
}

export type PutTournamentTeamEvent = {
    type: "PUT-TOURNAMENT-TEAM",
    meta: {
        tournamentId: string
        teamId: string
    }
}

export type PutTournamentMatchEvent = {
    type: "PUT-TOURNAMENT-MATCH",
    meta: {
        tournamentId: string
        matchId: string
    }
}

export type PutTournamentMatchScoreEvent = {
    type: "PUT-TOURNAMENT-MATCH-SCORE",
    meta: {
        tournamentId: string
        matchId: string
    }
}

export type PutPlayerPredictionEvent = {
    type: "PUT-PLAYER-PREDICTION",
    meta: {
        playerId: string
        tournamentId: string
        matchId: string
    }
}

export type RebuiltPredictorPhaseTableEvent = {
    type: "REBUILT-TOURNAMENT-PHASE-TABLE",
    meta: {
        tournamentId: string
        phaseId: string
    }
}

export type RebuiltTournamentStructureEvent = {
    type: "REBUILT-TOURNAMENT-STRUCTURE",
    meta: {
        tournamentId: string
    }
}

export type PredictorEvent = PutPlayerEvent | PutTournamentEvent | PutCompetitionEvent | PlayerCompetingEvent | PlayerNotCompetingEvent | PutTournamentTeamEvent | PutTournamentMatchEvent | PutTournamentMatchScoreEvent | PutPlayerPredictionEvent | RebuiltPredictorPhaseTableEvent | RebuiltTournamentStructureEvent;

export type JobType = "EVENT-OCCURRED" | "REBUILD-TOURNAMENT-STRUCTURE" | "REBUILD-TOURNAMENT-TABLE-POST-PHASE" | "REBUILD-COMPETITION-TABLE-POST-PHASE";

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

    async enqueuePredictorEvent(event: PredictorEvent) {
        return await this.enqueueNewJob("EVENT-OCCURRED", event);
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
