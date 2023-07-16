// Anything to do with competition messages.

import { MessageHandler } from "../messageHandler"
import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule";
import { PlayerState } from "../states/player";
import { triggerRebuildCompetitionResults } from "./competitionLib";
import { getAllPlayersCompetitions, getPlayer, setPlayer } from "./playerLib";
import { IMessage } from "redis-state-management/dist/types";

export type PlayerMessagePayload = {
    playerId: string
    
    name: string
    email: string
}


export interface PlayerMessage extends IMessage<"PLAYER", PlayerMessagePayload> {};

export class PlayerMessageHandler extends MessageHandler<"PLAYER", PlayerMessagePayload> {
    constructor() {
        super("PLAYER");
    }
    async processMessage(message: PlayerMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        const playerId = message.meta.playerId;

        console.log("Handling player message: ID " + message.meta.playerId + " is called " + message.meta.name + " queued at " + message.occurredAt + "...");

        const current = await getPlayer(reader, message.meta.playerId);
        if (current === null) {
            const player: PlayerState = {
                playerId: message.meta.playerId,
                name: message.meta.name,
                email: message.meta.email,
                registeredAt: message.occurredAt,
                profileImages:[],
            }
            await setPlayer(writer, playerId, player);
            console.log("Player created", player);

            // Due to being order agnostic, this can occur outside of a competition/tournament queue
            // So if a player has joined a competition before they exist, we need to handle that
            const competitionIds = await getAllPlayersCompetitions(reader, playerId);
            for (const competitionId of competitionIds) {
                await triggerRebuildCompetitionResults(competitionId, queues, schedule);
            }

        } else {
            // TODO
            console.warn("TODO: Cannot handle duplicate player message");
            return;
        }
    }
}
