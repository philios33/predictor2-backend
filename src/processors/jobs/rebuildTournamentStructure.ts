import objectHash from "object-hash";
import { RebuildTournamentStructureJobMeta } from "../../lib/predictorJobBus";
import { ISODate, TournamentMatchWithTeams, TournamentPhaseStructure, TournamentTeam } from "../../lib/predictorStorage";
import { JobProcessor } from "./jobProcessor";

export function shouldRebuild(current: null | {meta: {sourceHashes: Record<string, string>}}, latestSourceHashes: Record<string, string>) : boolean {
    if (current === null) {
        return true;
    } else {
        const currentSourceHashes = current.meta.sourceHashes;
        if (objectHash(currentSourceHashes) === objectHash(latestSourceHashes)) {
            return false;
        } else {
            return true;
        }
    }
}

export class RebuildTournamentStructureJob extends JobProcessor {

    async processJob(jobMeta: RebuildTournamentStructureJobMeta, timeNow: Date) {
        const tournamentId = jobMeta.tournamentId;
        console.log("Rebuilding structure for tournament: " + tournamentId + " and time now is " + timeNow);
        
        // Get all source items
        const sources = {
            allTeams: await this.storage.sourceTournamentTeamsRecord(tournamentId),
            allMatches: await this.storage.sourceTournamentMatches(tournamentId),            
        }

        // Build the source hashes map
        const sourceHashes: Record<string, string> = {};
        for (const source of Object.values(sources)) {
            sourceHashes[source.id] = source.contentHash;
        }

        // This is where we cancel execution if the source hashes map matches what we currently have
        // Fetch current tournament structure to do rebuild check
        const current = await this.storage.fetchTournamentStructure(tournamentId);
        const rebuild = shouldRebuild(current, sourceHashes);
        if (!rebuild) {
            console.warn("Skipping rebuild due to identical sourceHashes");
            return;
        }

        // Note: Use these source items e.g. sources.allTeams.result rather than using this.storage to fetch things
      
        const allTeams = sources.allTeams.result;
        const allMatches = Object.values(sources.allMatches.result);

        // Order the matches by kickoff time
        allMatches.sort((match1, match2) => {
            return (new Date(match1.scheduledKickoff.isoDate)).getTime() - (new Date(match2.scheduledKickoff.isoDate)).getTime();
        });

        // Loop all matches while creating phases
        // Keep track of which phase starts each new stage id

        let phaseId = 0;
        let phaseMatches: Array<TournamentMatchWithTeams> = [];
        let teamIds: Array<string> = [];
        let calculatedPhases: Array<TournamentPhaseStructure> = [];
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
                    tournamentId,
                    phaseId: phaseId.toString(),
                    earliestMatchKickoff: phaseMatches[0].scheduledKickoff,
                    latestMatchKickoff: phaseMatches[phaseMatches.length - 1].scheduledKickoff,
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
                const latestKO = new Date(latestMatch.scheduledKickoff.isoDate).getTime();
                const nextKO = new Date(match.scheduledKickoff.isoDate).getTime();
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
                tournamentId,
                homeTeamId: match.homeTeamId,
                homeTeam: allTeams[match.homeTeamId],
                awayTeamId: match.awayTeamId,
                awayTeam: allTeams[match.awayTeamId],
                scheduledKickoff: match.scheduledKickoff,
                matchId: match.matchId,
                stageId: match.stageId,
                groupId: match.groupId,
                status: match.status,
                statusMessage: match.statusMessage,
            });
            teamIds.push(match.homeTeamId);
            teamIds.push(match.awayTeamId);
        }
        finaliseCurrentPhase();

        // Work out teams map by the groups they are in
        const groupTeams: Record<string, Record<string, TournamentTeam>> = {};
        for (const teamId in allTeams) {
            const team = allTeams[teamId];
            for (const groupId of team.groupIds) {
                if (!(groupId in groupTeams)) {
                    groupTeams[groupId] = {};
                }
                groupTeams[groupId][team.teamId] = team;
            }
        }

        const phaseBeforeStageStarts: Record<string, number> = {};
        const phaseTimes: Record<string, {earliestMatchKickoff: ISODate, latestMatchKickoff: ISODate}> = {};

        // Write all the tournament phases
        for (const [i, phase] of calculatedPhases.entries()) {
            // Sanity check
            if (phase.phaseId !== i.toString()) {
                throw new Error("Phase ID mismatch: " + phase.phaseId + " but we expected " + i.toString());
            }

            phaseTimes[phase.phaseId] = {
                earliestMatchKickoff: phase.earliestMatchKickoff,
                latestMatchKickoff: phase.latestMatchKickoff,
            }

            if (i > 0) {
                for (const stageId of phase.startingStages) {
                    phaseBeforeStageStarts[stageId] = (i - 1);
                }
            }

            // Write match phases
            for (const match of phase.matches) {
                await this.storage.storeTournamentMatchPhase({
                    tournamentId,
                    matchId: match.matchId,
                    phaseId: phase.phaseId,
                });
            }

            await this.storage.storeTournamentPhaseStructure(phase);            
        }

        // Finish with the final tournament structure
        await this.storage.storeTournamentStructure({
            generatedAt: {
                isoDate: timeNow.toISOString(),
            },
            tournamentId,

            groupTeams,
            phaseTimes,
            phaseBeforeStageStarts,

            sourceHashes,
        });

        await this.jobBus.enqueuePredictorEvent({
            type: "REBUILT-TOURNAMENT-STRUCTURE",
            meta: {
                tournamentId
            }
        })

    }
}

