import { IResolvers } from "@graphql-tools/utils";
import { GraphQLContext } from "../express";
import { MutationClearMatchScoreArgs, MutationClearUserPredictionArgs, MutationSetMatchScoreArgs, MutationSetScheduledMatchArgs, MutationSetUserPredictionArgs } from "../generated";

export const BaseResolver: IResolvers = {
    Query: {
        hello(_obj, args: any, context: GraphQLContext): any {
            // console.log("Context", context);
            return "Hi";
        }
    },
    Mutation: {
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