import { HomeAwayPoints, LeagueTable, LeagueTableSnapshot, Penalty } from "../states/tables"
import { TournamentTeam } from "../states/tournament"
import { TeamPointsRow } from "./tournamentRebuildTables"

const getZeroHomeAwayPoints = () : HomeAwayPoints => {
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

export const getZeroTeamPointsRow = (team: TournamentTeam): TeamPointsRow => {
    return {
        team: team,
        home: getZeroHomeAwayPoints(),
        away: getZeroHomeAwayPoints(),
        penalties: [],
        rank: null,
    }
}

export const applyTeamStats = (cumTeamPoints: Record<string, TeamPointsRow>, homeTeam: TournamentTeam, awayTeam: TournamentTeam, homeGoals: number, awayGoals: number): void => {
    
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


const mergeStats = (home: HomeAwayPoints, away: HomeAwayPoints, penalties: Array<Penalty>, type: "homeOnly" | "awayOnly" | "all"): HomeAwayPoints => {
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

export const calculateLeagueTable = (cumTeamPoints: Record<string, TeamPointsRow>, teams: Record<string, TournamentTeam>, atDate: Date | null, descriptionText: string) : LeagueTableSnapshot => {
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

/*
// This one isn't used anywhere

export const calculateAllLeagueTables = (cumTeamPoints: Record<string, TeamPointsRow>, teams: Record<string, TournamentTeam>) => {
    // Just rank all the teams based on their current team points variable
    const homeOnly = getLeagueTableFromCumPoints(cumTeamPoints, "homeOnly", teams);
    const awayOnly = getLeagueTableFromCumPoints(cumTeamPoints, "awayOnly", teams);
    const all = getLeagueTableFromCumPoints(cumTeamPoints, "all", teams);

    rankLeagueTable(homeOnly);
    rankLeagueTable(awayOnly);
    rankLeagueTable(all);

    return {
        homeOnly,
        awayOnly,
        all,
    }
}
*/

const getLeagueTableFromCumPoints = (cumTeamPoints: {[key:string]: TeamPointsRow}, type: "homeOnly" | "awayOnly" | "all", teams: Record<string, TournamentTeam>): LeagueTable => {

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


const rankLeagueTable = (rankings: LeagueTable): void => {
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
    let lastTeamName = null;
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
            lastTeamName = team.team.name;
            nextRank++;
        } else {
            if (arePointsDifferent(team.stats, team.team.name, lastTeam, lastTeamName)) {
                // Use next rank
                team.rank = nextRank;
                lastRank = nextRank;
                lastTeam = team.stats;
                lastTeamName = team.team.name;
            } else {
                // Use the same rank
                team.rank = lastRank;
            }
            nextRank++;
        }
    }

    // Now that the rows are ordered, we can strip off the away goals and goals against data that was used to do the ordering
    rankings.forEach(r => {
        r.stats.awayGoalsAgainst = {};
        r.stats.pointsAgainst = {};
    });
}

const arePointsDifferent = (a: HomeAwayPoints, aName: string, b: HomeAwayPoints, bName: string | null): boolean => {

    const aPointsAgainstRival = a.pointsAgainst[bName || ""];
    const bPointsAgainstRival = b.pointsAgainst[aName];
    const aAwayGoalsAgainstRival = a.awayGoalsAgainst[bName || ""];
    const bAwayGoalsAgainstRival = b.awayGoalsAgainst[aName];

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