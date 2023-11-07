import { PredictorEvent } from "../../lib/predictorJobBus";
import { ISODate, PhaseTimes } from "../../lib/predictorStorage";
import { JobProcessor } from "./jobProcessor";


export class PredictorEventProcessor extends JobProcessor {

    // The predictor events handler tries to be efficient in that it will check the hash of certain sources
    // If they are known to be different from the latest source hashes recorded for rebuilt data, then we trigger a re-run here
    async processJob(predictorEvent: PredictorEvent, timeNow: Date) {
        
        if (predictorEvent.type === "PUT-PLAYER") {
            // Putting a new player wont do much because they wont have any competitions set
            // However, updating an existing player may need to rebuild competition phase tables, e.g. Player name/logo change
            // Find all relevant competitions
            const competitions = await this.storage.fetchPlayerCompetitions(predictorEvent.meta.playerId);

            for (const competing of competitions) {
                // We know the player is part of this competition, so there is no need to lookup the competition players and check the contentHash is different
                // It is guaranteed to be different unless it is a noop, so we can simply trigger a rebuild for all phases
                // Noops are deduplicated within the startup of the rebuild job that checks if anything has changed
                // Note: Horizontal updates are never enqueued, so it is up to this to decide which phases are applicable
                
                await this.rebuildActivePhaseTablesForCompetition(competing.meta.competitionId, timeNow);
            }
        
            // Putting a new player will mean that there is no derived playerCompetitions data ready
            // In this scenario we can do nothing since it is only existing competitors that are relevant
            // Similar logic to the above will apply for when a new player is competing or not competing because it is all about if the competitors has changed!

        } else if (predictorEvent.type === "PLAYER-COMPETING") {
            // Load the competing object from the primary source of truth, the competition player competing.
            const competing = await this.storage.fetchCompetitionPlayerCompeting(predictorEvent.meta.competitionId, predictorEvent.meta.playerId);
            if (competing === null) {
                throw new Error("Should never happen since this event is triggered after writing this exact thing. Error with PLAYER-COMPETING handler '" + predictorEvent.meta.competitionId + "' and '" + predictorEvent.meta.playerId + "'");
            }
            // Just write this (as is) to the playerId indexed entity
            await this.storage.storePlayerCompeting(competing.meta);

            // Note: This updates the list of competitions for a player.  I can't think of a reason right now, but we might need to fire another event here.

        } else if (predictorEvent.type === "PLAYER-NOT-COMPETING") {
            // Reflects the removal of the Competition player competing entity
            await this.storage.removePlayerCompeting(predictorEvent.meta.playerId, predictorEvent.meta.competitionId);

            // Note: As above, I'm not sure what this might need to trigger.  I can't think of any rebuild that depends on a players competitions yet.

        } else if (predictorEvent.type === "PUT-COMPETITION") {
            // Could be a change of points rules, trigger all phase tables for this competition, just incase
            await this.rebuildActivePhaseTablesForCompetition(predictorEvent.meta.competitionId, timeNow);

        } else if (predictorEvent.type === "PUT-TOURNAMENT") {
            // Possible tournament name change, not really used anywhere (yet)

        } else if (predictorEvent.type === "PUT-TOURNAMENT-TEAM") {
            // New Team, will need to rebuild all tournament tables
            // Updated team, will need to mirror all team attributes
            // Since whole team entities are used in the tournament phase structure, we need to rebuild from scratch
            await this.jobBus.enqueueRebuildTournamentStructure(predictorEvent.meta.tournamentId);

        } else if (predictorEvent.type === "PUT-TOURNAMENT-MATCH") {
            // Could be a full tournament structure change if a scheduled kickoff time has changed
            // Either way the tournament structure depends on the matches
            await this.jobBus.enqueueRebuildTournamentStructure(predictorEvent.meta.tournamentId);

        } else if (predictorEvent.type === "PUT-TOURNAMENT-MATCH-SCORE") {
            // We can lookup the match phase first so that we only rebuild from that phase up until the last active phase
            // TODO Finish this
            const phase = await this.storage.fetchTournamentMatchPhase(predictorEvent.meta.tournamentId, predictorEvent.meta.matchId);


        } else if (predictorEvent.type === "PUT-PLAYER-PREDICTION") {

        } else if (predictorEvent.type === "REBUILT-TOURNAMENT-STRUCTURE") {
            // Trigger all tournament phase tables for this tournament
            await this.rebuildActivePhaseTablesForTournament(predictorEvent.meta.tournamentId, timeNow);
        
        } else if (predictorEvent.type === "REBUILT-TOURNAMENT-PHASE-TABLE") {
            // We should rebuild all competition phase tables for relevant competitions but only for this phase
            const competitions = await this.storage.fetchCompetitionsByTournamentId(predictorEvent.meta.tournamentId);
            for (const competition of competitions) {
                await this.jobBus.enqueueRebuildCompetitionTablePostPhase(competition.meta.competitionId, predictorEvent.meta.phaseId);
            }
        }
    }

    async rebuildActivePhaseTablesForTournament(tournamentId: string, timeNow: Date) {
        
        // Load the tournament structure to get the phases list and starting timestamps
        const structure = await this.storage.fetchTournamentStructure(tournamentId);
        if (structure === null) {
            // No tournament structure exists yet, it is likely there is nothing to trigger at this point
        } else {
            // Trigger competition phase table rebuild for only the phases that have started
            const phaseIds = getOrderedActivePhaseIds(structure.meta.phaseTimes, timeNow);
            for (const phaseId of phaseIds) {
                await this.jobBus.enqueueRebuildTournamentTablePostPhase(tournamentId, phaseId);
            }
        }
    }

    async rebuildActivePhaseTablesForCompetition(competitionId: string, timeNow: Date) {
        // Lookup the competition to get the tournament
        const competition = await this.storage.fetchCompetition(competitionId);
        if (competition === null) {
            throw new Error("Cannot rebuild active phase tables for a competition that does not exist yet");
        }
        const tournamentId = competition.meta.tournamentId;
    
        // Load the tournament structure to get the phases list and starting timestamps
        const structure = await this.storage.fetchTournamentStructure(tournamentId);
        if (structure === null) {
            // No tournament structure exists yet, it is likely there is nothing to trigger at this point
        } else {
            // Trigger competition phase table rebuild for only the phases that have started
            const phaseIds = getOrderedActivePhaseIds(structure.meta.phaseTimes, timeNow);
            for (const phaseId of phaseIds) {
                await this.jobBus.enqueueRebuildCompetitionTablePostPhase(competitionId, phaseId);
            }
        }
    }
}



function getOrderedActivePhaseIds(phaseTimes: PhaseTimes, timeNow: Date) : Array<string> {
    // Phase times are a record and so are unordered, but we can sort the result before returning
    const activePhaseIds = [];
    for (const phaseId in phaseTimes) {
        const time = phaseTimes[phaseId];
        const startTime = new Date(time.earliestMatchKickoff.isoDate);
        if (startTime < timeNow) {
            activePhaseIds.push(phaseId);
        }
    }

    // Sort the result numerically
    activePhaseIds.sort((a,b) => {
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        return bNum - aNum;
    });

    return activePhaseIds;
}
