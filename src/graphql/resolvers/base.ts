import { IResolvers } from "@graphql-tools/utils";
import { GraphQLContext } from "../express";
import { MutationAddTournamentArgs, MutationClearMatchScoreArgs, MutationClearUserPredictionArgs, MutationSetMatchScoreArgs, MutationSetScheduledMatchArgs, MutationSetUserPredictionArgs } from "../generated";
import { MutationAddTeamArgs } from "../generated";
import { MutationAddPlayerArgs } from "../generated";
import { MutationAddCompetitionArgs } from "../generated";
import { MutationAddPlayerCompetingArgs } from "../generated";

export const BaseResolver: IResolvers = {
    Query: {
        hello(_obj, args: any, context: GraphQLContext): any {
            // console.log("Context", context);
            return "Hi";
        }
    },
    Mutation: {
        async addTournament(_obj, args: MutationAddTournamentArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "TOURNAMENT_" + args.data.tournamentId;
            const now = new Date().toISOString();
            await context.scheduleTopic.pushMessageToTopic({
                type: "TOURNAMENT",
                meta: {
                    ...args.data
                },
                occurredAt: now,
            }, logCompactId);
        },
        async addTeam(_obj, args: MutationAddTeamArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "TOURNAMENT_TEAM_" + args.data.tournamentId + "_" + args.data.teamId;
            const now = new Date().toISOString();
            await context.scheduleTopic.pushMessageToTopic({
                type: "TOURNAMENT_TEAM",
                meta: {
                    ...args.data
                },
                occurredAt: now,
            }, logCompactId);
        },
        async addPlayer(_obj, args: MutationAddPlayerArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "PLAYER_" + args.data.playerId;
            const now = new Date().toISOString();
            await context.competitionTopic.pushMessageToTopic({
                type: "PLAYER",
                meta: {
                    ...args.data
                },
                occurredAt: now,
            }, logCompactId);
        },
        async addCompetition(_obj, args: MutationAddCompetitionArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "COMPETITION_" + args.data.competitionId;
            const now = new Date().toISOString();
            await context.competitionTopic.pushMessageToTopic({
                type: "COMPETITION",
                meta: {
                    ...args.data
                },
                occurredAt: now,
            }, logCompactId);
        },
        async addPlayerCompeting(_obj, args: MutationAddPlayerCompetingArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "PLAYER_COMPETING_" + args.data.playerId + "_" + args.data.competitionId;
            const now = new Date().toISOString();
            await context.competitionTopic.pushMessageToTopic({
                type: "PLAYER_COMPETING",
                meta: {
                    ...args.data
                },
                occurredAt: now,
            }, logCompactId);
        },
        
        async setMatchScore(_obj, args: MutationSetMatchScoreArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "SCORE_" + args.data.tournamentId + "_" + args.data.matchId;
            const now = new Date().toISOString();
            await context.scheduleTopic.pushMessageToTopic({
                type: "TOURNAMENT_MATCH_SCORE",
                meta: {
                    matchId: args.data.matchId,
                    tournamentId: args.data.tournamentId,
                    score: {
                        homeGoals: args.data.homeGoals,
                        awayGoals: args.data.awayGoals,
                        isFinalScore: args.data.isFinalScore,
                        gameMinute: args.data.gameMinute || null,
                        // extraTime: {},
                    }
                },
                occurredAt: now,
            }, logCompactId);
        },
        
        async clearMatchScore(_obj, args: MutationClearMatchScoreArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "SCORE_" + args.data.tournamentId + "_" + args.data.matchId;
            const now = new Date().toISOString();
            await context.scheduleTopic.pushMessageToTopic({
                type: "TOURNAMENT_MATCH_SCORE",
                meta: {
                    matchId: args.data.matchId,
                    tournamentId: args.data.tournamentId,
                    score: null
                },
                occurredAt: now
            }, logCompactId);
        },
        
        async setScheduledMatch(_obj, args: MutationSetScheduledMatchArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "MATCH_" + args.data.tournamentId + "_" + args.data.matchId;
            const now = new Date().toISOString();
            await context.scheduleTopic.pushMessageToTopic({
                type: "TOURNAMENT_MATCH_SCHEDULED",
                meta: {
                    tournamentId: args.data.tournamentId,
                    matchId: args.data.matchId,
                    homeTeamId: args.data.homeTeamId,
                    awayTeamId: args.data.awayTeamId,
                    groupId: args.data.groupId,
                    stageId: args.data.stageId,
                    scheduledKickoff: args.data.scheduledKickoff,
                    status: args.data.status,
                    statusMessage: args.data.statusMessage || null
                },
                occurredAt: now,
            }, logCompactId);
        },
        async setUserPrediction(_obj, args: MutationSetUserPredictionArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "PREDICTION_" + args.data.tournamentId + "_" + args.data.matchId + "_" + args.data.playerId;
            const now = new Date().toISOString();
            await context.competitionTopic.pushMessageToTopic({
                type: "PLAYER_PREDICTION",
                meta: {
                    tournamentId: args.data.tournamentId,
                    matchId: args.data.matchId,
                    playerId: args.data.playerId,
                    prediction: {
                        score: {
                            home: args.data.homeGoals,
                            away: args.data.awayGoals,
                        },
                        isBanker: args.data.isBanker,
                    }
                },
                occurredAt: now,
            }, logCompactId);
        },
        async clearUserPrediction(_obj, args: MutationClearUserPredictionArgs, context: GraphQLContext): Promise<void> {
            // TODO Validate input, user and auth
            const logCompactId = "PREDICTION_" + args.data.tournamentId + "_" + args.data.matchId + "_" + args.data.playerId;
            const now = new Date().toISOString();
            await context.competitionTopic.pushMessageToTopic({
                type: "PLAYER_PREDICTION",
                meta: {
                    tournamentId: args.data.tournamentId,
                    matchId: args.data.matchId,
                    playerId: args.data.playerId,
                    prediction: null,
                },
                occurredAt: now,
            }, logCompactId);
        }

    }
};