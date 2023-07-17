// Anything to do with competition messages.

import { MessageHandler } from "../messageHandler"
import { RedisQueuesController, RedisStorageStateReader, RedisStorageStateWriter } from "redis-state-management";
import { QueueProcessingSchedule } from "../schedules/queueProcessingSchedule";
import { PlayerPrediction, PlayerState } from "../states/player";
import { CompetitionPlayer, PhaseResult, PlayerPointsRow, PlayerPredictionResult, PlayerStandingsRow, ResultsPage } from "../states/results";
import { LeagueTableSnapshot } from "../states/tables";
import { MatchScore } from "../states/tournament";
import { getCompetition } from "./competitionLib";
import { getAllCompetitionsPlayers, getPlayer, getPlayerPrediction } from "./playerLib";
import { getTournamentPhasesStructure } from "./tournamentLib";
import { IMessage } from "redis-state-management/dist/types";

export type CompetitionRebuildResultsPayload = {
    competitionId: string
}

export interface CompetitionRebuildResultsMessage extends IMessage<"COMPETITION_REBUILD_RESULTS", CompetitionRebuildResultsPayload> {};

export class CompetitionRebuildResultsMessageHandler extends MessageHandler<"COMPETITION_REBUILD_RESULTS", CompetitionRebuildResultsPayload> {
    constructor() {
        super("COMPETITION_REBUILD_RESULTS");
    }
    async processMessage(message: CompetitionRebuildResultsMessage, reader: RedisStorageStateReader, writer: RedisStorageStateWriter, schedule: QueueProcessingSchedule, queues: RedisQueuesController) : Promise<void> {
        console.log("Handling competition rebuild message: ID " + message.meta.competitionId + " queued at " + message.occurredAt + "...");

        await this.rebuildResultsForCompetition(reader, writer, message.meta.competitionId);
    }


    async rebuildResultsForCompetition(reader: RedisStorageStateReader, writer: RedisStorageStateWriter, competitionId: string) {
        
        const tournamentStageGroupTableSnapshots: Record<string, Record<string, Record<string, LeagueTableSnapshot>>> = {};
        const tournamentPhaseGroupTableSnapshots: Record<string, Record<string, Record<string, LeagueTableSnapshot>>> = {};
    
        // Calculate result pages for this competition
        console.log("Calculating results page for competition: " + competitionId);

        const competition = await getCompetition(reader, competitionId);

        if (competition === null) {
            throw new Error("Missing competition: " + competitionId);
        }
        // console.log("Competition", JSON.stringify(competition, null, 4));

        // Also get all player ids that have joined this competition
        const players: Record<string, PlayerState> = {};
        try {
            const playerIds = await getAllCompetitionsPlayers(reader, competitionId);
            if (playerIds.length === 0) {
                throw new Error("No players competing yet");
            }
            for (const playerId of playerIds) {
                const player = await getPlayer(reader, playerId);
                if (player === null) {
                    throw new Error("No player found with id: " + playerId);
                }
                players[playerId] = player;
            }
        } catch(e: any) {
            console.warn("SOFT FAILed to rebuild results for competition: " + competitionId + " due to " + e.message);
            return;
        }


        // Also get phases of this tournament
        const phases = await getTournamentPhasesStructure(reader, competition.tournamentId);

        if (phases === null) {
            // throw new Error("Missing tournament phases: " + competition.tournamentId);
            // This should be a soft fail since all competitions get rebuilt after tournament phases update
            console.warn("SOFT FAILed to rebuild results for competition: " + competitionId + " due to missing tournament phases: " + competition.tournamentId)
            return;
        }
        // console.log("Phases", JSON.stringify(phases, null, 4));

        // This tracks the table at the start of a stage by using the table data at the start of the first relevant phase
        const stageTopFourTeams: Record<string, Array<string>> = {};

        // Player points rows
        const playerPointsRows: Record<string, PlayerPointsRow> = {};
        for (const playerId in players) {
            playerPointsRows[playerId] = {
                predicted: 0,
                missed: 0,

                correctScoresTotal: 0,
                correctGDTotal: 0,
                correctOutcomeTotal: 0,
                correctTotal: 0,
                incorrectTotal: 0,
                regularPoints: 0,
                bankerPoints: 0,
                totalPoints: 0,
            }
        }

        const allResults: Array<PhaseResult> = [];
        let lastPhaseRankings: Record<string, number> = {};
        for (const phase of phases.phases) {

            const result: PhaseResult = {
                details: phase,
                stageGroupLeagueSnapshotBefore: {},
                matchPlayerPredictions: {},
                matchPlayerPoints: {},
                playerTotalPoints: {},
                standingsSnapshotAfter: [],             
            }

            for (const playerId in players) {
                result.playerTotalPoints[playerId] = 0;
            }

            // To fix the edge case bug with overlapping game weeks, we put the snapshot of 
            // group tables for all stages that are starting during this phase
            const allStartingStageSnapshots: Record<string, Record<string, LeagueTableSnapshot>> = {};
            for (const startingStageId of phase.startingStages) {
                if (competition.tournamentId in tournamentStageGroupTableSnapshots) {
                    if (startingStageId in tournamentStageGroupTableSnapshots[competition.tournamentId]) {
                        allStartingStageSnapshots[startingStageId] = tournamentStageGroupTableSnapshots[competition.tournamentId][startingStageId];
                    } else {
                        console.warn("Warning, could not find league snapshot for stage: " + startingStageId);
                    }
                } else {
                    console.warn("No tournamentStageGroupTableSnapshots for tournament: " + competition.tournamentId);
                }
                
            }
            result.stageGroupLeagueSnapshotBefore = allStartingStageSnapshots;

            const now = new Date();
            for (const match of phase.matches) {
                const hasKickedOff = now > new Date(match.scheduledKickoff);
                console.log(match.homeTeam.name + " vs " + match.awayTeam.name + " " + match.score?.homeGoals + "-" + match.score?.awayGoals);
                result.matchPlayerPoints[match.matchId] = {};
                result.matchPlayerPredictions[match.matchId] = {};
                let top4teamIds: Array<string> = [];

                // This loads the top4 by stage
                if (match.stageId in stageTopFourTeams) {
                    // We have already seen matches from this stage
                    top4teamIds = stageTopFourTeams[match.stageId];
                } else {
                    // This is the first match of this stage
                    if (competition.tournamentId in tournamentStageGroupTableSnapshots) {
                        if (match.stageId in tournamentStageGroupTableSnapshots[competition.tournamentId]) {
                            if ("PL" in tournamentStageGroupTableSnapshots[competition.tournamentId][match.stageId]) {
                                const tableSnapshot = tournamentStageGroupTableSnapshots[competition.tournamentId][match.stageId]["PL"];
                                stageTopFourTeams[match.stageId] = tableSnapshot.table.filter(t => t.rank !== null && t.rank <= 4).map(t => t.team.teamId);
                                top4teamIds = stageTopFourTeams[match.stageId];
                            }
                        }
                    } else {
                        console.warn("No tournamentStageGroupTableSnapshots for tournament: " + competition.tournamentId);
                    }
                }

                let bankerMultiplier = 3;
                if (top4teamIds.indexOf(match.homeTeam.teamId) !== -1) {
                    bankerMultiplier = 2;
                }
                if (top4teamIds.indexOf(match.awayTeam.teamId) !== -1) {
                    bankerMultiplier = 2;
                }
                // If there are no top4 teams because there is no table snapshot yet, we default to *2 banker
                if (top4teamIds.length < 4) {
                    bankerMultiplier = 2;
                }
                // This should be true in the special case of the "Week 1" stage
                if (match.stageId === "Week 1") {
                    bankerMultiplier = 2;
                }
                match.knownBankerMultiplier = bankerMultiplier;

                if (hasKickedOff) {
                    // console.log("Kicked off");
                    // Get final score here
                    let finalScore: null | MatchScore = null;
                    if (match.score !== null && match.score.isFinalScore) {
                        finalScore = match.score;
                    }

                    // Get predictions from competition details
                    let playerPredictions: Record<string, PlayerPrediction> = {};
                    for (const playerId in players) {
                        const prediction = await getPlayerPrediction(reader, competition.tournamentId, playerId, match.matchId);
                        if (prediction !== null) {
                            playerPredictions[playerId] = prediction;
                        }
                    }
                    
                    // console.log("Player predictions", JSON.stringify(playerPredictions));
                    for (const playerId in players) {
                        let playerPrediction = null;
                        if (playerId in playerPredictions) {
                            playerPrediction = playerPredictions[playerId];
                            // Copy to result
                            result.matchPlayerPredictions[match.matchId][playerId] = playerPrediction;
                        }

                        if (finalScore !== null) {
                            // Calculate points
                            result.matchPlayerPoints[match.matchId][playerId] = this.calculatePoints(bankerMultiplier, playerPrediction, finalScore, playerPointsRows[playerId]);

                            // Sum with existing playerTotalPoints
                            result.playerTotalPoints[playerId] += result.matchPlayerPoints[match.matchId][playerId].regularPoints + result.matchPlayerPoints[match.matchId][playerId].bankerPoints;

                        }
                    }
                }
            }

            // End of a phase, calculate standings
            result.standingsSnapshotAfter = this.calculateStandings(players, playerPointsRows, lastPhaseRankings);
            lastPhaseRankings = {};
            for (const ply of result.standingsSnapshotAfter) {
                lastPhaseRankings[ply.player.playerId] = ply.position;
            }

            // Push to results list
            allResults.push(result);
        }

        // console.log("OUTPUT", JSON.stringify(allResults, null, 4));
        // Split out in to pages of 5 phases each
        // Write the result for this phase
        const pageSize = 5;
        const allPages = [];
        while (allResults.length > pageSize) {
            allPages.push(allResults.splice(0, pageSize));
        }
        if (allResults.length > 0) {
            allPages.push(allResults);
        }
        let pageId = 1;
        for (const result of allPages) {
            const stateId = "RESULTS-" + competitionId + "-" + pageId;
            await writer.writeStateObj<ResultsPage>(stateId, {
                competitionId,
                isLastPage: pageId === allPages.length,
                pageNum: pageId,
                phases: result,
            });
        }
    }

    calculatePoints(bankerMultiplier: number, prediction: null | PlayerPrediction, finalScore: MatchScore, points: PlayerPointsRow): PlayerPredictionResult {
        if (prediction === null || !prediction.score) {
            points.missed++;
            points.regularPoints += -1;
            points.totalPoints += -1;
            return {
                wasBanker: false,
                regularPoints: -1,
                bankerPoints: 0,
                resultType: "MISSED",
            }
        } else {
            points.predicted++;
            if (finalScore.homeGoals === prediction.score.home && finalScore.awayGoals === prediction.score.away) {
                // Correct score

                let regularPoints = 7;
                let bankerPoints = regularPoints * (prediction.isBanker ? bankerMultiplier - 1 : 0);

                points.correctTotal ++;
                points.correctScoresTotal++;
                points.regularPoints += regularPoints;
                points.bankerPoints += bankerPoints;
                points.totalPoints += regularPoints + bankerPoints;
                return {
                    resultType: "CORRECT_SCORE",
                    regularPoints,
                    bankerPoints,
                    wasBanker: prediction.isBanker,
                }
            } else {
                // String number typing bug found
                // console.log("Not correct score, score: " + finalScore.homeGoals + "-" + finalScore.awayGoals + " but prediction was " + prediction.score.home + "-" + prediction.score.away);
            }

            const finalScoreGD = finalScore.homeGoals - finalScore.awayGoals;
            const predictedGD = prediction.score.home - prediction.score.away;
            if (finalScoreGD === predictedGD) {
                // Correct GD

                let regularPoints = 4;
                let bankerPoints = regularPoints * (prediction.isBanker ? bankerMultiplier - 1 : 0);

                points.correctTotal ++;
                points.correctGDTotal++;
                points.regularPoints += regularPoints;
                points.bankerPoints += bankerPoints;
                points.totalPoints += regularPoints + bankerPoints;

                return {
                    resultType: "CORRECT_GD",
                    regularPoints,
                    bankerPoints,
                    wasBanker: prediction.isBanker,
                }
            }

            // Work out result
            if (finalScore.homeGoals > finalScore.awayGoals) {
                // Home win
                if (prediction.score.home > prediction.score.away) {
                    let regularPoints = 2;
                    let bankerPoints = regularPoints * (prediction.isBanker ? bankerMultiplier - 1 : 0);

                    points.correctTotal ++;
                    points.correctOutcomeTotal++;
                    points.regularPoints += regularPoints;
                    points.bankerPoints += bankerPoints;
                    points.totalPoints += regularPoints + bankerPoints;
                    return {
                        resultType: "CORRECT_RESULT",
                        regularPoints,
                        bankerPoints,
                        wasBanker: prediction.isBanker,
                    }
                } else {
                    let regularPoints = -1;
                    let bankerPoints = regularPoints * (prediction.isBanker ? bankerMultiplier - 1 : 0);

                    points.incorrectTotal ++;
                    points.regularPoints += regularPoints;
                    points.bankerPoints += bankerPoints;
                    points.totalPoints += regularPoints + bankerPoints;
                    return {
                        resultType: "INCORRECT_RESULT",
                        regularPoints,
                        bankerPoints,
                        wasBanker: prediction.isBanker,
                    }
                }

            } else if (finalScore.homeGoals < finalScore.awayGoals) {
                // Away win
                if (prediction.score.home < prediction.score.away) {
                    let regularPoints = 2;
                    let bankerPoints = regularPoints * (prediction.isBanker ? bankerMultiplier - 1 : 0);

                    points.correctTotal ++;
                    points.correctOutcomeTotal++;
                    points.regularPoints += regularPoints;
                    points.bankerPoints += bankerPoints;
                    points.totalPoints += regularPoints + bankerPoints;
                    return {
                        resultType: "CORRECT_RESULT",
                        regularPoints,
                        bankerPoints,
                        wasBanker: prediction.isBanker,
                    }
                } else {
                    let regularPoints = -1;
                    let bankerPoints = regularPoints * (prediction.isBanker ? bankerMultiplier - 1 : 0);

                    points.incorrectTotal ++;
                    points.regularPoints += regularPoints;
                    points.bankerPoints += bankerPoints;
                    points.totalPoints += regularPoints + bankerPoints;
                    return {
                        resultType: "INCORRECT_RESULT",
                        regularPoints,
                        bankerPoints,
                        wasBanker: prediction.isBanker,
                    }
                }

            } else {
                // Draw would have been caught above if predicted
                // So if we get here it is an incorrect result
                let regularPoints = -1;
                    let bankerPoints = regularPoints * (prediction.isBanker ? bankerMultiplier - 1 : 0);

                    points.incorrectTotal ++;
                    points.regularPoints += regularPoints;
                    points.bankerPoints += bankerPoints;
                    points.totalPoints += regularPoints + bankerPoints;
                    return {
                        resultType: "INCORRECT_RESULT",
                        regularPoints,
                        bankerPoints,
                        wasBanker: prediction.isBanker,
                    }
            }
        }
    }

    calculateStandings(competitionPlayers: Record<string, CompetitionPlayer>, playerPointsRows: Record<string, PlayerPointsRow>, previousRankings: Record<string, number>) : Array<PlayerStandingsRow> {
        const playerStandings: Array<PlayerStandingsRow> = [];

        for (const playerId in competitionPlayers) {
            const standingsRow: PlayerStandingsRow = {
                player: competitionPlayers[playerId],
                points: JSON.parse(JSON.stringify(playerPointsRows[playerId])), // Note, we need to clone this so that it snapshots the object over time properly.
                position: 1,
            }
            if (playerId in previousRankings) {
                standingsRow.previousRankingPosition = previousRankings[playerId];
            }
            playerStandings.push(standingsRow);
        }

        // Order by points (for now)
        playerStandings.sort((a: PlayerStandingsRow, b: PlayerStandingsRow) => {
            return b.points.totalPoints - a.points.totalPoints;
        });

        // Assign positions by checking if different
        let previousPoints: null | number = null;
        let lastPosition: null | number = null;
        let nextPosition = 1;
        for (const standing of playerStandings) {
            if (previousPoints !== null && lastPosition !== null) {
                if (standing.points.totalPoints === previousPoints) {
                    // Same position, use lastPosition
                    standing.position = lastPosition;
                } else {
                    // Lower
                    previousPoints = standing.points.totalPoints;
                    standing.position = nextPosition;
                    lastPosition = standing.position;
                }
            } else {
                // First row
                previousPoints = standing.points.totalPoints;
                standing.position = 1;
                lastPosition = 1;
            }

            nextPosition++;
        }
        return playerStandings;
    }
}
