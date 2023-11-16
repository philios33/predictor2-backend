import { instantiateMemorySystemForTestPurposes } from "../lib/memoryTestHarness";
import { PredictorStorage } from "../lib/predictorStorage";
import { JobsConsumer } from "../processors/jobsConsumer";
import { PredictorActionsHandler } from "./predictorActionsHandler";
import { PredictorJobBus } from "./predictorJobBus";

export default function() {
    describe('Predictor Competition Rebuild Tests', () => {
        
        let predictorHandler: PredictorActionsHandler;
        let jobsConsumer: JobsConsumer;
        let predictorStorage: PredictorStorage;

        beforeAll(async () => {
            const result = instantiateMemorySystemForTestPurposes();
            predictorHandler = result.predictorHandler;
            jobsConsumer = result.jobsConsumer;
            predictorStorage = result.predictorStorage;
        })
        afterAll(async () => {
            
        })

        describe('Competition tournament rebuilding', () => {
            
            it('should build tournament structure and phase tables for competition', async () => {

                await predictorHandler.putTournament("T1", "Phils League");
                await predictorHandler.putTournamentTeam("T1", "ARS", "Arsenal", "Arsenal", "", ["PL"]);
                await predictorHandler.putTournamentTeam("T1", "AST", "Aston Villa", "Villa", "", ["PL"]);
                await predictorHandler.putTournamentTeam("T1", "CHE", "Chelsea", "Chelsea", "", ["PL"]);
                await predictorHandler.putTournamentTeam("T1", "MAN", "Manchester City", "City", "", ["PL"]);
                // Week 1
                await predictorHandler.putTournamentMatch("T1", "ARSAST", "Week 1", "ARS", "AST", { isoDate: "2023-01-01T14:00:00Z" }, "PL", "MATCH_ON", null);
                await predictorHandler.putTournamentMatch("T1", "CHEMAN", "Week 1", "CHE", "MAN", { isoDate: "2023-01-01T14:00:00Z" }, "PL", "MATCH_ON", null);
                // Week 2
                await predictorHandler.putTournamentMatch("T1", "ARSCHE", "Week 2", "ARS", "CHE", { isoDate: "2023-02-01T14:00:00Z" }, "PL", "MATCH_ON", null);
                await predictorHandler.putTournamentMatch("T1", "ASTMAN", "Week 2", "AST", "MAN", { isoDate: "2023-02-01T14:00:00Z" }, "PL", "MATCH_ON", null);
                
                const time1 = new Date("2023-01-01T12:00:00Z");
                const jobs1 = await jobsConsumer.processAllJobsNow(time1);
                expect(jobs1).toEqual([
                    "PREDICTOR-EVENT-PUT-TOURNAMENT_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-TEAM_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-TEAM_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-TEAM_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-TEAM_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH_T1",
                    "REBUILD-TOURNAMENT-STRUCTURE_T1",
                    "REBUILD-TOURNAMENT-STRUCTURE_T1",
                    "REBUILD-TOURNAMENT-STRUCTURE_T1",
                    "REBUILD-TOURNAMENT-STRUCTURE_T1",
                    "REBUILD-TOURNAMENT-STRUCTURE_T1",
                    "REBUILD-TOURNAMENT-STRUCTURE_T1",
                    "REBUILD-TOURNAMENT-STRUCTURE_T1",
                    "REBUILD-TOURNAMENT-STRUCTURE_T1",
                    "PREDICTOR-EVENT-REBUILT-TOURNAMENT-STRUCTURE_T1"
                ]);

                // Players
                await predictorHandler.putPlayer("P1", "Player 1", "p1@code67.com");
                await predictorHandler.putPlayer("P2", "Player 2", "p2@code67.com");
                await predictorHandler.putPlayer("P3", "Player 3", "p3@code67.com");

                // Competition
                await predictorHandler.putCompetition("C1", "T1", "League", "P1");

                // Compete metas
                await predictorHandler.playerCompeting("P1", "C1", 0, 0);
                await predictorHandler.playerCompeting("P2", "C1", 0, 0);
                await predictorHandler.playerCompeting("P3", "C1", 0, 0);

                const time2 = new Date("2023-01-01T12:00:00Z");
                const jobs2 = await jobsConsumer.processAllJobsNow(time2);
                expect(jobs2).toEqual([
                    "PREDICTOR-EVENT-PUT-PLAYER_P1",
                    "PREDICTOR-EVENT-PUT-PLAYER_P2",
                    "PREDICTOR-EVENT-PUT-PLAYER_P3",
                    "PREDICTOR-EVENT-PUT-COMPETITION_C1",
                    "PREDICTOR-EVENT-PLAYER-COMPETING_P1_C1",
                    "PREDICTOR-EVENT-PLAYER-COMPETING_P2_C1",
                    "PREDICTOR-EVENT-PLAYER-COMPETING_P3_C1",
                ]);

                await predictorHandler.triggerKickoffsChanged("T1");
                const time3 = new Date("2023-01-01T15:00:00Z");
                const jobs3 = await jobsConsumer.processAllJobsNow(time3);
                expect(jobs3).toEqual([
                    "PREDICTOR-EVENT-POSSIBLE-KICKOFFS_T1",
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_0", // Tournament phase 0 has started, so it rebuilds the tournament tables
                    "REBUILD-COMPETITION-TABLE-POST-PHASEC1_0", // And also relevant competitions
                    "PREDICTOR-EVENT-REBUILT-TOURNAMENT-PHASE-TABLE_T1_0", // But the tournament tables also changes, which in turn causes
                    "REBUILD-COMPETITION-TABLE-POST-PHASEC1_0" // The competition tables to rebuild again (but this one is skipped since there is no change)
                ]);

                // Check competition phase 0 tables
                const phase0 = await predictorStorage.fetchCompetitionTablesPostPhase("C1", "0");
                
                expect(phase0?.meta.standingsSnapshotAfter[0].position).toBe(1);
                expect(phase0?.meta.standingsSnapshotAfter[0].points.totalPoints).toBe(0);
                expect(phase0?.meta.standingsSnapshotAfter[1].position).toBe(1);
                expect(phase0?.meta.standingsSnapshotAfter[1].points.totalPoints).toBe(0);
                expect(phase0?.meta.standingsSnapshotAfter[2].position).toBe(1);
                expect(phase0?.meta.standingsSnapshotAfter[2].points.totalPoints).toBe(0);

                expect(phase0?.meta.matchPlayerPredictions).toEqual({
                    "ARSAST": {
                        "P1": null,
                        "P2": null,
                        "P3": null,
                    },
                    "CHEMAN": {
                        "P1": null,
                        "P2": null,
                        "P3": null,
                    }
                });
                expect(phase0?.meta.matchPlayerPoints).toEqual({
                    "ARSAST": {},
                    "CHEMAN": {}
                });
                expect(phase0?.meta.playerTotalPoints).toEqual({
                    "P1": 0,
                    "P2": 0,
                    "P3": 0
                });

                // Add some predictions
                await predictorHandler.putPlayerPrediction("P1", "T1", "ARSAST", {
                    isBanker: true,
                    score: {
                        home: 1,
                        away: 2,
                    }
                });
                await predictorHandler.putPlayerPrediction("P2", "T1", "ARSAST", {
                    isBanker: false,
                    score: {
                        home: 0,
                        away: 0,
                    }
                });
                await predictorHandler.putPlayerPrediction("P3", "T1", "ARSAST", {
                    isBanker: false,
                    score: {
                        home: 2,
                        away: 0,
                    }
                });

                const time4 = new Date("2023-01-01T15:00:00Z");
                const jobs4 = await jobsConsumer.processAllJobsNow(time4);
                expect(jobs4).toEqual([
                    "PREDICTOR-EVENT-PUT-PLAYER-PREDICTION_T1_P1",
                    "PREDICTOR-EVENT-PUT-PLAYER-PREDICTION_T1_P2",
                    "PREDICTOR-EVENT-PUT-PLAYER-PREDICTION_T1_P3",
                    "REBUILD-COMPETITION-TABLE-POST-PHASEC1_0",
                    "REBUILD-COMPETITION-TABLE-POST-PHASEC1_0", // This one ignored due to no changes
                    "REBUILD-COMPETITION-TABLE-POST-PHASEC1_0", // This one also ignored due to no changes
                ]);

                const phase02 = await predictorStorage.fetchCompetitionTablesPostPhase("C1", "0");
                
                expect(phase02?.meta.matchPlayerPredictions).toEqual({
                    "ARSAST": {
                        "P1": {
                            isBanker: true,
                            score: {
                                home: 1,
                                away: 2,
                            }
                        },
                        "P2": {
                            isBanker: false,
                            score: {
                                home: 0,
                                away: 0,
                            }
                        },
                        "P3": {
                            isBanker: false,
                            score: {
                                home: 2,
                                away: 0,
                            }
                        }
                    },
                    "CHEMAN": {
                        "P1": null,
                        "P2": null,
                        "P3": null,
                    }
                });
                expect(phase02?.meta.matchPlayerPoints).toEqual({
                    "ARSAST": {},
                    "CHEMAN": {}
                });
                expect(phase02?.meta.playerTotalPoints).toEqual({
                    "P1": 0,
                    "P2": 0,
                    "P3": 0,
                });

                // Week 1 scores
                await predictorHandler.putTournamentMatchScore("T1", "ARSAST", {
                    isFinalScore: true,
                    homeGoals: 1,
                    awayGoals: 3,
                    gameMinute: null
                });
                
                await predictorHandler.putTournamentMatchScore("T1", "CHEMAN", {
                    isFinalScore: true,
                    homeGoals: 2,
                    awayGoals: 2,
                    gameMinute: null
                });

                const time5 = new Date("2023-01-01T16:00:00Z");
                const jobs5 = await jobsConsumer.processAllJobsNow(time5);
                expect(jobs5).toEqual([
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH-SCORE_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH-SCORE_T1",
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_0", // Triggers the rebuilt event below
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_0", // Skipped
                    "PREDICTOR-EVENT-REBUILT-TOURNAMENT-PHASE-TABLE_T1_0", // Triggers the competition phase 0 rebuild
                    "REBUILD-COMPETITION-TABLE-POST-PHASEC1_0"
                ]);

                const phase03 = await predictorStorage.fetchCompetitionTablesPostPhase("C1", "0");
                
                
                expect(phase03?.meta.matchPlayerPoints).toEqual({
                    "ARSAST": {
                        "P1": {
                            "bankerPoints": 2,
                            "regularPoints": 2,
                            "resultType": "CORRECT_RESULT",
                            "wasBanker": true,
                        },
                        "P2": {
                            "bankerPoints": 0,
                            "regularPoints": -1,
                            "resultType": "INCORRECT_RESULT",
                            "wasBanker": false,
                        },
                        "P3": {
                            "bankerPoints": 0,
                            "regularPoints": -1,
                            "resultType": "INCORRECT_RESULT",
                            "wasBanker": false,
                        },
                    },
                    "CHEMAN": {
                        "P1": {
                            "bankerPoints": 0,
                            "regularPoints": -1,
                            "resultType": "MISSED",
                            "wasBanker": false,
                        },
                        "P2": {
                            "bankerPoints": 0,
                            "regularPoints": -1,
                            "resultType": "MISSED",
                            "wasBanker": false,
                        },
                        "P3": {
                            "bankerPoints": 0,
                            "regularPoints": -1,
                            "resultType": "MISSED",
                            "wasBanker": false,
                        },
                    }
                });
                expect(phase03?.meta.playerTotalPoints).toEqual({
                    "P1": 3,
                    "P2": -2,
                    "P3": -2,
                });
                expect(phase03?.meta.standingsSnapshotAfter[0].player.name).toEqual("Player 1");
                expect(phase03?.meta.standingsSnapshotAfter[0].points.totalPoints).toEqual(3);
                expect(phase03?.meta.standingsSnapshotAfter[0].position).toEqual(1);

                expect(phase03?.meta.standingsSnapshotAfter[1].position).toEqual(2); // Joint last
                expect(phase03?.meta.standingsSnapshotAfter[2].position).toEqual(2);

                // TODO Add week 2 scores, test other points combos
                // TODO Add test for match status changes, such as postponement
                // TODO Test that non final scores are shown in the competition tables as latest scores without points
                // TODO Add test of... move a match in week 2 a couple of days later so it makes a new phase (phase 2), check standings at end of all phases
                // TODO Test player NOT competing
                // TODO Update team groups is reflected everywhere
                // TODO Update team logo url is reflected everywhere
                // TODO Test competing meta (initial phase and initial points), use player 4
                // TODO Test multiple competitions of the same tournament




                /*

                // Week 2 scores
                await predictorHandler.putTournamentMatchScore("T1", "ARSCHE", {
                    isFinalScore: true,
                    homeGoals: 4,
                    awayGoals: 3,
                    gameMinute: null
                });
                
                await predictorHandler.putTournamentMatchScore("T1", "ASTMAN", {
                    isFinalScore: true,
                    homeGoals: 2,
                    awayGoals: 1,
                    gameMinute: null
                });

                */
            })
        })
    })
}

