
import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management"
import { MessageHandler } from "../messageHandler"
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule"
import { HomeAwayPoints, LeagueTableSnapshot, Penalty, TournamentTablesState } from "../states/tables"
import { TournamentPhasesState, TournamentTeam } from "../states/tournament"
import { applyTeamStats, calculateLeagueTable } from "./tablesLib"
import { getTournamentMatch, getTournamentPhasesStructure, getTournamentTables, setTournamentTables } from "./tournamentLib"
import { IMessage } from "redis-state-management/dist/types"

export type TournamentRebuildTablesPayload = {
    tournamentId: string
}

export type TeamPointsRow = {
    team: TournamentTeam
    rank: null | number
    home: HomeAwayPoints
    away: HomeAwayPoints
    penalties: Array<Penalty>
}

export interface TournamentRebuildTablesMessage extends IMessage<"TOURNAMENT_REBUILD_TABLES", TournamentRebuildTablesPayload> {};

export class TournamentRebuildTablesMessageHandler extends MessageHandler<"TOURNAMENT_REBUILD_TABLES", TournamentRebuildTablesPayload> {
    constructor() {
        super("TOURNAMENT_REBUILD_TABLES");
    }
    async processMessage(message: TournamentRebuildTablesMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        
        const tournamentId = message.meta.tournamentId;
        const requestedGenerationAt = new Date(message.occurredAt);
        const generationDate = new Date();

        // We need to work out the tables for this tournament
        // This includes:
        // STAGE Snapshots of the league tables (at the start of each stage)
        // LATEST (Current tables)

        // When the structure changes, we rebuild the tournament phases state
        const structure = await getTournamentPhasesStructure(reader, tournamentId);
        if (structure === null) {
            // No phases structure yet, ignore the rebuild.
            console.warn("Not doing rebuild of tournament tables, missing phases: " + tournamentId);
            return;
        } else {

            // Get current tables
            const current = await getTournamentTables(reader, tournamentId);
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

            // We need to do the actual recalculation of tables
            await this.recalculateTournamentTables(tournamentId, generationDate, structure, reader, writer, schedule, queues);
        }
    }

    async recalculateTournamentTables(tournamentId: string, generationDate: Date, structure: TournamentPhasesState, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) {
        
        // console.log("GROUP TEAMS for " + tournamentId, JSON.stringify(tournament.groupTeams, null, 4));
        // First go through all matches scheduled in this tournament and determine the kick off date of the first match of each game week stage.
        // This is to calculate the banker
        // Note: Due to possible game week collissions, we consider the table at midnight on the day the stage starts

        const stageKickoffs: Record<string, Date> = {};
        for (const phase of structure.phases) {
            for (const match of phase.matches) {
                // Note: Phases and matches must be given in kick off order here, dumping to console to check this
                console.log(match.homeTeam.name + " vs " + match.awayTeam.name + " at " + match.scheduledKickoff + " in stage " + match.stageId);
                if (!(match.stageId in stageKickoffs)) {
                    // It's the first match of this stage
                    // TODO: Convert to midnight on this day
                    stageKickoffs[match.stageId] = new Date(match.scheduledKickoff.substring(0, 10) + "T00:00:00Z");
                }
            }
        }

        // console.log("stageKickoffs", JSON.stringify(stageKickoffs, null, 4));
        // Now go through each match again calculating the tables

        // When we hit the kick off date of a new stage, we take a snapshot of the group/league tables at midnight (the start of the day).
        // This is to guarantee that we know the banker multiplier on the day of the match due to the edge cases that can occur with colliding game week matches.
        // If we hit a match that doesn't have a final score yet, we should continue working out current tables, but without setting anymore snapshots.

        // Note: We need to calculate ALL the tables based on the group id string

        const cumGroupTeamPoints: Record<string, Record<string, TeamPointsRow>> = {}; // Keeps track of all of the group matches while making snapshots
        let previousMatchesOngoing = false;
        const stageGroupLeagueTables: Record<string, Record<string, LeagueTableSnapshot>> = {}; // This one is used to calculate the banker multipliers at the start of a stage
        const phaseGroupLeagueTables: Record<string, Record<string, LeagueTableSnapshot>> = {}; // Not really sure the point of this one.

        for (const phase of structure.phases) {

            // It's the start of a phase, calculate league table at start of phase
            // Can't remember what this is for, but could be useful to show
            for (const groupId in cumGroupTeamPoints) {
                const cumTeamPoints = cumGroupTeamPoints[groupId];
                if (!(phase.phaseId in phaseGroupLeagueTables)) {
                    phaseGroupLeagueTables[phase.phaseId] = {};
                }
                // We really need the first match kick off so we can say when the snapshot is for
                const firstMatchKickoff = phase.matches[0].scheduledKickoff;

                phaseGroupLeagueTables[phase.phaseId][groupId] = calculateLeagueTable(cumTeamPoints, structure.groupTeams[groupId], new Date(firstMatchKickoff), "Start of phase " + phase.phaseId);
            }

            for (const match of phase.matches) {
            
                const matchScheduledKickoff = new Date(match.scheduledKickoff);
                if (!(match.groupId in cumGroupTeamPoints)) {
                    cumGroupTeamPoints[match.groupId] = {};
                }
                const cumTeamPoints = cumGroupTeamPoints[match.groupId];

                console.log(match.homeTeam.name + " vs " + match.awayTeam.name);
                // Is this kick off time past any of the stage kickoff times
                if (!previousMatchesOngoing) {
                    // console.log("No previous matches ongoing, checking for snapshot criteria");
                    for (const stageId in stageKickoffs) {
                        const scheduled = stageKickoffs[stageId];
                        if (scheduled <= matchScheduledKickoff) {
                            // Yes, it is at or after the scheduled kick off time, we should do a snapshot here if we don't already have it
                            if (!(stageId in stageGroupLeagueTables)) {
                                console.log("Doing snapshot for stage " + stageId);
                                // Calculate snapshot here using cumGroupTeamPoints
                                stageGroupLeagueTables[stageId] = {};
                                for (const groupId in cumGroupTeamPoints) {
                                    const cumTeamPoints = cumGroupTeamPoints[groupId];
                                    stageGroupLeagueTables[stageId][groupId] = calculateLeagueTable(cumTeamPoints, structure.groupTeams[groupId], scheduled, "Start of stage: " + stageId);
                                }
                            }
                        }
                    }
                } else {
                    // There are some previous matches that don't have a final score yet, we can't snapshot any stage tables yet.
                    console.log("Previous matches ongoing, cannot snapshot anymore");
                }

                // Do we know the final score?
                // TODO, we need to lookup the match itself
                const currentMatch = await getTournamentMatch(reader, tournamentId, match.matchId, match.stageId);

                if (currentMatch === null) {
                    throw new Error("Could not find match id: " + match.matchId + " at stage " + match.stageId + " for tournament " + tournamentId);
                }

                if (currentMatch.score !== null) {
                    if (currentMatch.score.isFinalScore) {
                        // Match finished, apply match
                        applyTeamStats(cumTeamPoints, match.homeTeam, match.awayTeam, currentMatch.score.homeGoals, currentMatch.score.awayGoals);
                    } else {
                        console.log("We have latest score, but no final score");
                        previousMatchesOngoing = true;
                    }
                } else {
                    console.log("No final score");
                    previousMatchesOngoing = true;
                }
            }
        }

        const latestTables: Record<string, LeagueTableSnapshot> = {};
        for (const groupId in cumGroupTeamPoints) {
            const cumTeamPoints = cumGroupTeamPoints[groupId];
            latestTables[groupId] = calculateLeagueTable(cumTeamPoints, structure.groupTeams[groupId], null, "Latest Table");
        }

        // Loop through calculated phases to add up match results and snapshot at appropriate moments
        const calculated: TournamentTablesState = {
            generatedAt: generationDate.toISOString(),
            stages: stageGroupLeagueTables,
            latest: latestTables,
        };

        await setTournamentTables(reader, writer, tournamentId, calculated, queues, schedule);
    }
}
