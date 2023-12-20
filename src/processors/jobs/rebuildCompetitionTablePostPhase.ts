import { RebuildCompetitionTablePostPhaseJobMeta } from "../../lib/predictorJobBus";
import { CompetitionPlayer, CompetitionTablesPostPhase, LeagueTableSnapshot, MatchScore, PlayerPointsRow, PlayerPrediction, PlayerPredictionResult, PlayerStandingsRow } from "../../lib/predictorStorage";
import { JobProcessor } from "./jobProcessor";
import { shouldRebuild } from "./rebuildTournamentStructure";

export class RebuildCompetitionTablePostPhaseJob extends JobProcessor {

    async processJob(jobMeta: RebuildCompetitionTablePostPhaseJobMeta, timeNow: Date) {
        const competitionId = jobMeta.competitionId;
        const phaseId = jobMeta.phaseId;
        console.log("Rebuilding competition table for competition: " + competitionId + " and phase: " + phaseId);        

        // The competition phase table depends on:
        // 1. tournament structure (to determine if we need to add a table from a previous phase)
        // 2. tournament phase structure
        // 3. prev tournament phase table (for bankers calc)
        // 4. this tournament phase table (for scores)
        // 5. prev competition phase table (for cumulative player tables)
        // 6. predictions of competitors for matches at this phase
        // 7. the competition (for scoring rules)

        const thisCompetition = await this.storage.fetchCompetition(competitionId);
        if (thisCompetition === null) {
            throw new Error("Cannot rebuild for missing competition: " + competitionId);
        }
        const tournamentId = thisCompetition.meta.tournamentId;

        const prevPhaseId = parseInt(phaseId, 10) - 1;

        // Get all source items
        const sources = {
            tournamentStructure: await this.storage.sourceTournamentStructure(tournamentId),
            phaseStructure: await this.storage.sourceTournamentPhaseStructure(tournamentId, phaseId),
            // prevPhaseTables: prevPhaseId >= 0 ? await this.storage.sourceTournamentTablesPostPhase(tournamentId, prevPhaseId.toString()) : null,
            thisPhaseTables: await this.storage.sourceTournamentTablesPostPhase(tournamentId, phaseId),
            prevCompetitionTables: prevPhaseId >= 0 ? await this.storage.sourceCompetitionTablesPostPhase(competitionId, prevPhaseId.toString()) : null,
            predictions: await this.storage.sourceCompetitionPredictions(competitionId, phaseId),
            // competition: await this.storage.sourceCompetition(competitionId),
            competitionPlayers: await this.storage.sourceCompetitionPlayers(competitionId),
            relevantPhaseSnapshots: await this.storage.sourceRelevantPhaseSnapshots(tournamentId, phaseId),

            // Note: Not actually used.  This is to bust the cache when another match has just kicked off.
            phaseKickoffs: await this.storage.sourceTournamentPhaseKickoffs(tournamentId, phaseId, timeNow),
        }

        // Build the source hashes map
        const sourceHashes: Record<string, string> = {};
        for (const source of Object.values(sources)) {
            if (source !== null) {
                sourceHashes[source.id] = source.contentHash;
            }
        }

        // Fetch current competition phase table to do rebuild check
        const current = await this.storage.fetchCompetitionTablesPostPhase(competitionId, phaseId);
        const rebuild = shouldRebuild(current, sourceHashes);
        if (!rebuild) {
            console.warn("Skipping rebuild due to identical sourceHashes");
            return;
        }

        // Note: Use these source items e.g. sources.tournamentStructure.result rather than using this.storage to fetch things
        const tournamentStructure = sources.tournamentStructure.result;
        const phaseStructure = sources.phaseStructure.result;
        // const prevPhaseTables = sources.prevPhaseTables?.result || null;
        const thisPhaseTables = sources.thisPhaseTables.result;
        const prevCompetitionTables = sources.prevCompetitionTables?.result || null;
        const predictions = sources.predictions.result;
        // const competition = sources.competition.result;
        const competitionPlayers = sources.competitionPlayers.result;
        const relevantPhaseSnapshots = sources.relevantPhaseSnapshots.result;

        // TODO: Use the Match scores in the tournament phase tables along with the predictions to build the phase results table with points (using system set in the competition)
        // TODO: Also use the cumulative data in the prev competition phase to build player table results after this phase

        // For all included stages, we put a snapshot of all group tables here
        // This is then used later to work out bankers
        const stageGroupLeagueSnapshotBefore: Record<string, Record<string, LeagueTableSnapshot>> = {};
        for (const stageId of phaseStructure.includedStages) {
            if (stageId in tournamentStructure.phaseBeforeStageStarts) {
                const phaseId = tournamentStructure.phaseBeforeStageStarts[stageId];
                if (phaseId in relevantPhaseSnapshots) {
                    stageGroupLeagueSnapshotBefore[stageId] = relevantPhaseSnapshots[phaseId];
                } else {
                    throw new Error("We are aware of phase " + phaseId + " being relevant for stage: " + stageId + " but it does not exist in the sourced relevantPhaseSnapshots");
                }
            } else {
                // We don't know the phase before this stage starts, perhaps it is the first stage
            }
        }

        // Load cumulative player points from previous phase
        const playerPointsRows: Record<string, PlayerPointsRow> = {};
        // and the previous ranking
        const lastPhaseRankings: Record<string, number> = {};

        if (prevCompetitionTables === null) {
            for (const playerId in competitionPlayers) {
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
        } else {
            // Load from previous phase
            for (const standing of prevCompetitionTables.standingsSnapshotAfter) {
                playerPointsRows[standing.player.playerId] = standing.points;
                lastPhaseRankings[standing.player.playerId] = standing.position;
            }
        }

        // Initialise total points
        const playerTotalPoints: Record<string, number> = {};
        for (const playerId in competitionPlayers) {
            playerTotalPoints[playerId] = 0;
        }

        // Calculate points per match

        const matchPlayerPredictions: Record<string, Record<string, PlayerPrediction | null>> = {};
        const matchPlayerPoints: Record<string, Record<string, PlayerPredictionResult>> = {};
        for (const match of phaseStructure.matches) {
            if (match.status === "MATCH_ON") {
                const hasKickedOff = timeNow > new Date(match.scheduledKickoff.isoDate);

                const score = thisPhaseTables.matchScores[match.matchId] || null;

                console.log(match.homeTeam.name + " vs " + match.awayTeam.name + " " + score?.homeGoals + "-" + score?.awayGoals);
                matchPlayerPoints[match.matchId] = {};
                matchPlayerPredictions[match.matchId] = {};
                
                // Work out banker multiplier
                let bankerMultiplier = 3;
                if (match.stageId in stageGroupLeagueSnapshotBefore) {
                    const groupTables = stageGroupLeagueSnapshotBefore[match.stageId];
                    if (match.groupId in groupTables) {
                        const table = groupTables[match.groupId];
                        for (const [i, tableRow] of table.table.entries()) {
                            if (tableRow.rank !== null && tableRow.rank <= 4) {
                                // Top 4
                                if (tableRow.team.teamId === match.homeTeamId) {
                                    bankerMultiplier = 2;
                                    break;
                                }
                                if (tableRow.team.teamId === match.awayTeamId) {
                                    bankerMultiplier = 2;
                                    break;
                                }
                            }
                        }
                    } else {
                        throw new Error("Could not find group table for " + match.groupId + " in pre snapshot for stage " + match.stageId);
                    }
                } else {
                    // throw new Error("Could not find pre snapshot for stage " + match.stageId);
                    // Probably just week 1
                    bankerMultiplier = 2;
                }
                
                if (hasKickedOff) {
                    let finalScore: null | MatchScore = null;
                    if (score !== null && score.isFinalScore) {
                        finalScore = score;
                    }

                    for (const playerId in competitionPlayers) {
                        let playerPrediction = null;
                        const compositeId = playerId + "_" + match.matchId;
                        if (compositeId in predictions) {
                            playerPrediction = predictions[compositeId];
                            // Copy to result
                            matchPlayerPredictions[match.matchId][playerId] = playerPrediction;
                        }

                        if (finalScore !== null) {
                            // Calculate points
                            matchPlayerPoints[match.matchId][playerId] = this.calculatePoints(bankerMultiplier, playerPrediction, finalScore, playerPointsRows[playerId]);

                            console.log("Player " + playerId + " (on " +  playerTotalPoints[playerId] + " points) got " + matchPlayerPoints[match.matchId][playerId].regularPoints + " regular points and " + matchPlayerPoints[match.matchId][playerId].bankerPoints + " banker points from match " + match.matchId);


                            // Sum with existing playerTotalPoints
                            playerTotalPoints[playerId] += matchPlayerPoints[match.matchId][playerId].regularPoints + matchPlayerPoints[match.matchId][playerId].bankerPoints;
                        }
                    }
                }
            }
        }

        // The function below does not require the Competing data at this point yet, but it may need to later on
        // So this just formats what we have above for the old function
        const justPlayers: Record<string, CompetitionPlayer> = {};
        for (const playerId in competitionPlayers) {
            justPlayers[playerId] = competitionPlayers[playerId].player;
        }
        
        const standingsSnapshotAfter = this.calculateStandings(justPlayers, playerPointsRows, lastPhaseRankings);

        const result: CompetitionTablesPostPhase = {
            competitionId,
            phaseId,

            details: phaseStructure,
            stageGroupLeagueSnapshotBefore,
            
            matchPlayerPredictions,
            matchPlayerPoints,
            playerTotalPoints,
            standingsSnapshotAfter,

            sourceHashes,
        }

        await this.storage.storeCompetitionTablesPostPhase(result);

        // Note: We don't need to cascade any event stuff here since this is the deepest thing to rebuild and it wont trigger horizontally between phases!
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

