import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management"
import { MessageHandler } from "../messageHandler"
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule"
import { getTournamentMatch, getTournamentMatchStageValue, setTournamentMatch, triggerTournamentScoresChanged, triggerTournamentStructureChanged } from "./tournamentLib"
import { IMessage } from "redis-state-management/dist/types"

export type TournamentMatchScoreMessagePayload = {
    tournamentId: string
    matchId: string

    score: {
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
    } | null
}


export interface TournamentMatchScoreMessage extends IMessage<"TOURNAMENT_MATCH_SCORE", TournamentMatchScoreMessagePayload> {};

export class TournamentMatchScoreMessageHandler extends MessageHandler<"TOURNAMENT_MATCH_SCORE", TournamentMatchScoreMessagePayload> {
    constructor() {
        super("TOURNAMENT_MATCH_SCORE");
    }
    async processMessage(message: TournamentMatchScoreMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        const tournamentId = message.meta.tournamentId;
        const matchId = message.meta.matchId;

        // We must lookup the stageId first so we can load the match 
        // Yes, this annoyingly requires 2 lookups, but is unavoidable with this structure
        const stageId = await getTournamentMatchStageValue(reader, tournamentId, matchId);
        if (stageId === null) {
            throw new Error("Unknown stage for this match id: " + matchId);
        }

        const match = await getTournamentMatch(reader, tournamentId, matchId, stageId);
        if (match === null) {
            throw new Error("Unknown match for this match id: " + matchId + " in stage " + stageId);
        }

        match.score = message.meta.score;

        await setTournamentMatch(writer, tournamentId, matchId, stageId, match);

        // No need for triggering a structure changed message, but we should recalculate any competition results
        await triggerTournamentScoresChanged(tournamentId, queues, schedule);
        
    }
}
        
