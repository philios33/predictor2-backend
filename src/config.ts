import 'dotenv/config';

function obtainEnvVar(name: string) : string {
    if (name in process.env && typeof process.env[name] === "string") {
        return process.env[name] as string;
    } else {
        throw new Error("Missing env var: " + name);
    }
}

export type EventSourceConfig = {
    mongoUrl: string
    databaseName: string
    redisHost: string
    redisPort: number
}

export function getEventSourceConfig() : EventSourceConfig {
    return {
        mongoUrl: obtainEnvVar("EVENT_SOURCE_MONGO_URL"),
        databaseName: obtainEnvVar("EVENT_SOURCE_DATABASE_NAME"),
        redisHost: obtainEnvVar("EVENT_SOURCE_REDIS_HOST"),
        redisPort: parseInt(obtainEnvVar("EVENT_SOURCE_REDIS_PORT")),
    }
}

export type RedisStateConfig = {
    redisHost: string
    redisPort: number
    namespace: string
    incomingQueueId: string
}

export function getRedisStateConfig() : RedisStateConfig {
    return {
        redisHost: obtainEnvVar("REDIS_STATE_REDIS_HOST"),
        redisPort: parseInt(obtainEnvVar("REDIS_STATE_REDIS_PORT")),
        namespace: obtainEnvVar("REDIS_STATE_NAMESPACE"),
        incomingQueueId: obtainEnvVar("REDIS_STATE_INCOMING_QUEUE"),
    }
}

export type SystemConfig = {
    orchestratorMongoUrl: string
    queuesRedisHost: string
    queuesRedisPort: number
    queuesNamespace: string
    codeVersionId: string
}

export function getSystemConfig() : SystemConfig {
    return {
        orchestratorMongoUrl: obtainEnvVar("SYSTEM_ORCHESTRATION_MONGO_URL"),
        queuesRedisHost: obtainEnvVar("SYSTEM_QUEUES_REDIS_HOST"),
        queuesRedisPort: parseInt(obtainEnvVar("SYSTEM_QUEUES_REDIS_PORT")),
        queuesNamespace: obtainEnvVar("SYSTEM_QUEUES_NAMESPACE"),
        codeVersionId: obtainEnvVar("SYSTEM_CODE_VERSION_ID"),
    }
}

export type ServiceConfig = {
    listenPort: number
}

export function getServiceConfig() : ServiceConfig {
    return {
        listenPort: parseInt(obtainEnvVar("SERVICE_LISTEN_PORT")),
    }
}
