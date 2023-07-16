import { RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";
import { PlayerPrediction, PlayerState } from "../states/player";

export async function setPlayer(writer: RedisStorageStateWriter, playerId: string, player: PlayerState) {
    const mapId = "PLAYERS";
    await writer.setHashmapValue<PlayerState>(mapId, playerId, player);
}
export async function getPlayer(reader: RedisStorageStateReader, playerId: string) {
    const mapId = "PLAYERS";
    return await reader.getHashmapValue<PlayerState>(mapId, playerId);
}

export async function ensurePlayerJoinedCompetition(writer: RedisStorageStateWriter, playerId: string, competitionId: string) {
    // Need to update both hashsets
    const pSetId = "PLAYER-" + playerId + "-COMPETITIONS";
    await writer.addToStringSet(pSetId, [competitionId]);

    const cSetId = "COMPETITION-" + competitionId + "-PLAYERS";
    await writer.addToStringSet(cSetId, [playerId]);
}

export async function getAllPlayersCompetitions(reader: RedisStorageStateReader, playerId: string) {
    const pSetId = "PLAYER-" + playerId + "-COMPETITIONS";
    return await reader.getStringSet(pSetId);
}
export async function getAllCompetitionsPlayers(reader: RedisStorageStateReader, competitionId: string) {
    const cSetId = "COMPETITION-" + competitionId + "-PLAYERS";
    return await reader.getStringSet(cSetId);
}

export async function setPlayerPrediction(writer: RedisStorageStateWriter, tournamentId: string, playerId: string, matchId: string, prediction: PlayerPrediction | null) {
    const mapId = "TOURNAMENT-" + tournamentId + "-PLAYER-" + playerId + "-PREDICTIONS";
    await writer.setHashmapValue<PlayerPrediction>(mapId, matchId, prediction);
}

export async function getPlayerPrediction(reader: RedisStorageStateReader, tournamentId: string, playerId: string, matchId: string) {
    const mapId = "TOURNAMENT-" + tournamentId + "-PLAYER-" + playerId + "-PREDICTIONS";
    return await reader.getHashmapValue<PlayerPrediction>(mapId, matchId);
}
