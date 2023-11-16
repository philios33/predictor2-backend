import objectHash from "object-hash";
import { IEntityStorageEngine } from "./entityStorage";

export type EntityType = "PLAYER" | "TOURNAMENT" | "TOURNAMENT-TEAM" | "TOURNAMENT-MATCH" | "TOURNAMENT-MATCH-SCORE" | 
    "COMPETITION" | "PREDICTION" | "COMPETITION-PLAYER-COMPETING" | IndexEntityType | BuiltEntityType;
export type IndexEntityType = "PLAYER-COMPETING"
export type BuiltEntityType = "TOURNAMENT-STRUCTURE" | "TOURNAMENT-PHASE-STRUCTURE" | "TOURNAMENT-MATCH-PHASE" | "TOURNAMENT-TABLES-POST-PHASE" | "COMPETITION-TABLES-POST-PHASE"

export type ISODate = {
    isoDate: string
}
export type Entity<T> = {
    partitionKey: string
    entityType: string
    lookupId: string | null
    meta: T
}

export type Player = {
    playerId: string
    name: string
    email: string
    // competitionIdList: Array<string> // This is not base data, it is derived data from the competing record
}

export type Tournament = {
    tournamentId: string
    name: string
}

export type TournamentTeam = {
    tournamentId: string
    teamId: string
    name: string
    shortName: string
    logo48: string
    groupIds: Array<string>
}

export type TournamentMatchStatus = "MATCH_ON" | "MATCH_POSTPONED" | "MATCH_ABANDONED" | "MATCH_DELETED";

export type TournamentMatch = {
    tournamentId: string
    matchId: string
    stageId: string
    homeTeamId: string
    awayTeamId: string
    scheduledKickoff: ISODate
    groupId: string
    status: TournamentMatchStatus
    statusMessage: string | null
}

export type MatchScore = {
    homeGoals: number
    awayGoals: number
    extraTime? : {
        homeGoals: number
        awayGoals: number
        penalties? : {
            homeGoals: number
            awayGoals: number
        }
    }
    isFinalScore: boolean
    gameMinute: string | null
}

export type TournamentMatchScore = {
    tournamentId: string
    matchId: string
    score: MatchScore | null;
}

export type PlayerPrediction = {
    score: PlayerPredictionScore | null
    isBanker: boolean
}

export type PlayerPredictionScore = {
    home: number
    away: number
}

export type Prediction = {
    tournamentId: string
    matchId: string
    playerId: string
    prediction: PlayerPrediction | null;
}

export type Competition = {
    tournamentId: string
    competitionId: string
    name: string
    adminPlayerId: string
    // competingPlayerIdList: Array<string> // This is not base data, it is derived from the players that are competing
}

export type Competing = {
    playerId: string
    competitionId: string
    initialPhase: number
    initialPoints: number
}

export type PlayerCompetitions = {
    playerId: string
    competitions: Record<string, boolean>
}

export type CompetitionPlayers = {
    competitionId: string
    players: Record<string, {
        initialPhase: number
        initialPoints: number
    }>
}

export type ContentHashResult<T> = {
    id: string
    contentHash: string
    result: T
}

export class PredictorStorage {
    private engine: IEntityStorageEngine;
    
    constructor(engine: IEntityStorageEngine) {
        this.engine = engine;
    }

    private async storeEntity<T>(entityType: EntityType, compositeId: Array<string>, lookupId: string | null, meta: T) {
        const entity : Entity<T> = {
            partitionKey: entityType + "_" + compositeId.join("_"),
            entityType,
            lookupId,
            meta,
        }
        return await this.engine.storeEntity(entityType, compositeId, entity);
    }

    private async fetchEntity<T>(entityType: EntityType, compositeId: Array<string>) {
        return await this.engine.fetchEntity<Entity<T>>(entityType, compositeId);
    }

    private async fetchEntitiesByLookupId<T>(entityType: EntityType, lookupId: string) {
        return await this.engine.findByLookupId<Entity<T>>(entityType, lookupId);
    }

    private async removeEntity(entityType: EntityType, compositeId: Array<string>) {
        return await this.engine.removeEntity(entityType, compositeId);
    }

    // PLAYER
    async storePlayer(player: Player) {
        return await this.storeEntity('PLAYER', [player.playerId], null, player);
    }
    async fetchPlayer(playerId: string) {
        return await this.fetchEntity<Player>('PLAYER', [playerId]);
    }
    async removePlayer(playerId: string) {
        // Might be useful for GDPR
        return await this.removeEntity('PLAYER', [playerId]);
    }

    // TOURNAMENT
    async storeTournament(tournament: Tournament) {
        return await this.storeEntity('TOURNAMENT', [tournament.tournamentId], null, tournament);
    }
    async fetchTournament(tournamentId: string) {
        return await this.fetchEntity<Tournament>('TOURNAMENT', [tournamentId]);
    }
    async removeTournament(tournamentId: string) {
        // Might be used in scenarios where the tournament was accidently added
        return await this.removeEntity('TOURNAMENT', [tournamentId]);
    }

    // TOURNAMENT TEAM
    async storeTournamentTeam(team: TournamentTeam) {
        return await this.storeEntity('TOURNAMENT-TEAM', [team.tournamentId, team.teamId], team.tournamentId, team);
    }
    async fetchTournamentTeam(tournamentId: string, teamId: string) {
        return await this.fetchEntity<TournamentTeam>('TOURNAMENT-TEAM', [tournamentId, teamId]);
    }
    async fetchTournamentTeamsByTournamentId(tournamentId: string) {
        return await this.fetchEntitiesByLookupId<TournamentTeam>('TOURNAMENT-TEAM', tournamentId);
    }
    async removeTournamentTeam(tournamentId: string, teamId: string) {
        // Might be used in scenarios where the team was accidently added
        return await this.removeEntity('TOURNAMENT-TEAM', [tournamentId, teamId]);
    }

    // TOURNAMENT MATCH
    async storeTournamentMatch(match: TournamentMatch) {
        return await this.storeEntity('TOURNAMENT-MATCH', [match.tournamentId, match.matchId], match.tournamentId, match);
    }
    async fetchTournamentMatch(tournamentId: string, matchId: string) {
        return await this.fetchEntity<TournamentMatch>('TOURNAMENT-MATCH', [tournamentId, matchId]);
    }
    async fetchTournamentMatchesByTournamentId(tournamentId: string) {
        return await this.fetchEntitiesByLookupId<TournamentMatch>('TOURNAMENT-MATCH', tournamentId);
    }
    async removeTournamentMatch(tournamentId: string, matchId: string) {
        throw new Error("Please 'store' a match with status of deleted to signify that it has been removed");
    }

    // TOURNAMENT MATCH SCORE
    async storeTournamentMatchScore(score: TournamentMatchScore) {
        return await this.storeEntity('TOURNAMENT-MATCH-SCORE', [score.tournamentId, score.matchId], null, score);
    }
    async fetchTournamentMatchScore(tournamentId: string, matchId: string) {
        return await this.fetchEntity<TournamentMatchScore>('TOURNAMENT-MATCH-SCORE', [tournamentId, matchId]);
    }
    async removeTournamentMatchScore(tournamentId: string, matchId: string) {
        throw new Error("Please 'store' a null value for the score to signify that it is unknown");
    }

    // PREDICTION
    async storePrediction(prediction: Prediction) {
        return await this.storeEntity('PREDICTION', [prediction.tournamentId, prediction.matchId, prediction.playerId], null, prediction);
    }
    async fetchPrediction(tournamentId: string, matchId: string, playerId: string) {
        return await this.fetchEntity<Prediction>('PREDICTION', [tournamentId, matchId, playerId]);
    }
    async removePrediction(tournamentId: string, matchId: string, playerId: string) {
        throw new Error("Please 'store' a null prediction to signify prediction removal");
    }

    // COMPETITION
    async storeCompetition(competition: Competition) {
        return await this.storeEntity('COMPETITION', [competition.competitionId], competition.tournamentId, competition);
    }
    async fetchCompetition(competitionId: string) {
        return await this.fetchEntity<Competition>('COMPETITION', [competitionId]);
    }
    async fetchCompetitionsByTournamentId(tournamentId: string) {
        return await this.fetchEntitiesByLookupId<Competition>('COMPETITION', tournamentId);
    }
    async removeCompetition(competitionId: string) {
        throw new Error("Please 'store' isDeleted true flag to signify competition deletion");
    }

    // COMPETING META
    async storeCompetitionPlayerCompeting(competing: Competing) {
        return await this.storeEntity('COMPETITION-PLAYER-COMPETING', [competing.competitionId, competing.playerId], competing.competitionId, competing);
    }
    async fetchCompetitionPlayerCompeting(competitionId: string, playerId: string) {
        return await this.fetchEntity<Competing>('COMPETITION-PLAYER-COMPETING', [competitionId, playerId]);
    }
    async removeCompetitionPlayerCompeting(competitionId: string, playerId: string) {
        // This wipes the whole competing record from memory as if they were never part of the competition
        // I've decided to keep this incase it was a mistake, or if you want to kick someone
        return await this.removeEntity('COMPETITION-PLAYER-COMPETING', [competitionId, playerId]);
    }
    async fetchCompetitionPlayersCompeting(competitionId: string) {
        return await this.fetchEntitiesByLookupId<Competing>('COMPETITION-PLAYER-COMPETING', competitionId);
    }

    // Note: This is a reflected index of the same data but stored with a different lookup id
    // It is rebuilt with an event bus predictor event
    async storePlayerCompeting(competing: Competing) {
        return await this.storeEntity('PLAYER-COMPETING', [competing.playerId, competing.competitionId], competing.playerId, competing);
    }
    async fetchPlayerCompeting(playerId: string, competitionId: string) {
        return await this.fetchEntity<Competing>('PLAYER-COMPETING', [playerId, competitionId]);
    }
    async removePlayerCompeting(playerId: string, competitionId: string) {
        return await this.removeEntity('PLAYER-COMPETING', [playerId, competitionId]);
    }
    async fetchPlayerCompetitions(playerId: string) {
        return await this.fetchEntitiesByLookupId<Competing>('PLAYER-COMPETING', playerId);
    }


    // BUILT ENTITIES FOLLOW
    async storeTournamentStructure(structure: TournamentStructure) {
        return await this.storeEntity('TOURNAMENT-STRUCTURE', [structure.tournamentId], null, structure);
    }
    async fetchTournamentStructure(tournamentId: string) {
        return await this.fetchEntity<TournamentStructure>('TOURNAMENT-STRUCTURE', [tournamentId]);
    }

    async storeTournamentPhaseStructure(structure: TournamentPhaseStructure) {
        return await this.storeEntity('TOURNAMENT-PHASE-STRUCTURE', [structure.tournamentId, structure.phaseId], structure.tournamentId, structure);
    }
    async fetchTournamentPhaseStructure(tournamentId: string, phaseId: string) {
        return await this.fetchEntity<TournamentPhaseStructure>('TOURNAMENT-PHASE-STRUCTURE', [tournamentId, phaseId]);
    }
    async fetchTournamentPhaseStructuresByTournamentId(tournamentId: string) {
        // Possibly not required, but we could do this here
        return await this.fetchEntitiesByLookupId<TournamentPhaseStructure>('TOURNAMENT-PHASE-STRUCTURE', tournamentId);
    }

    async storeTournamentMatchPhase(phase: TournamentMatchPhase) {
        return await this.storeEntity('TOURNAMENT-MATCH-PHASE', [phase.tournamentId, phase.matchId], null, phase);
    }
    async fetchTournamentMatchPhase(tournamentId: string, matchId: string) {
        return await this.fetchEntity<TournamentMatchPhase>('TOURNAMENT-MATCH-PHASE', [tournamentId, matchId]);
    }

    async storeTournamentTablesPostPhase(tables: TournamentTablesPostPhase) {
        return await this.storeEntity('TOURNAMENT-TABLES-POST-PHASE', [tables.tournamentId, tables.phaseId], null, tables);
    }
    async fetchTournamentTablesPostPhase(tournamentId: string, phaseId: string) {
        return await this.fetchEntity<TournamentTablesPostPhase>('TOURNAMENT-TABLES-POST-PHASE', [tournamentId, phaseId]);
    }

    async storeCompetitionTablesPostPhase(tables: CompetitionTablesPostPhase) {
        return await this.storeEntity('COMPETITION-TABLES-POST-PHASE', [tables.competitionId, tables.phaseId], null, tables);
    }
    async fetchCompetitionTablesPostPhase(competitionId: string, phaseId: string) {
        return await this.fetchEntity<CompetitionTablesPostPhase>('COMPETITION-TABLES-POST-PHASE', [competitionId, phaseId]);
    }

    // Source data fetchers
    async sourceTournamentTeamsRecord(tournamentId: string) : Promise<ContentHashResult<Record<string, TournamentTeam>>> {
        // Gets all teams added to this tournament
        const tournamentTeams = await this.fetchTournamentTeamsByTournamentId(tournamentId);
        const result: Record<string, TournamentTeam> = {};
        for (const team of tournamentTeams) {
            result[team.meta.teamId] = team.meta;
        }
        return {
            id: "TOURNAMENT-TEAMS_" + tournamentId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceTournamentMatches(tournamentId: string) : Promise<ContentHashResult<Record<string, TournamentMatch>>> {
        const tournamentMatches = await this.fetchTournamentMatchesByTournamentId(tournamentId);
        const result: Record<string, TournamentMatch> = {};
        for (const match of tournamentMatches) {
            result[match.meta.matchId] = match.meta;
        }
        return {
            id: "TOURNAMENT-MATCHES_" + tournamentId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceTournament(tournamentId: string) : Promise<ContentHashResult<Tournament>> {
        const tournament = await this.fetchTournament(tournamentId);
        if (tournament === null) {
            throw new Error("Cannot source missing tournament: " + tournamentId);
        }
        const result = tournament.meta;
        return {
            id: "TOURNAMENT_" + tournamentId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceTournamentPhaseStructure(tournamentId: string, phaseId: string) : Promise<ContentHashResult<TournamentPhaseStructure>> {
        const structure = await this.fetchTournamentPhaseStructure(tournamentId, phaseId);
        if (structure === null) {
            throw new Error("Cannot source missing tournament phase structure: " + phaseId);
        }
        const result = structure.meta;
        return {
            id: "TOURNAMENT-PHASE-STRUCTURE_" + tournamentId + "_" + phaseId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceTournamentTablesPostPhase(tournamentId: string, phaseId: string) : Promise<ContentHashResult<TournamentTablesPostPhase>> {
        const tables = await this.fetchTournamentTablesPostPhase(tournamentId, phaseId);
        if (tables === null) {
            throw new Error("Cannot source missing tournament tables post phase: " + phaseId);
        }
        const result = tables.meta;
        return {
            id: "TOURNAMENT-TABLES-POST-PHASE_" + tournamentId + "_" + phaseId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceTournamentPhaseMatchScores(tournamentId: string, phaseId: string) : Promise<ContentHashResult<Record<string, MatchScore | null>>> {
        // This depends on the phase structure to get the relevant matches
        const structure = await this.fetchTournamentPhaseStructure(tournamentId, phaseId);
        if (structure === null) {
            throw new Error("Cannot source phase match scores if the tournament phase structure is missing: " + phaseId);
        }
        const result: Record<string, MatchScore | null> = {};
        for (const match of structure.meta.matches) {
            const score = await this.fetchTournamentMatchScore(tournamentId, match.matchId);
            if (score === null) {
                result[match.matchId] = null;
            } else {
                result[match.matchId] = score.meta.score;
            }
        }
        return {
            id: "TOURNAMENT-PHASE-MATCH-SCORES_" + tournamentId + "_" + phaseId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceTournamentStructure(tournamentId: string) : Promise<ContentHashResult<TournamentStructure>> {
        const structure = await this.fetchTournamentStructure(tournamentId);
        if (structure === null) {
            throw new Error("Cannot source missing tournament structure: " + tournamentId);
        }
        const result = structure.meta;
        return {
            id: "TOURNAMENT-STRUCTURE_" + tournamentId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceCompetitionTablesPostPhase(competitionId: string, phaseId: string) : Promise<ContentHashResult<CompetitionTablesPostPhase>> {
        const tables = await this.fetchCompetitionTablesPostPhase(competitionId, phaseId);
        if (tables === null) {
            throw new Error("Cannot source missing competition phase tables: " + phaseId);
        }
        const result = tables.meta;
        return {
            id: "COMPETITION-TABLES-POST-PHASE_" + competitionId + "_" + phaseId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceCompetition(competitionId: string) : Promise<ContentHashResult<Competition>> {
        const competition = await this.fetchCompetition(competitionId);
        if (competition === null) {
            throw new Error("Cannot source missing competition: " + competitionId);
        }
        const result = competition.meta;
        return {
            id: "COMPETITION_" + competitionId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceCompetitionPlayers(competitionId: string) {

        const players = await this.fetchCompetitionPlayersCompeting(competitionId);
        const competingMap: Record<string, { competing: Competing, player: CompetitionPlayer}> = {};
        for (const player of players) {
            const playerEntity = await this.fetchPlayer(player.meta.playerId);
            if (playerEntity !== null) {
                competingMap[player.meta.playerId] = {
                    competing: player.meta,
                    player: {
                        playerId: playerEntity.meta.playerId,
                        name: playerEntity.meta.name,
                    }
                }
            }
        }

        const result = competingMap;
        return {
            id: "COMPETITION-PLAYERS_" + competitionId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceRelevantPhaseSnapshots(tournamentId: string, phaseId: string) {
        // We need to get all the stages that are starting at this phase and load the appropriate phase to get the snapshotted table out

        const tournamentStructure = await this.fetchTournamentStructure(tournamentId);
        if (tournamentStructure === null) {
            throw new Error("Cannot source missing tournament structure: " + tournamentId);
        }

        const phaseStructure = await this.fetchTournamentPhaseStructure(tournamentId, phaseId);
        if (phaseStructure === null) {
            throw new Error("Cannot source missing tournament phase structure: " + phaseId);
        }

        const relevantPhaseSnapshots: Record<string, SnapshotsByGroup> = {};

        const stageIds = phaseStructure.meta.includedStages;
        for (const stageId of stageIds) {
            if (stageId in tournamentStructure.meta.phaseBeforeStageStarts) {
                const phaseIdNum: number = tournamentStructure.meta.phaseBeforeStageStarts[stageId];
                const phaseId = phaseIdNum.toString();
                if (!(phaseId in relevantPhaseSnapshots)) {
                    const tables = await this.fetchTournamentTablesPostPhase(tournamentId, phaseId);
                    if (tables === null) {
                        throw new Error("Missing tournament tables for phase: " + phaseId);
                    }
                    relevantPhaseSnapshots[phaseId] = tables.meta.latestTables;
                }
            }
        }

        const result = relevantPhaseSnapshots;
        return {
            id: "TOURNAMENT-RELEVANT-PHASE-SNAPSHOTS_" + tournamentId + "_" + phaseId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    async sourceTournamentPhaseKickoffs(tournamentId: string, phaseId: string, timeNow: Date) {
        const tournamentStructure = await this.fetchTournamentStructure(tournamentId);
        if (tournamentStructure === null) {
            throw new Error("Cannot source missing tournament structure: " + tournamentId);
        }

        const phaseStructure = await this.fetchTournamentPhaseStructure(tournamentId, phaseId);
        if (phaseStructure === null) {
            throw new Error("Cannot source missing tournament phase structure: " + phaseId);
        }

        const result: Record<string, string> = {};

        for (const match of phaseStructure.meta.matches) {
            if (match.status === "MATCH_ON") {
                if (timeNow > new Date(match.scheduledKickoff.isoDate)) {
                    result[match.matchId] = match.scheduledKickoff.isoDate;
                }
            }
        }

        return {
            id: "TOURNAMENT-PHASE-KICKOFFS_" + tournamentId + "_" + phaseId,
            contentHash: objectHash(result),
            result: result,
        }
    }

    
    async sourceCompetitionPredictions(competitionId: string, phaseId: string) {
        // First get the competition to obtain the tournamentId
        const competition = await this.fetchCompetition(competitionId);
        if (competition === null) {
            throw new Error("Cannot source prediction of missing competition: " + competitionId);
        }
        const tournamentId = competition.meta.tournamentId;

        // Then get the competing players for this competition
        const players = await this.fetchCompetitionPlayersCompeting(competitionId);
        const competingMap: Record<string, Competing> = {};
        for (const player of players) {
            competingMap[player.meta.playerId] = player.meta;
        }
        const playerIds = Object.keys(competingMap);

        // It is more efficient to get the tournament phase structure to get the list of matches and loop through them rather than getting every prediction ever for this tournament
        const phaseStructure = await this.fetchTournamentPhaseStructure(tournamentId, phaseId);
        if (phaseStructure === null) {
            throw new Error("Cannot source predictions if missing phase structure: " + phaseId);
        }
        const matches = phaseStructure.meta.matches;

        const result: Record<string, PlayerPrediction | null> = {};
        for (const match of matches) {
            const matchId = match.matchId;
            for (const playerId of playerIds) {
                let thisPrediction = null;
                const prediction = await this.fetchPrediction(tournamentId, matchId, playerId);
                if (prediction !== null) {
                    thisPrediction = prediction.meta.prediction
                }
                const compositeId = playerId + "_" + matchId;
                result[compositeId] = thisPrediction;
            }
        }

        return {
            id: "COMPETITION-PREDICTIONS_" + competitionId + "_" + phaseId,
            contentHash: objectHash(result),
            result: result,
        }
    }
}

export type PhaseTime = {
    earliestMatchKickoff: ISODate
    latestMatchKickoff: ISODate
}
export type PhaseTimes = Record<string, PhaseTime>

export type TournamentStructure = {
    tournamentId: string
    generatedAt: ISODate
    phaseTimes: PhaseTimes
    phaseBeforeStageStarts: Record<string, number>
    groupTeams: Record<string, Record<string, TournamentTeam>> // An index of which teams are in which groups

    sourceHashes: Record<string, string> // A record of the unique source ids to their content hashes that were used in the generation of this data
}

export type TournamentMatchPhase = {
    tournamentId: string
    matchId: string
    phaseId: string
}

export type CompetitionPlayer = {
    playerId: string
    name: string
}

export type PlayerStandingsRow = {
    position: number
    player: CompetitionPlayer
    points: PlayerPointsRow

    previousRankingPosition?: number
}

export type PlayerPointsRow = {
    predicted: number
    missed: number

    correctScoresTotal: number
    correctGDTotal: number
    correctOutcomeTotal: number
    correctTotal: number
    incorrectTotal: number
    regularPoints: number
    bankerPoints: number
    totalPoints: number
}

export type PlayerPredictionResult = {
    resultType: "MISSED" | "CORRECT_SCORE" | "CORRECT_GD" | "CORRECT_RESULT" | "INCORRECT_RESULT"
    regularPoints: number
    bankerPoints: number
    wasBanker: boolean
}

/*
// Seems to not be used anywhere
export type PhaseMatch = {
    matchId: string

    homeTeam: TournamentTeam
    awayTeam: TournamentTeam

    scheduledKickoff: Date
    hasKickedOff: boolean
    stage: string
    group: string

    knownBankerMultiplier: null | number

    latestScore: null | MatchScore
}
*/

export type CompetitionTablesPostPhase = {
    competitionId: string
    phaseId: string
    details: TournamentPhaseStructure
    stageGroupLeagueSnapshotBefore: Record<string, Record<string, LeagueTableSnapshot>>
    // If a stage is starting during this phase, we put a snapshot of all group tables here

    matchPlayerPredictions: Record<string, Record<string, PlayerPrediction | null>>
    matchPlayerPoints: Record<string, Record<string, PlayerPredictionResult>>
    playerTotalPoints: Record<string, number>
    standingsSnapshotAfter: Array<PlayerStandingsRow>

    sourceHashes: Record<string, string> // A record of the unique source ids to their content hashes that were used in the generation of this data
}

/*
export type ResultsPage = {
    competitionId: string
    pageNum: number
    isLastPage: boolean

    phases: Array<PhaseResult>
}
*/

export type TournamentPhaseStructure = {
    tournamentId: string
    phaseId: string
    earliestMatchKickoff: ISODate
    latestMatchKickoff: ISODate
    includedStages: Array<string>
    startingStages: Array<string>
    
    matches: Array<TournamentMatchWithTeams>
    // Note: TournamentMatch has no score on purpose so we don't have to rebuild the tournament structure phases every time a match changes its score.
    // Note: Using TournamentMatchWithTeams now, which includes a snapshot of the team in the phase.  
    // If the teams update anything, a full structure rebuild will be needed, but this is rare enough.
}

export type TournamentMatchWithTeams = TournamentMatch & {
    homeTeam: TournamentTeam
    awayTeam: TournamentTeam
}

export type LeagueTableSnapshot = {
    table: LeagueTable
    snapshotAt: Date | null // Setting null here means the table is the latest most up to date table
    description: string
}


// Too similar to a TeamPointsRow
export type LeagueTableRow = {
    team: TournamentTeam
    rank: null | number
    stats: HomeAwayPoints
}

export type LeagueTable = Array<LeagueTableRow> // A League Table contains aggregated results (sumed points and penalties) ready for display

export type HomeAwayPoints = {
    played: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
    points: number
    pointsAgainst: {[key: string]: number}
    awayGoalsAgainst: {[key: string]: number}
    penalties: Array<Penalty>
}

export type TeamPointsRow = {
    team: TournamentTeam
    rank: null | number
    home: HomeAwayPoints
    away: HomeAwayPoints
    penalties: Array<Penalty>
}

export type Penalty = {
    deduction: number
    reason: string
}

export type SnapshotsByGroup = Record<string, LeagueTableSnapshot>;

export type TournamentTablesPostPhase = {
    tournamentId: string
    phaseId: string
    generatedAt: ISODate
    latestTables: SnapshotsByGroup
    cumGroupTeamPoints: Record<string, Record<string, TeamPointsRow>>
    matchScores: Record<string, MatchScore | null>

    // Note: These are time based, so should not be in the tournament tables result
    /*
    isPhaseStarted: boolean
    isPhaseCompleted: boolean
    matchesKickedOff: number // The number of matches kicked off at this point.  This will change based on the execution time of the script.
    */
    // This might not be enough...

    sourceHashes: Record<string, string> // A record of the unique source ids to their content hashes that were used in the generation of this data
}
