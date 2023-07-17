// This is the ingest process that consumes all events from the event sourcing 
// storage engine and puts them in the queues system for processing.
// It should really keep track of where it has got to so that it is recoverable in the case of a crash.
// Right now the ingester will just start from the beginning, and use a normal consumer.
// The consumer should keep track of progress and support cases where the connection to mongo or redis goes down.
// This means the process should never die and runs forever.

import { MongoRedisTopicConsumer } from "streamable-topic";
import { ScheduleTopicMessage } from "./topics/schedule";
import { CompetitionTopicMessage } from "./topics/competition";
import { RedisQueuesController, ReliableRedisClient } from "redis-state-management";
import { MongoQueueSchedule } from "./processors/schedules/mongoQueueSchedule";
import { System } from "./processors/system";
import { getEventSourceConfig, getSystemConfig } from "./config";
import { handleGracefulShutdownSignals } from "./shutdown";

const eventsSourceConfig = getEventSourceConfig();

const schedule = new MongoRedisTopicConsumer<ScheduleTopicMessage>(eventsSourceConfig.mongoUrl, eventsSourceConfig.databaseName, "schedule", eventsSourceConfig.redisHost, eventsSourceConfig.redisPort);

schedule.addDebuggingHandler((type: string, message: string) => {
    const now = new Date();
    console.log(now.toISOString() + " - Schedule - " + type + " - " + message);
});

const competition = new MongoRedisTopicConsumer<CompetitionTopicMessage>(eventsSourceConfig.mongoUrl, eventsSourceConfig.databaseName, "competitions", eventsSourceConfig.redisHost, eventsSourceConfig.redisPort);

competition.addDebuggingHandler((type: string, message: string) => {
    const now = new Date();
    console.log(now.toISOString() + " - Competition - " + type + " - " + message);
});

const systemConfig = getSystemConfig();

const queuesClient = new ReliableRedisClient("Queues - Ingest", systemConfig.queuesRedisHost, systemConfig.queuesRedisPort);
const queues = new RedisQueuesController(queuesClient, systemConfig.queuesNamespace);
const scheduler = new MongoQueueSchedule(systemConfig.orchestratorMongoUrl, systemConfig.codeVersionId);
const system = new System(queues, scheduler);

(async () => {
    try {
        await competition.start();
        await schedule.start();

        await queuesClient.start();
        await scheduler.startup();

        competition.streamMessagesFrom(async (message) => {
            console.log("Found competition message: " + message.id);
            if (message.payload.type === "COMPETITION") {
                await system.addCompetition(message.payload.meta.competitionId, message.payload.meta.tournamentId, message.payload.meta.name, message.payload.meta.adminPlayerId);
            } else if (message.payload.type === "PLAYER") {
                await system.addPlayer(message.payload.meta.playerId, message.payload.meta.name, message.payload.meta.email);
            } else if (message.payload.type === "PLAYER_COMPETING") {
                await system.addPlayerCompeting(message.payload.meta.playerId, message.payload.meta.competitionId);
            } else if (message.payload.type === "PLAYER_PREDICTION") {
                await  system.addPlayerMatchPrediction(message.payload.meta.playerId, message.payload.meta.tournamentId, message.payload.meta.matchId, message.payload.meta.prediction);            
            } else {
                throw new Error("Cannot handle competition event type: " + (message.payload as any).type);
            }
        }, null, () => {
            console.log("No more competition messages...");
        }, () => {
            console.error("Crashed competition consumer");
            process.exit(1);
        });

        schedule.streamMessagesFrom(async (message) => {
            console.log("Found schedule message: " + message.id);
            if (message.payload.type === "TOURNAMENT") {
                await system.addTournament(message.payload.meta.tournamentId, message.payload.meta.name);
            } else if (message.payload.type === "TOURNAMENT_TEAM") {
                await system.addTeam(message.payload.meta.tournamentId, message.payload.meta.teamId, message.payload.meta.name, message.payload.meta.shortName, message.payload.meta.logo48, message.payload.meta.groups);
            } else if (message.payload.type === "TOURNAMENT_MATCH_SCHEDULED") {
                await system.addMatch(message.payload.meta.tournamentId, message.payload.meta.stageId, message.payload.meta.matchId, message.payload.meta.homeTeamId, message.payload.meta.awayTeamId, message.payload.meta.scheduledKickoff, message.payload.meta.groupId, message.payload.meta.status, message.payload.meta.statusMessage);
            } else if (message.payload.type === "TOURNAMENT_MATCH_SCORE") {
                // TODO fix this
                if (message.payload.meta.score) {
                    await system.addScore(message.payload.meta.tournamentId, message.payload.meta.matchId, message.payload.meta.score.homeGoals, message.payload.meta.score.awayGoals);
                }
            } else {
                throw new Error("Cannot handle schedule event type: " + (message.payload as any).type);
            }
        }, null, () => {
            console.log("No more schedule messages...");
        }, () => {
            console.error("Crashed schedule consumer");
            process.exit(1);
        });

        console.log("Started up ingest successfully");
    } catch(e: any) {
        console.error(e);
        process.exit(1);
    }
})();

handleGracefulShutdownSignals(async () => {
    await competition.stop();
    await schedule.stop();
    queuesClient.stop();
});
