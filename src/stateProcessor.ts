// This is the singleton stateProcessor which needs to run to write outgoing redis events

import { RedisStorageProcessor, ReliableRedisClient } from "redis-state-management";
import { getRedisStateConfig } from "./config";
import { handleGracefulShutdownSignals } from "./shutdown";

const redisStateConfig = getRedisStateConfig();

const rrc = new ReliableRedisClient("State Events Processor", redisStateConfig.redisHost, redisStateConfig.redisPort);
const stateProcessor = new RedisStorageProcessor(rrc, redisStateConfig.namespace, redisStateConfig.incomingQueueId);

(async () => {
    try {
        await rrc.start();
        await stateProcessor.start();
        console.log("Started up state processor successfully");
    } catch(e: any) {
        console.error(e);
        process.exit(1);
    }
})();

handleGracefulShutdownSignals(async () => {
    await stateProcessor.stop();
});

