// This is the scalable system processor that processes all the events

import { v4 as uuidv4 } from 'uuid';
import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter, ReliableRedisClient } from 'redis-state-management';
import { MessageProcessor } from './processors/messageProcessor';
import { loadMessageHandlers } from './processors/messageHandlersUtil';
import { MongoQueueSchedule } from './processors/schedules/mongoQueueSchedule';
import { getRedisStateConfig, getSystemConfig } from './config';

const systemConfig = getSystemConfig();
const stateConfig = getRedisStateConfig();
const instanceId = uuidv4();

const queuesClient = new ReliableRedisClient("Queues - Processor " + instanceId, systemConfig.queuesRedisHost, systemConfig.queuesRedisPort);
const queues = new RedisQueuesController(queuesClient, systemConfig.queuesNamespace);

const storageClient = new ReliableRedisClient("Storage - Processor " + instanceId, stateConfig.redisHost, stateConfig.redisPort);

const reader = new RedisStorageStateReader(storageClient, stateConfig.namespace);
const writer = new RedisStorageStateWriter(storageClient, stateConfig.namespace, stateConfig.incomingQueueId);

const processor = new MessageProcessor(queues, reader, writer);

loadMessageHandlers(processor);

const scheduler = new MongoQueueSchedule(systemConfig.orchestratorMongoUrl, systemConfig.codeVersionId);

(async () => {
    try {
        await queuesClient.start();
        await storageClient.start();
        
        await scheduler.startup();
        processor.startProcessing(scheduler);
        console.log("Started up events processor: " + instanceId);
    } catch(e: any) {
        console.error(e);
        process.exit(1);
    }
})();

// Note: We have proper exit signal handlers setup in processor.startProcessing for this process
