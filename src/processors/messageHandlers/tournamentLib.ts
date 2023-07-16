import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from 'redis-state-management';
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule";
import { TournamentTablesState } from "../states/tables";
import { TournamentMatch, TournamentPhasesState, TournamentState, TournamentTeam } from "../states/tournament";
import { triggerRebuildCompetitionResults } from "./competitionLib";
import { getAllPlayersCompetitions } from "./playerLib";

export async function setTournament(writer: RedisStorageStateWriter, tournamentId: string, tournament: TournamentState) {
    const mapId = "TOURNAMENTS";
    await writer.setHashmapValue<TournamentState>(mapId, tournamentId, tournament);
}
export async function getTournament(reader: RedisStorageStateReader, tournamentId: string) {
    const mapId = "TOURNAMENTS";
    return await reader.getHashmapValue<TournamentState>(mapId, tournamentId);
}

// Append the tournament changed structure message and notify on that queue
export async function triggerTournamentStructureChanged(tournamentId: string, queues: RedisQueuesController, schedule: QueueProcessingSchedule) {
    const queueName = "TOURNAMENT-" + tournamentId + "-STRUCTURE-CHANGED";
    await queues.pushMessage(queueName, {
        occurredAt: (new Date()).toISOString(),
        type: "TOURNAMENT_STRUCTURE_CHANGED",
        meta: {
            tournamentId: tournamentId,
        }
    });
    await schedule.triggerQueueForProcessing(queueName);
}

export async function setTournamentPhasesStructure(writer: RedisStorageStateWriter, tournamentId: string, state: TournamentPhasesState, queues: RedisQueuesController, schedule: QueueProcessingSchedule) {
    // const phasesStateId = "TOURNAMENT-" + tournamentId + "-PHASES";
    // await sm.setValue<TournamentPhasesState>(phasesStateId, state);
    const mapId = "TOURNAMENT-PHASES";
    await writer.setHashmapValue<TournamentPhasesState>(mapId, tournamentId, state);

    await triggerRebuildTournamentTables(tournamentId, queues, schedule);
    
}
export async function getTournamentPhasesStructure(reader: RedisStorageStateReader, tournamentId: string) {
    // const phasesStateId = "TOURNAMENT-" + tournamentId + "-PHASES";
    // await sm.getValue<TournamentPhasesState>(phasesStateId);
    const mapId = "TOURNAMENT-PHASES";
    return await reader.getHashmapValue<TournamentPhasesState>(mapId, tournamentId);
}

export async function setTournamentTables(reader: RedisStorageStateReader, writer: RedisStorageStateWriter, tournamentId: string, state: TournamentTablesState, queues: RedisQueuesController, schedule: QueueProcessingSchedule) {
    const mapId = "TOURNAMENT-TABLES";
    await writer.setHashmapValue<TournamentTablesState>(mapId, tournamentId, state);

    // Notify all of the competitions using a rebuild results message.
    await triggerRebuildAllCompetitionResults(reader, tournamentId, queues, schedule);
}
export async function getTournamentTables(reader: RedisStorageStateReader, tournamentId: string) {
    const mapId = "TOURNAMENT-TABLES";
    return await reader.getHashmapValue<TournamentTablesState>(mapId, tournamentId);
}


export async function triggerRebuildTournamentTables(tournamentId: string, queues: RedisQueuesController, schedule: QueueProcessingSchedule) {
    // After rebuilding the tournament structure, this is called to also trigger tables
    // We probably don't need another event for this, but it is easier this way
    const queueName = "TOURNAMENT-" + tournamentId + "-REBUILD-TABLES";
    await queues.pushMessage(queueName, {
        occurredAt: (new Date()).toISOString(),
        type: "TOURNAMENT_REBUILD_TABLES",
        meta: {
            tournamentId: tournamentId,
        }
    });
    await schedule.triggerQueueForProcessing(queueName);
}

export async function triggerTournamentScoresChanged(tournamentId: string, queues: RedisQueuesController, schedule: QueueProcessingSchedule) {
    // Scores changing needs to rebuild tables first (which will in turn, rebuild results for all competitions)
    await triggerRebuildTournamentTables(tournamentId, queues, schedule);
}



export async function triggerRebuildAllCompetitionResults(reader: RedisStorageStateReader, tournamentId: string, queues: RedisQueuesController, schedule: QueueProcessingSchedule) {
    // Get all competitions for this tournament and trigger rebuilds for them all
    const competitionIds = await getAllCompetitionIdsByTournamentId(reader, tournamentId);
    for (const competitionId of competitionIds) {
        await triggerRebuildCompetitionResults(competitionId, queues, schedule);
    }
}

export async function triggerRebuildAllPlayerTournamentCompetitionResults(reader: RedisStorageStateReader, tournamentId: string, playerId: string, queues: RedisQueuesController, schedule: QueueProcessingSchedule) {
    // Trigger rebuild for all competitions that include this tournament and player
    const tournamentCompetitionIds = await getAllCompetitionIdsByTournamentId(reader, tournamentId);

    const playerCompetitionIds = await getAllPlayersCompetitions(reader, playerId);

    const intersection = tournamentCompetitionIds.filter(x => playerCompetitionIds.includes(x));
    for (const competitionId of intersection) {
        await triggerRebuildCompetitionResults(competitionId, queues, schedule);
    }
}

// Stores the stageId of a certain match for tracking purposes
export async function setTournamentMatchStageValue(writer: RedisStorageStateWriter, tournamentId: string, matchId: string, stageId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-MATCHSTAGES";
    await writer.setHashmapValue<string>(mapId, matchId, stageId);
}
export async function getTournamentMatchStageValue(reader: RedisStorageStateReader, tournamentId: string, matchId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-MATCHSTAGES";
    return await reader.getHashmapValue<string>(mapId, matchId);
}
// To avoid having to track the list of stage ids within the tournament state, we can obtain all the stage ids from the hashmap values.
// Note: Prefer to use getAllTournamentStageIds now, which uses the new hashset for set of stage ids
/*
export async function getTournamentStages(sm: StateManager, tournamentId: string, matchId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-MATCHSTAGES";
    const stages = await sm.getAllHashmapValues<string>(mapId);
    return uniqueArray(stages);
}
function uniqueArray(arr: Array<any>) {
    return [...new Set(arr)];
}
*/

export async function ensureStageIdInTournamentState(writer: RedisStorageStateWriter, tournamentId: string, stageId: string) {
    // Note: No longer in tournament state, instead uses a string set to store all of the stage ids in a tournament
    const setId = "TOURNAMENT-" + tournamentId + "-STAGEIDS";
    await writer.addToStringSet(setId, [stageId]);
}
export async function ensureStageIdNotInTournamentState(writer: RedisStorageStateWriter, tournamentId: string, stageId: string) {
    const setId = "TOURNAMENT-" + tournamentId + "-STAGEIDS";
    await writer.removeFromStringSet(setId, [stageId]);
}
export async function getAllTournamentStageIds(reader: RedisStorageStateReader, tournamentId: string) {
    const setId = "TOURNAMENT-" + tournamentId + "-STAGEIDS";
    return await reader.getStringSet(setId);
}

// Stores the matches at a particular stage in a hashmap
export async function setTournamentMatch(writer: RedisStorageStateWriter, tournamentId: string, matchId: string, stageId: string, match: TournamentMatch) {
    const mapId = "TOURNAMENT-" + tournamentId + "-STAGE-" + stageId + "-MATCHES";
    await writer.setHashmapValue<TournamentMatch>(mapId, matchId, match);
}
export async function getTournamentMatch(reader: RedisStorageStateReader, tournamentId: string, matchId: string, stageId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-STAGE-" + stageId + "-MATCHES";
    return await reader.getHashmapValue<TournamentMatch>(mapId, matchId);
}
export async function delTournamentMatch(writer: RedisStorageStateWriter, tournamentId: string, matchId: string, stageId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-STAGE-" + stageId + "-MATCHES";
    return await writer.delHashmapValue(mapId, matchId);
}
export async function getNumberOfMatchesAtStage(reader: RedisStorageStateReader, tournamentId: string, stageId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-STAGE-" + stageId + "-MATCHES";
    return await reader.getHashmapSize(mapId);
}
export async function getMatchesAtStage(reader: RedisStorageStateReader, tournamentId: string, stageId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-STAGE-" + stageId + "-MATCHES";
    return await reader.getAllHashmapValues<TournamentMatch>(mapId);
}




export async function ensureTournamentCompetitionId(writer: RedisStorageStateWriter, tournamentId: string, competitionId: string) {
    const setId = "TOURNAMENT-" + tournamentId + "-COMPETITIONS";
    await writer.addToStringSet(setId, [competitionId]);
}
export async function getAllCompetitionIdsByTournamentId(reader: RedisStorageStateReader, tournamentId: string) {
    const setId = "TOURNAMENT-" + tournamentId + "-COMPETITIONS";
    return await reader.getStringSet(setId);
}


// Stores the tournament teams in a hashmap
export async function setTournamentTeam(writer: RedisStorageStateWriter, tournamentId: string, teamId: string, team: TournamentTeam) {
    const mapId = "TOURNAMENT-" + tournamentId + "-TEAMS";
    await writer.setHashmapValue<TournamentTeam>(mapId, teamId, team);
}
export async function getTournamentTeam(reader: RedisStorageStateReader, tournamentId: string, teamId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-TEAMS";
    return await reader.getHashmapValue<TournamentTeam>(mapId, teamId);
}
export async function delTournamentTeam(writer: RedisStorageStateWriter, tournamentId: string, teamId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-TEAMS";
    return await writer.delHashmapValue(mapId, teamId);
}
export async function getNumberOfTeamsInTournament(reader: RedisStorageStateReader, tournamentId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-TEAMS";
    return await reader.getHashmapSize(mapId);
}
export async function getTeamsInTournament(reader: RedisStorageStateReader, tournamentId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-TEAMS";
    return await reader.getHashmapAsRecord<TournamentTeam>(mapId);
}
