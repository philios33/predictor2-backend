import { RedisQueuesController } from "redis-state-management";
import { IncomingPlayerPrediction } from "./messageHandlers/playerPrediction";
import { QueueProcessingSchedule } from "./schedules/queueProcessingSchedule";

export class System {
    queues: RedisQueuesController;
    schedule: QueueProcessingSchedule;

    constructor(queues: RedisQueuesController, schedule: QueueProcessingSchedule) {
        this.queues = queues;
        this.schedule = schedule;
    }

    async addTournament(tournamentId: string, name: string) {
        const now = new Date();
        const queueId = "tournament_" + tournamentId;
        await this.queues.pushMessage(queueId, {
            type: "TOURNAMENT",
            meta: {
                tournamentId,
                name,
            },
            occurredAt: now.toISOString(),
        });
        await this.schedule.triggerQueueForProcessing(queueId);
    }

    async addTeam(tournamentId: string, teamId: string, name: string, shortName: string, logo48: string, groups: Array<string>) {
        const now = new Date();
        const queueId = "tournament_" + tournamentId;
        await this.queues.pushMessage(queueId, {
            type: "TOURNAMENT_TEAM",
            meta: {
                tournamentId,
                teamId,
                name,
                shortName,
                logo48,
                groups,
            },
            occurredAt: now.toISOString(),
        });
        await this.schedule.triggerQueueForProcessing(queueId);
    }

    async addMatch(tournamentId: string, stageId: string, matchId: string, 
        homeTeamId: string, awayTeamId: string, scheduledKickoff: string, groupId: string, 
        status:  "MATCH_ON" | "MATCH_POSTPONED" | "MATCH_ABANDONED" | "MATCH_CANCELLED" | "MATCH_DELETED",
        statusMessage: string | null) {

        const now = new Date();
        const queueId = "tournament_" + tournamentId;
        await this.queues.pushMessage(queueId, {
            type: "TOURNAMENT_MATCH_SCHEDULED",
            meta: {
                tournamentId,
                stageId,
                matchId,
                homeTeamId,
                awayTeamId,
                scheduledKickoff,
                groupId,
                status,
                statusMessage,
            },
            occurredAt: now.toISOString(),
        });
        await this.schedule.triggerQueueForProcessing(queueId);
    }

    async addScore(tournamentId: string, matchId: string, homeGoals: number, awayGoals: number) {
        const now = new Date();
        const queueId = "tournament_" + tournamentId;
        await this.queues.pushMessage(queueId, {
            type: "TOURNAMENT_MATCH_SCORE",
            meta: {
                tournamentId,
                matchId,
                homeGoals,
                awayGoals,
                isFinalScore: true,
                gameMinute: null,
            },
            occurredAt: now.toISOString(),
        });
        await this.schedule.triggerQueueForProcessing(queueId);
    }

    async addCompetition(competitionId: string, tournamentId: string, name: string, adminPlayerId: string) {
        const now = new Date();
        const queueId = "competition_" + competitionId;
        await this.queues.pushMessage(queueId, {
            type: "COMPETITION",
            meta: {
                competitionId,
                tournamentId,
                name,
                adminPlayerId,
            },
            occurredAt: now.toISOString(),
        });
        await this.schedule.triggerQueueForProcessing(queueId);
    }

    async addPlayer(playerId: string, name: string, email: string) {
        const now = new Date();
        const queueId = "main";
        await this.queues.pushMessage(queueId, {
            type: "PLAYER",
            meta: {
                playerId,
                name,
                email,
            },
            occurredAt: now.toISOString(),
        });
        await this.schedule.triggerQueueForProcessing(queueId);
    }

    async addPlayerCompeting(playerId: string, competitionId: string) {
        const now = new Date();
        const queueId = "competition_" + competitionId;
        await this.queues.pushMessage(queueId, {
            type: "PLAYER_COMPETING",
            meta: {
                playerId,
                competitionId,
            },
            occurredAt: now.toISOString(),
        });
        await this.schedule.triggerQueueForProcessing(queueId);
    }

    async addPlayerMatchPrediction(playerId: string, tournamentId: string, matchId: string, prediction: null | IncomingPlayerPrediction) {
        const now = new Date();
        const queueId = "tournament_" + tournamentId;
        await this.queues.pushMessage(queueId, {
            type: "PLAYER_PREDICTION",
            meta: {
                playerId,
                tournamentId,
                matchId,
                prediction,
            },
            occurredAt: now.toISOString(),
        });
        await this.schedule.triggerQueueForProcessing(queueId);
    }
}