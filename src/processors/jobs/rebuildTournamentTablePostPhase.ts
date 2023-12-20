
import { RebuildTournamentTablePostPhaseJobMeta } from "../../lib/predictorJobBus";
import { HomeAwayPoints, LeagueTable, LeagueTableSnapshot, MatchScore, Penalty, TeamPointsRow, TournamentTablesPostPhase, TournamentTeam } from "../../lib/predictorStorage";
import { JobProcessor } from "./jobProcessor";
import { shouldRebuild } from "./rebuildTournamentStructure";

export class RebuildTournamentTablePostPhaseJob extends JobProcessor {

    async processJob(jobMeta: RebuildTournamentTablePostPhaseJobMeta, timeNow: Date) {
        const tournamentId = jobMeta.tournamentId;
        const phaseId = jobMeta.phaseId;
        console.log("Rebuilding tournament table for tournament: " + tournamentId + " and phase: " + phaseId);

        const prevPhaseId = parseInt(phaseId, 10) - 1;

        // Get all source items
        const sources = {
            phaseStructure: await this.storage.sourceTournamentPhaseStructure(tournamentId, phaseId),
            prevPhaseTables: prevPhaseId >= 0 ? await this.storage.sourceTournamentTablesPostPhase(tournamentId, prevPhaseId.toString()) : null,
            matchScores: await this.storage.sourceTournamentPhaseMatchScores(tournamentId, phaseId),
            allTeams: await this.storage.sourceTournamentTeamsRecord(tournamentId),
        }

        // Build the source hashes map
        const sourceHashes: Record<string, string> = {};
        for (const source of Object.values(sources)) {
            if (source !== null) {
                sourceHashes[source.id] = source.contentHash;
            }
        }

        // This is where we cancel execution if the source hashes map matches what we currently have
        // Fetch current tournament phase structure to do rebuild check
        const current = await this.storage.fetchTournamentTablesPostPhase(tournamentId, phaseId);
        const rebuild = shouldRebuild(current, sourceHashes);
        if (!rebuild) {
            console.warn("Skipping rebuild due to identical sourceHashes");
            return;
        }

        // Note: Use these source items e.g. sources.allTeams.result rather than using this.storage to fetch things
      
        const phase = sources.phaseStructure.result;
        const prevPhase = sources.prevPhaseTables?.result || null;
        const matchScores = sources.matchScores.result;
        const teams = sources.allTeams.result;

        // Obtain the groups from teams
        const groupTeams: Record<string, Record<string, TournamentTeam>> = {}
        for (const teamId in teams) {
            const team = teams[teamId];
            for (const groupId of team.groupIds) {
                if (!(groupId in groupTeams)) {
                    groupTeams[groupId] = {};
                }
                groupTeams[groupId][team.teamId] = team;
            }
        }

        const cumGroupTeamPoints: Record<string, Record<string, TeamPointsRow>> = {}; // Keeps track of all of the group matches while making snapshots

        // Calculate the latest PL table by loading the previous phase and adding the results to it
        if (phaseId === "0") {
            // It's the first phase in this tournament, start with an empty (zeroed) table for all groups
            for (const groupId in groupTeams) {
                for (const teamId in groupTeams[groupId]) {
                    const team = groupTeams[groupId][teamId];
                    if (!(groupId in cumGroupTeamPoints)) {
                        cumGroupTeamPoints[groupId] = {};
                    }
                    cumGroupTeamPoints[groupId][teamId] = getZeroTeamPointsRow(team);
                }
            }
        } else {

            if (prevPhase === null) {
                console.warn("Previous phase tables not written yet, but we need them to calculate this phase, exiting!");
                return;
                // throw new Error("Cannot load tournament phase table for tournament: " + tournamentId + " and prev phase " + prevPhaseId + " but we need it to calculate the next phases table");
            }
            
            // Load all the cumulative group points stats across to the local value
            for (const groupId in prevPhase.cumGroupTeamPoints) {
                cumGroupTeamPoints[groupId] = prevPhase.cumGroupTeamPoints[groupId];
            }
        }
        
        // Loading complete
        // Apply all match scores to the cumulative data

        // These depend on the timeNow which means the script isn't deterministic enough
        /*
        let isPhaseStarted = false;
        let isPhaseCompleted = true;
        let matchesKickedOff = 0;
        */

        let matchesFinished = 0;
        for (const match of phase.matches) {
            
            if (match.status === "MATCH_ON") {
                /*
                if (timeNow > new Date(match.scheduledKickoff.isoDate)) {
                    isPhaseStarted = true;
                    matchesKickedOff++;
                }
                */
                const score = matchScores[match.matchId] || null;
                if (score !== null) {
                    if (score.isFinalScore) {
                        // Match finished, apply match
                        matchesFinished++;
                        applyTeamStats(cumGroupTeamPoints[match.groupId], match.homeTeam, match.awayTeam, score.homeGoals, score.awayGoals);
                    } else {
                        // Latest score, but not final
                        // isPhaseCompleted = false;
                    }
                } else {
                    // Unknown score, we assume it has not started yet, or we dont know the result
                    // isPhaseCompleted = false;
                }
            } else {
                // Match is NOT on, ignore it
            }
        }
        /*
        if (!isPhaseStarted) {
            isPhaseCompleted = false;
        }
        */

        // Now for each group table, sort all the rows appropriately and make league tables based on the sum of home and away results
        const latestTables: Record<string, LeagueTableSnapshot> = {};
        for (const groupId in cumGroupTeamPoints) {
            const cumTeamPoints = cumGroupTeamPoints[groupId];
            latestTables[groupId] = calculateLeagueTable(cumTeamPoints, groupTeams[groupId], null, "Latest Table");
        }

        const result: TournamentTablesPostPhase = {
            tournamentId,
            phaseId,
            generatedAt: { // Is this necessary?
                isoDate: timeNow.toISOString(),
            },
            cumGroupTeamPoints,
            latestTables,
            matchScores,
            // isPhaseStarted,
            // isPhaseCompleted,
            // matchesKickedOff,

            sourceHashes,
        }
        
        await this.storage.storeTournamentTablesPostPhase(result);

        // Note: We don't trigger cross phase events from here.  We expect the appropriate enqueues to happen when source data is altered.
        // So we don't need to trigger phase (phase+1) to rebuild here
        // BUT, this data will likely effect all competitions of this tournament

        await this.jobBus.enqueuePredictorEvent({
            type: "REBUILT-TOURNAMENT-PHASE-TABLE",
            meta: {
                tournamentId,
                phaseId,
            }
        });
    }
}

function getZeroHomeAwayPoints() : HomeAwayPoints {
    return {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,

        pointsAgainst: {},
        awayGoalsAgainst: {},
        penalties: [],
    }
}

function getZeroTeamPointsRow(team: TournamentTeam): TeamPointsRow {
    return {
        team: team,
        home: getZeroHomeAwayPoints(),
        away: getZeroHomeAwayPoints(),
        penalties: [],
        rank: null,
    }
}

function applyTeamStats(cumTeamPoints: Record<string, TeamPointsRow>, homeTeam: TournamentTeam, awayTeam: TournamentTeam, homeGoals: number, awayGoals: number): void {
    
    if (!(homeTeam.teamId in cumTeamPoints)) {
        cumTeamPoints[homeTeam.teamId] = getZeroTeamPointsRow(homeTeam);
    }
    if (!(awayTeam.teamId in cumTeamPoints)) {
        cumTeamPoints[awayTeam.teamId] = getZeroTeamPointsRow(awayTeam);
    }
    
    const teamHome = cumTeamPoints[homeTeam.teamId];
    const teamAway = cumTeamPoints[awayTeam.teamId];
    
    teamHome.home.played++;
    teamHome.home.goalsFor += homeGoals;
    teamHome.home.goalsAgainst += awayGoals;
    
    teamAway.away.played++;
    teamAway.away.goalsFor += awayGoals;
    teamAway.away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
        // Home win
        teamHome.home.wins++;
        teamHome.home.points += 3;
        teamHome.home.pointsAgainst[awayTeam.teamId] = 3;

        teamAway.away.pointsAgainst[homeTeam.teamId] = 0;
        teamAway.away.awayGoalsAgainst[homeTeam.teamId] = awayGoals;
        teamAway.away.losses++;

    } else if (homeGoals < awayGoals) {
        // Away win
        teamHome.home.losses++;
        teamAway.away.wins++;
        teamAway.away.points += 3;

        teamHome.home.pointsAgainst[awayTeam.teamId] = 0;        
        teamAway.away.pointsAgainst[homeTeam.teamId] = 3;
        teamAway.away.awayGoalsAgainst[homeTeam.teamId] = awayGoals;

    } else {
        // Draw
        teamHome.home.draws++;
        teamHome.home.points += 1;
        teamAway.away.draws++;
        teamAway.away.points += 1;

        teamHome.home.pointsAgainst[awayTeam.teamId] = 1;        
        teamAway.away.pointsAgainst[homeTeam.teamId] = 1;
        teamAway.away.awayGoalsAgainst[homeTeam.teamId] = awayGoals;
    }    
}


function calculateLeagueTable(cumTeamPoints: Record<string, TeamPointsRow>, teams: Record<string, TournamentTeam>, atDate: Date | null, descriptionText: string) : LeagueTableSnapshot {
    // Just rank all the teams based on their current team points variable
    const all = getLeagueTableFromCumPoints(cumTeamPoints, "all", teams);

    rankLeagueTable(all);

    // console.log("Now we have " + all.length);
    return {
        table: all,
        snapshotAt: atDate,
        description: descriptionText,
    }
}


function getLeagueTableFromCumPoints(cumTeamPoints: {[key:string]: TeamPointsRow}, type: "homeOnly" | "awayOnly" | "all", teams: Record<string, TournamentTeam>): LeagueTable {

    // Use all object values in cumTeamPoints and all of the rest of the team ids that dont exist yet
    const teamPointsItems = Object.values(cumTeamPoints);
    for (const teamId in teams) {
        if (!(teamId in cumTeamPoints)) {
            // Use zeroed row if we dont have any team stats for the team
            // console.log("Adding zero row for: " + teamId);
            teamPointsItems.push(getZeroTeamPointsRow(teams[teamId]));
        }
    }
    // console.log("There are " + teamPointsItems.length);

    return teamPointsItems.map(teamPointsRow => {
        // Merge the home, away & any deductions in to a single row
        return {
            team: teamPointsRow.team,
            rank: null,
            stats: mergeStats(teamPointsRow.home, teamPointsRow.away, teamPointsRow.penalties, type),
        }
    })
}


function rankLeagueTable(rankings: LeagueTable): void {
    rankings.sort((a,b) => {
        // Compare two teams stats first by points, then Goal Difference, then Goals Scored
        
        // Probably need to do head to head too, but I'm not doing that here
        // Update Sep 25th: Dave complained, so I will add head to head logic here!
        if (a.stats.points < b.stats.points) {
            return 1;
        } else if (a.stats.points > b.stats.points) {
            return -1;
        } else {
            // Equals points
            const gdA = a.stats.goalsFor - a.stats.goalsAgainst;
            const gdB = b.stats.goalsFor - b.stats.goalsAgainst;
            if (gdA < gdB) {
                return 1;
            } else if (gdA > gdB) {
                return -1;
            } else {
                // Equal GD
                if (a.stats.goalsFor < b.stats.goalsFor) {
                    return 1;
                } else if (a.stats.goalsFor > b.stats.goalsFor) {
                    return -1;
                } else {
                    const aPointsAgainstRival = a.stats.pointsAgainst[b.team.teamId] || 0;
                    const bPointsAgainstRival = b.stats.pointsAgainst[a.team.teamId] || 0;
                    // console.log("Cannot separate two teams on normal stats " + a.name + " and " + b.name + " after " + a.stats.played + " games played: " + aPointsAgainstRival + " and " + bPointsAgainstRival);
                    // Equal everything, check the head to head points record
                    
                    if (aPointsAgainstRival < bPointsAgainstRival) {
                        return 1;
                    } else if (aPointsAgainstRival > bPointsAgainstRival) {
                        return -1;
                    } else {
                        // Still equal, check the head to head away goals record
                        const aAwayGoalsAgainstRival = a.stats.awayGoalsAgainst[b.team.teamId] || 0;
                        const bAwayGoalsAgainstRival = b.stats.awayGoalsAgainst[a.team.teamId] || 0;
                        // console.log("Still equal, checking away goals for " + a.name + " and " + b.name + " after " + a.stats.played + " games played: " + aAwayGoalsAgainstRival + " and " + bAwayGoalsAgainstRival);
                        
                        if (aAwayGoalsAgainstRival < bAwayGoalsAgainstRival) {
                            return 1;
                        } else if (aAwayGoalsAgainstRival > bAwayGoalsAgainstRival) {
                            return -1;
                        } else {
                            // Still equal
                            // console.log("Cannot separate two teams AT ALL " + a.team.name + " and " + b.team.name + " after " + a.stats.played + " games played");
                            return 0;
                        }
                    }
                }
            }
        }
    });

    // Populate rankings here by starting at rank 1 and giving the next rank if the next team is different
    let nextRank = 1;
    let lastRank = 0;
    let lastTeamId = null;
    let lastTeam: HomeAwayPoints = {
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        draws: 0,
        losses: 0,
        played: 0,
        wins: 0,
        pointsAgainst: {},
        awayGoalsAgainst: {},
        penalties: [],
    };
    for (const team of rankings) {
        if (nextRank === 1) {
            team.rank = 1;
            lastRank = 1;
            lastTeam = team.stats;
            lastTeamId = team.team.teamId;
            nextRank++;
        } else {
            if (arePointsDifferent(team.stats, team.team.teamId, lastTeam, lastTeamId)) {
                // Use next rank
                team.rank = nextRank;
                lastRank = nextRank;
                lastTeam = team.stats;
                lastTeamId = team.team.teamId;
            } else {
                // Use the same rank
                team.rank = lastRank;
            }
            nextRank++;
        }
    }

    // Now that the rows are ordered, we can strip off the away goals and goals against data that was used to do the ordering
    for (const row of rankings) {
        row.stats.awayGoalsAgainst = {};
        row.stats.pointsAgainst = {};
    }
}

function arePointsDifferent(a: HomeAwayPoints, aTeamId: string, b: HomeAwayPoints, bTeamId: string | null): boolean {

    const aPointsAgainstRival = a.pointsAgainst[bTeamId || ""];
    const bPointsAgainstRival = b.pointsAgainst[aTeamId];
    const aAwayGoalsAgainstRival = a.awayGoalsAgainst[bTeamId || ""];
    const bAwayGoalsAgainstRival = b.awayGoalsAgainst[aTeamId];

    return (a.played !== b.played)
        || (a.wins !== b.wins)
        || (a.draws !== b.draws)
        || (a.losses !== b.losses)
        || (a.goalsFor !== b.goalsFor)
        || (a.goalsAgainst !== b.goalsAgainst)
        || (a.points !== b.points)
        || (aPointsAgainstRival !== bPointsAgainstRival)
        || (aAwayGoalsAgainstRival !== bAwayGoalsAgainstRival)
}

function mergeStats(home: HomeAwayPoints, away: HomeAwayPoints, penalties: Array<Penalty>, type: "homeOnly" | "awayOnly" | "all"): HomeAwayPoints {
    const result: HomeAwayPoints = {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,

        pointsAgainst: {},
        awayGoalsAgainst: {},
        penalties: [],
    }

    if (type === "all" || type === "homeOnly") {
        result.played += home.played;
        result.wins += home.wins;
        result.draws += home.draws;
        result.losses += home.losses;
        result.goalsFor += home.goalsFor;
        result.goalsAgainst += home.goalsAgainst;
        result.points += home.points;
    }

    if (type === "all" || type === "awayOnly") {
        result.played += away.played;
        result.wins += away.wins;
        result.draws += away.draws;
        result.losses += away.losses;
        result.goalsFor += away.goalsFor;
        result.goalsAgainst += away.goalsAgainst;
        result.points += away.points;
    }

    if (type === "all") {
        // Only the joint table includes penalties
        for (const pen of penalties) {
            result.points -= pen.deduction;
        }
    }

    // It doesnt make sense to include the head to head in the home/away only tables.
    // So only add these together when we view the "all" table
    if (type === "all") {
        result.pointsAgainst = sumMaps(home.pointsAgainst, away.pointsAgainst);
        result.awayGoalsAgainst = sumMaps(home.awayGoalsAgainst, away.awayGoalsAgainst);
    }

    return result;
}

type NumericMap = {
    [key: string]: number
}

const sumMaps = (map1: NumericMap, map2: NumericMap) : NumericMap => {
    const result: NumericMap = {};
    for (const key1 in map1) {
        if (!(key1 in result)) {
            result[key1] = 0;
        }
        result[key1] += map1[key1];
    }
    for (const key2 in map2) {
        if (!(key2 in result)) {
            result[key2] = 0;
        }
        result[key2] += map2[key2];
    }
    return result;
}
