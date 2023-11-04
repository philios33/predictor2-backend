
import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management"
import { MessageHandler } from "../messageHandler"
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule"
import { TournamentMatch, TournamentMatchWithTeams, TournamentPhase, TournamentPhasesState, TournamentTeam } from "../states/tournament"
import { getAllTournamentStageIds, getMatchesAtStage, getTeamsInTournament, getTournament, getTournamentPhasesStructure, setTournamentPhasesStructure } from "./tournamentLib"
import { IMessage } from "redis-state-management/dist/types"

export type TournamentStructureChangedPayload = {
    tournamentId: string
}


export interface TournamentStructureChangedMessage extends IMessage<"TOURNAMENT_STRUCTURE_CHANGED", TournamentStructureChangedPayload> {};

export class TournamentStructureChangedMessageHandler extends MessageHandler<"TOURNAMENT_STRUCTURE_CHANGED", TournamentStructureChangedPayload> {
    constructor() {
        super("TOURNAMENT_STRUCTURE_CHANGED");
    }
    async processMessage(message: TournamentStructureChangedMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        
        const tournamentId = message.meta.tournamentId;
        const requestedGenerationAt = new Date(message.occurredAt);
        const generationDate = new Date();

        // When the structure changes, we rebuild the tournament phases state
        const current = await getTournamentPhasesStructure(reader, tournamentId);
        if (current === null) {
            // Continue
        } else {
            const currentGenDate = new Date(current.generatedAt);
            if (requestedGenerationAt < currentGenDate) {
                // The current phases state was generated after this message arrived to trigger the phases recalculation
                // We can ignore this message.
                return;
            } else {
                // Continue
            }
        }

        // We need to do the actual recalculation
        await this.recalculateTournamentPhasesState(message.meta.tournamentId, generationDate, reader, writer, schedule, queues);
    }

    async recalculateTournamentPhasesState(tournamentId: string, generationDate: Date, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) {
        
        // Get all teams
        const teams = await getTeamsInTournament(reader, tournamentId);

        // Get all matches, sort all matches
        const tournament = await getTournament(reader, tournamentId);
        if (tournament === null) {
            throw new Error("Not found tournament: " + tournamentId + " while recalculating tournament phase structure");
        }

        const allMatches : Array<TournamentMatch> = [];
        const stageIds = await getAllTournamentStageIds(reader, tournamentId);
        for (const stageId of stageIds) {
            // These are in no particular order since the stage ids are a Set data structure
            const matches = await getMatchesAtStage(reader, tournamentId, stageId);
            allMatches.push(...matches);
        }

        // Order the matches by kickoff time
        allMatches.sort((match1, match2) => {
            return (new Date(match1.scheduledKickoff)).getTime() - (new Date(match2.scheduledKickoff)).getTime();
        });

        // Loop all matches while creating phases
        // Keep track of which phase starts each new stage id

        let phaseId = 1;
        let phaseMatches: Array<TournamentMatchWithTeams> = [];
        let teamIds: Array<string> = [];
        let calculatedPhases: Array<TournamentPhase> = [];
        let stageStartingInPhase: Record<string, number> = {}; // Keeps track of the first phaseId for each stageId

        const finaliseCurrentPhase = () => {
            if (phaseMatches.length > 0) {
                const includedStages = [];
                const startingStages = [];
                for (const match of phaseMatches) {
                    if (includedStages.indexOf(match.stageId) === -1) {
                        includedStages.push(match.stageId);
                        if (match.stageId in stageStartingInPhase) {
                            // Already started in a previous phase
                        } else {
                            startingStages.push(match.stageId);
                            stageStartingInPhase[match.stageId] = phaseId;
                        }
                    }
                }

                calculatedPhases.push({
                    phaseId: "Phase-" + phaseId,
                    numberOfMatches: phaseMatches.length,
                    earliestMatchKickoff: phaseMatches[0].scheduledKickoff,
                    lastMatchKickoff: phaseMatches[phaseMatches.length - 1].scheduledKickoff,
                    includedStages: includedStages,
                    startingStages: startingStages,
                    matches: phaseMatches,
                });

                phaseId++;
                phaseMatches = [];
                teamIds = [];
            }
        }

        for (const match of allMatches) {
            // Detect the break of a phase, or append the match to this phase
            // Is this next match on the same day or the day after the latest match? allow
            let startANewPhase = false;
            let latestMatch = null;
            if (phaseMatches.length > 0) {
                latestMatch = phaseMatches[phaseMatches.length - 1];
                const latestKO = new Date(latestMatch.scheduledKickoff).getTime();
                const nextKO = new Date(match.scheduledKickoff).getTime();
                const diffKO = nextKO - latestKO;
                // 33 hours is 24 hours + grace period of 9 hours incase the next match is a late kick off on the next day
                if (diffKO > 33 * 60 * 60 * 1000) {
                    // If we get to here though, we should stop the phase
                    startANewPhase = true;
                }
            }

            // Have these teams already played during this phase?
            if (teamIds.indexOf(match.homeTeamId) !== -1 || teamIds.indexOf(match.awayTeamId) !== -1) {
                // Yes, start a new phase
                startANewPhase = true;
            }
            if (startANewPhase) {
                finaliseCurrentPhase();
            }
            phaseMatches.push({
                homeTeamId: match.homeTeamId,
                homeTeam: teams[match.homeTeamId],
                awayTeamId: match.awayTeamId,
                awayTeam: teams[match.awayTeamId],
                scheduledKickoff: match.scheduledKickoff,
                matchId: match.matchId,
                stageId: match.stageId,
                groupId: match.groupId,
                status: match.status,
                statusMessage: match.statusMessage,
                knownBankerMultiplier: match.knownBankerMultiplier,
                score: match.score,
            });
            teamIds.push(match.homeTeamId);
            teamIds.push(match.awayTeamId);
        }
        finaliseCurrentPhase();

        // Work out teams map by the groups they are in
        const groupTeams: Record<string, Record<string, TournamentTeam>> = {};
        const allTeams = await getTeamsInTournament(reader, tournamentId);
        for (const teamId in allTeams) {
            const team = allTeams[teamId];
            for (const groupId of team.groups) {
                if (!(groupId in groupTeams)) {
                    groupTeams[groupId] = {};
                }
                groupTeams[groupId][team.teamId] = team;
            }
        }

        const calculated: TournamentPhasesState = {
            generatedAt: generationDate.toISOString(),
            phases: calculatedPhases,
            groupTeams,
        }

        await setTournamentPhasesStructure(writer, tournamentId, calculated, queues, schedule);
        

    }
}
