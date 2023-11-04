import { MessageProcessor } from "./messageProcessor";
import { MongoQueueSchedule } from "./schedules/mongoQueueSchedule";
import { loadMessageHandlers } from "./messageHandlersUtil";
import { System } from "./system";
import { RedisQueuesController, RedisStorageProcessor, RedisStorageStateReader, RedisStorageStateWriter, ReliableRedisClient } from "redis-state-management";

const codeVersionId = "1.0";
const redisHost = "localhost";
const redisPort = 6379;

// Note: These two will be replaced by the exported classes from redis-state-management
const rrc = new ReliableRedisClient("Baseliner queues", redisHost, redisPort);

const queues = new RedisQueuesController(rrc, codeVersionId);


const reader = new RedisStorageStateReader(rrc, "TEST");
const writer = new RedisStorageStateWriter(rrc, "TEST", "writerIncoming");
const stateProcessor = new RedisStorageProcessor(rrc, "TEST", "writerIncoming");

const processor = new MessageProcessor(queues, reader, writer);

loadMessageHandlers(processor);


const schedule = new MongoQueueSchedule("mongodb://localhost:27017/scheduler", codeVersionId);

const system = new System(queues, schedule);

(async () => {
    await rrc.start();
    // await stateProcessor.start();

    // Init data messages down queues
    await system.addTournament("PL2223", "Premier League 2022-23");
    await system.addTeam("PL2223", "ARS", "Arsenal", "ARS", "arsenal.jpg", ["PL"]);
    await system.addTeam("PL2223", "AST", "Aston Villa", "AST", "villa.jpg", ["PL"]);
    await system.addTeam("PL2223", "CHE", "Chelsea", "CHE", "chelsea.jpg", ["PL"]);
    await system.addTeam("PL2223", "MAC", "Manchester City", "MAC", "city.jpg", ["PL"]);
    await system.addMatch("PL2223", "Game Week 1", "ARSAST", "ARS", "AST", "2023-04-31T16:00:00Z", "PL", "MATCH_ON", null);
    await system.addMatch("PL2223", "Game Week 1", "CHEMAC", "CHE", "MAC", "2023-04-31T16:00:00Z", "PL", "MATCH_ON", null);
    await system.addPlayer("PHIL", "Phil", "phil@code67.com");
    await system.addCompetition("1234", "PL2223", "Phils League", "PHIL");
    await system.addPlayerCompeting("PHIL", "1234");
    await system.addPlayerMatchPrediction("PHIL", "PL2223", "ARSAST", {
        isBanker: true,
        score: {
            home: 0,
            away: 2,
        }
    });
    await system.addPlayerMatchPrediction("PHIL", "PL2223", "CHEMAC", {
        isBanker: false,
        score: {
            home: 1,
            away: 1,
        }
    });
    await system.addScore("PL2223", "ARSAST", 0, 2);

    
    await schedule.startup();
    processor.startProcessing(schedule);
    

})();

