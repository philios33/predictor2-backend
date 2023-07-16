import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management"
import { MessageHandler } from "../messageHandler"
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule"
import { TournamentTeam } from "../states/tournament"
import { getTournamentTeam, setTournamentTeam, triggerTournamentStructureChanged } from "./tournamentLib"
import { IMessage } from "redis-state-management/dist/types"

export type TournamentTeamMessagePayload = {
    tournamentId: string
    teamId: string
    name: string
    shortName: string // Unique 3 letter country code, or team code
    logo48: string // Some reference to some known logo asset that is 48px wide
    groups: Array<string> // List of all relevant group codes that this team participates in this tournament
                            // E.g. Could be just ["PL"] or ["Group A", "Last 16", "Quarter Finals"]
}


export interface TournamentTeamMessage extends IMessage<"TOURNAMENT_TEAM", TournamentTeamMessagePayload> {};

export class TournamentTeamMessageHandler extends MessageHandler<"TOURNAMENT_TEAM", TournamentTeamMessagePayload> {
    constructor() {
        super("TOURNAMENT_TEAM");
    }
    async processMessage(message: TournamentTeamMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        // Just add/update the team to the tournament state
        const tournamentId = message.meta.tournamentId;
        const teamId = message.meta.teamId;

        const current = await getTournamentTeam(reader, tournamentId, teamId);
        if (current === null) {
            // Create
            const team: TournamentTeam = {
                teamId: message.meta.teamId,
                name: message.meta.name,
                shortName: message.meta.shortName,
                logo48: message.meta.logo48,
                groups: message.meta.groups,
            }
            await setTournamentTeam(writer, tournamentId, teamId, team);
        } else {
            // Very rare scenario
            current.shortName = message.meta.shortName;
            current.name = message.meta.name;
            current.logo48 = message.meta.logo48;
            current.groups = message.meta.groups;
            await setTournamentTeam(writer, tournamentId, teamId, current);

            // Adding a new team will not change anything really, but updating a team name might, so...
            await triggerTournamentStructureChanged(message.meta.tournamentId, queues, schedule);
        }
    }
}
        
