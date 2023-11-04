
import { PredictorJobBus } from "../lib/predictorJobBus";
import { ISODate, PlayerPrediction, PredictorStorage, MatchScore, TournamentMatchStatus } from "../lib/predictorStorage";

export class PredictorActionsHandler {

    private storage: PredictorStorage;
    private jobBus: PredictorJobBus;

    constructor(storage: PredictorStorage, jobBus: PredictorJobBus) {
        this.storage = storage;
        this.jobBus = jobBus;
    }

    async putPlayer(playerId: string, name: string, email: string) {
        await this.storage.storePlayer({
            playerId,
            name,
            email,
            competitionIdList: [],
        });
    }

    async putTournament(tournamentId: string, name: string) {
        await this.storage.storeTournament({
            tournamentId,
            name,
        });
    }

    async putCompetition(competitionId: string, tournamentId: string, name: string, adminPlayerId: string) {
        // Check that player exists
        const player = await this.storage.fetchPlayer(adminPlayerId);
        if (player === null) {
            throw new Error("Unknown player id: " + adminPlayerId);
        }

        // Check that the tournament exists
        const tournament = await this.storage.fetchTournament(tournamentId);
        if (tournament === null) {
            throw new Error("Unknown tournament id: " + tournamentId);
        }

        await this.storage.storeCompetition({
            competitionId,
            tournamentId,
            name,
            adminPlayerId,
            competingPlayerIdList: [],
        });

        await this.rebuildCompetitionTables(competitionId);
    }

    async playerCompeting(playerId: string, competitionId: string, initialPhase: number, initialPoints: number) {
        // Check that player exists
        const player = await this.storage.fetchPlayer(playerId);
        if (player === null) {
            throw new Error("Unknown player id: " + playerId);
        }

        // Check that the competition exists
        const competition = await this.storage.fetchCompetition(competitionId);
        if (competition === null) {
            throw new Error("Unknown competition id: " + competitionId);
        }

        // This writes the entity PLAYER-COMPETING which contains competing meta data
        // It will also ensure appropriate ids and meta are included in the indexed entities PLAYER-COMPETITIONS and COMPETITION-PLAYERS

        await this.storage.storePlayerCompeting({
            playerId,
            competitionId,
            initialPhase,
            initialPoints,
        });

        // Make sure that this player is in the competing list for this competition
        const players = await this.storage.fetchCompetitionPlayers(competitionId);
        let playersRecord: Record<string, {
            initialPhase: number
            initialPoints: number
        }>;
        if (players === null) {
            // First player joined this competition
            playersRecord = {};
        } else {
            // Load existing players first
            playersRecord = players.meta.players;
        }

        // Set this players meta in the index
        const indexedMeta = {
            initialPhase,
            initialPoints,
        }
        if (playerId in playersRecord && playersRecord[playerId] == indexedMeta) {
            // Nothing to do here
        } else {
            // Update
            playersRecord[playerId] = indexedMeta;
            await this.storage.storeCompetitionPlayers({
                competitionId,
                players: playersRecord
            });
        }

        // Also make sure the competition is in the competition list for this player
        const competitions = await this.storage.fetchPlayerCompetitions(playerId);
        let competitionsRecord: Record<string, boolean>;
        if (competitions === null) {
            // First competition joined by this player
            competitionsRecord = {};
        } else {
            competitionsRecord = competitions.meta.competitions;
        }

        let updated = false;
        if (competitionId in competitionsRecord) {
            // Nothing to do here
        } else {
            // Update
            competitionsRecord[competitionId] = true;
            await this.storage.storePlayerCompetitions({
                playerId,
                competitions: competitionsRecord
            });
            updated = true;
        }

        if (updated) {
            await this.rebuildCompetitionTables(competitionId);
        }
    }

    async playerNotCompeting(playerId: string, competitionId: string) {
        // Check that player exists
        const player = await this.storage.fetchPlayer(playerId);
        if (player === null) {
            throw new Error("Unknown player id: " + playerId);
        }

        // Check that the competition exists
        const competition = await this.storage.fetchCompetition(competitionId);
        if (competition === null) {
            throw new Error("Unknown competition id: " + competitionId);
        }

        // This removes the entity PLAYER-COMPETING
        // It will also ensure appropriate ids and meta are removed from the indexed entities PLAYER-COMPETITIONS and COMPETITION-PLAYERS
        await this.storage.removePlayerCompeting(playerId, competitionId);

        // Make sure that this player is NOT in the competing list for this competition
        const players = await this.storage.fetchCompetitionPlayers(competitionId);
        let playersRecord: Record<string, {
            initialPhase: number
            initialPoints: number
        }>;
        if (players === null) {
            // No players list yet anyway,
            playersRecord = {};
        } else {
            // Load existing players first
            playersRecord = players.meta.players;
        }

        // Remove this players meta from the index 
        if (playerId in playersRecord) {
            // Remove
            delete playersRecord[playerId];
            await this.storage.storeCompetitionPlayers({
                competitionId,
                players: playersRecord
            });
        } else {
            // Nothing to do here
        }

        // Also make sure the competition is NOT in the competition list for this player
        const competitions = await this.storage.fetchPlayerCompetitions(playerId);
        let competitionsRecord: Record<string, boolean>;
        if (competitions === null) {
            // No competitions list yet anyway
            competitionsRecord = {};
        } else {
            competitionsRecord = competitions.meta.competitions;
        }

        let updated = false;
        if (competitionId in competitionsRecord) {
            // Remove
            delete competitionsRecord[competitionId];
            await this.storage.storePlayerCompetitions({
                playerId,
                competitions: competitionsRecord
            });
            updated = true;
        } else {
            // Nothing to do
        }

        if (updated) {
            await this.rebuildCompetitionTables(competitionId);
        }
    }

    async rebuildCompetitionTables(competitionId: string) {
        // Rebuild competition tables for all of its phases
        const competition = await this.storage.fetchCompetition(competitionId);
        if (competition !== null) {
            const tournamentId = competition.meta.tournamentId;
            const structure = await this.storage.fetchTournamentStructure(tournamentId);
            if (structure !== null) {
                const lastPhaseId = structure.meta.lastPhaseId;
                for (let phaseId=0; phaseId<=lastPhaseId; phaseId++) {
                    await this.jobBus.enqueueRebuildCompetitionTablePostPhase(competitionId, phaseId.toString());
                }
            }
        }
    }

    async putTournamentTeam(tournamentId: string, teamId: string, name: string, shortName: string, logo48: string, groupIds: Array<string>, rebuildType: "NEW_TEAM" | "META_UPDATED") {
        // Check that the tournament exists
        const tournament = await this.storage.fetchTournament(tournamentId);
        if (tournament === null) {
            throw new Error("Unknown tournament id: " + tournamentId);
        }

        await this.storage.storeTournamentTeam({
            tournamentId,
            teamId,
            name,
            shortName,
            logo48,
            groupIds,
        });

        // TODO Real event firing
    }

    async putTournamentMatch(tournamentId: string, matchId: string, stageId: string, homeTeamId: string, awayTeamId: string, scheduledKickoff: ISODate, groupId: string, status: TournamentMatchStatus, statusMessage: string | null) {
        // Check that the tournament exists
        const tournament = await this.storage.fetchTournament(tournamentId);
        if (tournament === null) {
            throw new Error("Unknown tournament id: " + tournamentId);
        }

        // Check that the home team exists
        const homeTeam = await this.storage.fetchTournamentTeam(tournamentId, homeTeamId);
        if (homeTeam === null) {
            throw new Error("Unknown home team id: " + homeTeamId);
        }

        // Check that the away team exists
        const awayTeam = await this.storage.fetchTournamentTeam(tournamentId, awayTeamId);
        if (awayTeam === null) {
            throw new Error("Unknown away team id: " + awayTeamId);
        }

        await this.storage.storeTournamentMatch({
            tournamentId,
            matchId,
            homeTeamId,
            awayTeamId,
            scheduledKickoff,
            stageId,
            groupId,
            status,
            statusMessage,
        });

        // Tournament structure WILL have changed
        await this.jobBus.enqueueRebuildTournamentStructure(tournamentId);
    }
    
    async putTournamentMatchScore(tournamentId: string, matchId: string, score: null | MatchScore) {
        // Check that the tournament exists
        const tournament = await this.storage.fetchTournament(tournamentId);
        if (tournament === null) {
            throw new Error("Unknown tournament id: " + tournamentId);
        }

        // Check that the match exists
        const match = await this.storage.fetchTournamentMatch(tournamentId, matchId);
        if (match === null) {
            throw new Error("Unknown match id: " + matchId + " in tournament " + tournamentId);
        }

        await this.storage.storeTournamentMatchScore({
            tournamentId,
            matchId,
            score
        });

        // Find the tournament structure first
        const structure = await this.storage.fetchTournamentStructure(tournamentId);
        if (structure === null) {
            // The tournament structure might be being built as we speak and it may not have got the latest update
            // But since this is a score update only, it should be fine
            // await this.jobBus.enqueueRebuildTournamentStructure(tournamentId);
        } else {
            // Find the calculated phaseId of this match
            const result = await this.storage.fetchTournamentMatchPhase(tournamentId, matchId);
            if (result === null) {
                // We are not yet aware of this matches phase.
                // This can happen if the match has not been indexed properly in to a phase yet by a tournament structure build.
                // When it is, the phase structures will be updated anyway and trigger table rebuilds
                // So we should be able to ignore this one
            } else {
                const initialPhaseId = parseInt(result.meta.phaseId, 10);
                const numOfPhases = structure.meta.contentHashOfPhases.length;
                for (let phaseId=initialPhaseId; phaseId<numOfPhases; phaseId++) {
                    await this.jobBus.enqueueRebuildTournamentTablePostPhase(tournamentId, phaseId.toString());
                }
            }
        }
    }

    async putPlayerPrediction(playerId: string, tournamentId: string, matchId: string, prediction: null | PlayerPrediction) {
        // Check that player exists
        const player = await this.storage.fetchPlayer(playerId);
        if (player === null) {
            throw new Error("Unknown player id: " + playerId);
        }

        // Check that the tournament exists
        const tournament = await this.storage.fetchTournament(tournamentId);
        if (tournament === null) {
            throw new Error("Unknown tournament id: " + tournamentId);
        }

        // Check that the match exists for this tournament
        const match = await this.storage.fetchTournamentMatch(tournamentId, matchId);
        if (match === null) {
            throw new Error("Unknown match id: " + matchId + " in tournament " + tournamentId);
        }

        await this.storage.storePrediction({
            playerId,
            tournamentId,
            matchId,
            prediction
        });

        const structure = await this.storage.fetchTournamentStructure(tournamentId);
        if (structure === null) {
            // Ignore if no structure yet
        } else {
            // Find this matches phase
            const phaseResult = await this.storage.fetchTournamentMatchPhase(tournamentId, matchId);
            if (phaseResult === null) {
                // This match is not indexed yet in to a phase
                // It will be eventually, and the updates to phase structure (which happen at the same time) will trigger tournament table rebuilds and competition table rebuilds
            } else {
                // Find the competitions for this tournament
                const competitions = await this.storage.fetchCompetitionsByTournamentId(tournamentId);
                for (const competition of competitions) {
                    const initialPhaseId = parseInt(phaseResult.meta.phaseId);
                    const numOfPhases = structure.meta.contentHashOfPhases.length;
                    for (let phaseId=initialPhaseId; phaseId<numOfPhases; phaseId++) {
                        await this.jobBus.enqueueRebuildCompetitionTablePostPhase(competition.meta.competitionId, phaseId.toString());
                    }
                }
            }
        }
    }
}
