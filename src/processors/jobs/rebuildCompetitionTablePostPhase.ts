import { RebuildCompetitionTablePostPhaseJobMeta } from "../../lib/predictorJobBus";
import { JobProcessor } from "./jobProcessor";
import { shouldRebuild } from "./rebuildTournamentStructure";

export class RebuildCompetitionTablePostPhaseJob extends JobProcessor {

    async processJob(jobMeta: RebuildCompetitionTablePostPhaseJobMeta, timeNow: Date) {
        const competitionId = jobMeta.competitionId;
        const phaseId = jobMeta.phaseId;
        console.log("Rebuilding competition table for competition: " + competitionId + " and phase: " + phaseId);        

        // The competition phase table depends on:
        // 1. tournament structure (to determine if we need to add a table from a previous phase)
        // 2. tournament phase structure
        // 3. prev tournament phase table (for bankers calc)
        // 4. this tournament phase table (for scores)
        // 5. prev competition phase table (for cumulative player tables)
        // 6. predictions of competitors for matches at this phase
        // 7. the competition (for scoring rules)

        const thisCompetition = await this.storage.fetchCompetition(competitionId);
        if (thisCompetition === null) {
            throw new Error("Cannot rebuild for missing competition: " + competitionId);
        }
        const tournamentId = thisCompetition.meta.tournamentId;

        const prevPhaseId = parseInt(phaseId, 10) - 1;

        // Get all source items
        const sources = {
            tournamentStructure: await this.storage.sourceTournamentStructure(tournamentId),
            phaseStructure: await this.storage.sourceTournamentPhaseStructure(tournamentId, phaseId),
            prevPhaseTables: prevPhaseId >= 0 ? await this.storage.sourceTournamentTablesPostPhase(tournamentId, prevPhaseId.toString()) : null,
            thisPhaseTables: await this.storage.sourceTournamentTablesPostPhase(tournamentId, phaseId),
            prevCompetitionTables: prevPhaseId >= 0 ? await this.storage.sourceCompetitionTablesPostPhase(competitionId, prevPhaseId.toString()) : null,
            predictions: await this.storage.sourceCompetitionPredictions(competitionId, phaseId),
            competition: await this.storage.sourceCompetition(competitionId),
            competitionPlayers: await this.storage.sourceCompetitionPlayers(competitionId),
        }

        // Build the source hashes map
        const sourceHashes: Record<string, string> = {};
        for (const source of Object.values(sources)) {
            if (source !== null) {
                sourceHashes[source.id] = source.contentHash;
            }
        }

        // Fetch current competition phase table to do rebuild check
        const current = await this.storage.fetchCompetitionTablesPostPhase(competitionId, phaseId);
        const rebuild = shouldRebuild(current, sourceHashes);
        if (!rebuild) {
            console.warn("Skipping rebuild due to identical sourceHashes");
            return;
        }

        // Note: Use these source items e.g. sources.tournamentStructure.result rather than using this.storage to fetch things
        const tournamentStructure = sources.tournamentStructure.result;
        const phaseStructure = sources.phaseStructure.result;
        const prevPhaseTables = sources.prevPhaseTables?.result || null;
        const thisPhaseTables = sources.thisPhaseTables.result;
        const prevCompetitionTables = sources.prevCompetitionTables?.result || null;
        const predictions = sources.predictions.result;
        const competition = sources.competition.result;
        const competitionPlayers = sources.competitionPlayers.result;

        // TODO: Use the Match scores in the tournament phase tables along with the predictions to build the phase results table with points (using system set in the competition)
        // TODO: Also use the cumulative data in the prev competition phase to build player table results after this phase



    }
}

