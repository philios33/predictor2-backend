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
import { getCodeVersionId, getEventSourceConfig, getSystemConfig } from "./config";
import { handleGracefulShutdownSignals } from "./shutdown";

const eventsSourceConfig = getEventSourceConfig();
const codeVersionId = getCodeVersionId();

const schedule = new MongoRedisTopicConsumer<ScheduleTopicMessage>(eventsSourceConfig.mongoUrl, eventsSourceConfig.databaseName, "schedule", eventsSourceConfig.redisHost, eventsSourceConfig.redisPort);

schedule.addDebuggingHandler((type: string, message: string) => {
    const now = new Date();
    console.log(now.toISOString() + " - Schedule - " + type + " - " + message);
});

const competition = new MongoRedisTopicConsumer<CompetitionTopicMessage>(eventsSourceConfig.mongoUrl, eventsSourceConfig.databaseName, "competition", eventsSourceConfig.redisHost, eventsSourceConfig.redisPort);

competition.addDebuggingHandler((type: string, message: string) => {
    const now = new Date();
    console.log(now.toISOString() + " - Competition - " + type + " - " + message);
});

const systemConfig = getSystemConfig();

const queuesClient = new ReliableRedisClient("Queues - Ingest", systemConfig.queuesRedisHost, systemConfig.queuesRedisPort);
const queues = new RedisQueuesController(queuesClient, codeVersionId);
const scheduler = new MongoQueueSchedule(codeVersionId, systemConfig.orchestratorMongoUrl);
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
                system.addCompetition(message.payload.meta.competitionId, message.payload.meta.tournamentId, message.payload.meta.name, message.payload.meta.adminPlayerId);
            } else {
                throw new Error("Cannot handle competition event type: " + message.payload.type);
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
                system.addTournament(message.payload.meta.tournamentId, message.payload.meta.name);
            } else {
                throw new Error("Cannot handle schedule event type: " + message.payload.type);
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
