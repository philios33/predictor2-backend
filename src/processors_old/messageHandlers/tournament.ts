// Anything to do with tournament messages.
// These define a tournament id and name.

import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";
import { MessageHandler } from "../messageHandler"
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule";
import { TournamentState } from "../states/tournament";
import { getTournament, setTournament } from "./tournamentLib";
import { IMessage } from "redis-state-management/dist/types";

export type TournamentMessagePayload = {
    tournamentId: string
    name: string
}


export interface TournamentMessage extends IMessage<"TOURNAMENT", TournamentMessagePayload> {};

export class TournamentMessageHandler extends MessageHandler<"TOURNAMENT", TournamentMessagePayload> {
    constructor() {
        super("TOURNAMENT");
    }
    async processMessage(message: TournamentMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        console.log("Handling tournament message: ID " + message.meta.tournamentId + " is called " + message.meta.name + " queued at " + message.occurredAt + "...");

        const current = await getTournament(reader, message.meta.tournamentId);
        if (current === null) {
            const tournament: TournamentState = {
                tournamentId: message.meta.tournamentId,
                name: message.meta.name,
                createdAt: message.occurredAt,
            }
            await setTournament(writer, message.meta.tournamentId, tournament);
            console.log("Tournament created", tournament);

        } else {
            // It already exists, update name
            current.name = message.meta.name;

            await setTournament(writer, message.meta.tournamentId, current);
            console.log("Already exists", current);

            /*
            queues.pushMessage("phil", {
                type: "UPDATE",
                meta: {
                    phil: true,
                },
                occurredAt: (new Date()).toISOString(),
            });
            schedule.triggerQueueForProcessing("phil");
            */
        }
    }
}
