import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";
import { QueueProcessingSchedule } from "./schedules/queueProcessingSchedule";
import { IMessage } from "redis-state-management/dist/types";

export abstract class MessageHandler<T,M> {

    messageType: T;
    constructor(messageType: T) {
        this.messageType = messageType;
    }

    getMessageType() : T {
        return this.messageType;
    }

    abstract processMessage(message: IMessage<T,M>, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void>
}

