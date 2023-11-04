import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management"
import { MessageHandler } from "../messageHandler"
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule"
import { TournamentMatch } from "../states/tournament"
import { delTournamentMatch, ensureStageIdInTournamentState, ensureStageIdNotInTournamentState, getNumberOfMatchesAtStage, getTournamentMatch, getTournamentMatchStageValue, setTournamentMatch, setTournamentMatchStageValue, triggerTournamentStructureChanged } from "./tournamentLib"
import { IMessage } from "redis-state-management/dist/types"

export type TournamentMatchScheduledMessagePayload = {
    tournamentId: string
    stageId: string
    matchId: string

    homeTeamId: string
    awayTeamId: string

    scheduledKickoff: string
    groupId: string
    status:  "MATCH_ON" | "MATCH_POSTPONED" | "MATCH_ABANDONED" | "MATCH_CANCELLED" | "MATCH_DELETED"
    statusMessage: string | null
}


export interface TournamentMatchScheduledMessage extends IMessage<"TOURNAMENT_MATCH_SCHEDULED", TournamentMatchScheduledMessagePayload> {};

export class TournamentMatchScheduledMessageHandler extends MessageHandler<"TOURNAMENT_MATCH_SCHEDULED", TournamentMatchScheduledMessagePayload> {
    constructor() {
        super("TOURNAMENT_MATCH_SCHEDULED");
    }
    async processMessage(message: TournamentMatchScheduledMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        // Just add/update this match state and append to the hashmap of match stages for this tournament

        const tournamentId = message.meta.tournamentId;
        const matchId = message.meta.matchId;
        const stageId = message.meta.stageId;

        // Note: No need to load tournament state anymore
        const currentStage = await getTournamentMatchStageValue(reader, tournamentId, matchId);

        // Have we heard about this match?
        if (currentStage !== null) {
            // Yes, we expect it to be stored at this stage

            const match = await getTournamentMatch(reader, tournamentId, matchId, currentStage);
            if (match === null) {
                throw new Error("Not found match but stage existed, fix bug");
            }

            if (currentStage !== stageId) {
                // The stage IS changing, remove the match from the old stage first
                await delTournamentMatch(writer, tournamentId, matchId, currentStage);

                // If this is the last match removed from the map, we should remove the stageId reference in the tournament
                const matchesCountInOldStage = await getNumberOfMatchesAtStage(reader, tournamentId, currentStage);
                if (matchesCountInOldStage === 0) {
                    await ensureStageIdNotInTournamentState(writer, tournamentId, currentStage);
                }
            }

            // Update the existing match and save
            this.updateExistingMatch(match, message);
            await setTournamentMatch(writer, tournamentId, matchId, stageId, match);
            
        } else {
            // No, it doesnt exist yet, just set it now on this stage
            // Match and stage both unknown, add it now
            const match: TournamentMatch = {
                matchId: message.meta.matchId,

                homeTeamId: message.meta.homeTeamId,
                awayTeamId: message.meta.awayTeamId,
                groupId: message.meta.groupId,
                stageId: message.meta.stageId,
                scheduledKickoff: message.meta.scheduledKickoff,
                status: message.meta.status,
                statusMessage: message.meta.statusMessage,

                score: null,
                knownBankerMultiplier: null
            };
            await setTournamentMatch(writer, tournamentId, matchId, stageId, match);
            // Also keep track of the stage value in another hashmap
            await setTournamentMatchStageValue(writer, tournamentId, matchId, stageId);
        }

        // Ensure that stageId exists within the tournament state
        await ensureStageIdInTournamentState(writer, tournamentId, stageId);

        await triggerTournamentStructureChanged(tournamentId, queues, schedule);
    }

    updateExistingMatch(match: TournamentMatch, message: TournamentMatchScheduledMessage) {
        match.homeTeamId = message.meta.homeTeamId;
        match.awayTeamId = message.meta.awayTeamId;
        match.groupId = message.meta.groupId;
        match.stageId = message.meta.stageId;
        match.scheduledKickoff = message.meta.scheduledKickoff;
        match.status = message.meta.status;
        match.statusMessage = message.meta.statusMessage;

        // Leave the score alone
    }
}
        
