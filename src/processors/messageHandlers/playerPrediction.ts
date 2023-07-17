// Anything to do with competition messages.

import { IMessage } from "redis-state-management/dist/types";
import { MessageHandler } from "../messageHandler"
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule";
import { setPlayerPrediction } from "./playerLib";
import { getTournamentMatch, getTournamentMatchStageValue, triggerRebuildAllPlayerTournamentCompetitionResults } from "./tournamentLib";
import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";

export type IncomingPlayerPrediction = {
    score: IncomingPlayerPredictionScore | null
    isBanker: boolean
}

export type IncomingPlayerPredictionScore = {
    home: number
    away: number
}

export type PlayerPredictionMessagePayload = {
    playerId: string
    tournamentId: string
    matchId: string
    
    prediction: null | IncomingPlayerPrediction
}


export interface PlayerPredictionMessage extends IMessage<"PLAYER_PREDICTION", PlayerPredictionMessagePayload> {};

export class PlayerPredictionMessageHandler extends MessageHandler<"PLAYER_PREDICTION", PlayerPredictionMessagePayload> {
    constructor() {
        super("PLAYER_PREDICTION");
    }
    async processMessage(message: PlayerPredictionMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        console.log("Handling player prediction message: Match ID " + message.meta.matchId + " is " + message.meta.prediction?.score?.home + " - " + message.meta.prediction?.score?.away + "...");

        const tournamentId = message.meta.tournamentId;
        const playerId = message.meta.playerId;
        const matchId = message.meta.matchId;

        const prediction = message.meta.prediction;
        // Just store the incoming prediction in the players prediction map for this tournament
        await setPlayerPrediction(writer, tournamentId, playerId, matchId, prediction);

        // It is not certain whether this could alter the outcome of the scores.  
        // Normally incoming predictions arrive before a match starts, so there is normally nothing to rebuild
        // but in the event of a forced prediction update by an admin, we may need to rebuild if the prediction should be visible on the page
        // If the prediction message timestamp is after kick off time, there is a chance that we need a rebuild.
        // BUT it would require 2 lookups to get the stage

        let triggerAll = true;
        try {
            const stageId = await getTournamentMatchStageValue(reader, tournamentId, matchId);
            if (stageId === null) {
                throw new Error("Stage unknown for match " + matchId + " in tournament " + tournamentId);
            }

            const match = await getTournamentMatch(reader, tournamentId, matchId, stageId);
            if (match === null) {
                throw new Error("Match unknown in stage " + stageId + " of tournament " + tournamentId);
            }

            const messageAt = new Date(message.occurredAt);
            const kickOff = new Date(match.scheduledKickoff);
            if (messageAt > kickOff) {
                
            } else {
                triggerAll = false;
            }
        } catch(e: any) {
            // Soft fail due to missing data probably
            console.warn("SOFT FAIL: " + e.message);
        }
        if (triggerAll) {
            await triggerRebuildAllPlayerTournamentCompetitionResults(reader, tournamentId, playerId, queues, schedule);
        }

        console.log("Handling complete");
    }
}
