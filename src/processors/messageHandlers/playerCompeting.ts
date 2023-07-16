// Anything to do with competition messages.

import { MessageHandler } from "../messageHandler"
import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule";
import { triggerRebuildCompetitionResults } from "./competitionLib";
import { ensurePlayerJoinedCompetition } from "./playerLib";
import { IMessage } from "redis-state-management/dist/types";

export type PlayerCompetingMessagePayload = {
    playerId: string
    competitionId: string
}


export interface PlayerCompetingMessage extends IMessage<"PLAYER_COMPETING", PlayerCompetingMessagePayload> {};

export class PlayerCompetingMessageHandler extends MessageHandler<"PLAYER_COMPETING", PlayerCompetingMessagePayload> {
    constructor() {
        super("PLAYER_COMPETING");
    }
    async processMessage(message: PlayerCompetingMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        // Note: Does not require the player to exist yet in the state

        // A player is joining a competition, make sure this is stored in both mirrored hashsets
        await ensurePlayerJoinedCompetition(writer, message.meta.playerId, message.meta.competitionId);

        // Should probably also rebuild the competition results since a new player has joined
        await triggerRebuildCompetitionResults(message.meta.competitionId, queues, schedule);
    }
}
