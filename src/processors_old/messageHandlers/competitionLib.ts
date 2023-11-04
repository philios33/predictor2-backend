import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule";
import { CompetitionState } from "../states/competition";

export async function setCompetition(writer: RedisStorageStateWriter, competitionId: string, competition: CompetitionState) {
    const mapId = "COMPETITIONS";
    await writer.setHashmapValue<CompetitionState>(mapId, competitionId, competition);
}
export async function getCompetition(reader: RedisStorageStateReader, competitionId: string) {
    const mapId = "COMPETITIONS";
    return await reader.getHashmapValue<CompetitionState>(mapId, competitionId);
}


export async function triggerRebuildCompetitionResults(competitionId: string, queues: RedisQueuesController, schedule: QueueProcessingSchedule) {
    // For this competition, add a rebuild competition message
    const queueName = "COMPETITION-" + competitionId + "-REBUILD-RESULTS";
    await queues.pushMessage(queueName, {
        occurredAt: (new Date()).toISOString(),
        type: "COMPETITION_REBUILD_RESULTS",
        meta: {
            competitionId: competitionId,
        }
    });
    await schedule.triggerQueueForProcessing(queueName);
}

