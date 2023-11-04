// Anything to do with competition messages.

import { MessageHandler } from "../messageHandler"
import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule";
import { CompetitionState } from "../states/competition";
import { getCompetition, setCompetition } from "./competitionLib";
import { ensureTournamentCompetitionId } from "./tournamentLib";
import { IMessage } from "redis-state-management/dist/types";

export type CompetitionMessagePayload = {
    competitionId: string
    tournamentId: string
    name: string
    adminPlayerId: string
}


export interface CompetitionMessage extends IMessage<"COMPETITION", CompetitionMessagePayload> {};

export class CompetitionMessageHandler extends MessageHandler<"COMPETITION", CompetitionMessagePayload> {
    constructor() {
        super("COMPETITION");
    }
    async processMessage(message: CompetitionMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        console.log("Handling competition message: ID " + message.meta.competitionId + " is called " + message.meta.name + " queued at " + message.occurredAt + "...");

        const current = await getCompetition(reader, message.meta.competitionId);
        if (current === null) {
            const competition: CompetitionState = {
                competitionId: message.meta.competitionId,
                tournamentId: message.meta.tournamentId,
                name: message.meta.name,
                createdAt: message.occurredAt,
                adminPlayerId: message.meta.adminPlayerId,
            }
            await setCompetition(writer, message.meta.competitionId, competition);

            await ensureTournamentCompetitionId(writer, message.meta.tournamentId, message.meta.competitionId);

            console.log("Competition created", competition);

        } else {
            console.warn("TODO: Not able to alter competition once created");
            return;
        }
    }
}
