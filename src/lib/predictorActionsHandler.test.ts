import { instantiateMemorySystemForTestPurposes } from "../lib/memoryTestHarness";
import { PredictorStorage } from "../lib/predictorStorage";
import { JobsConsumer } from "../processors/jobsConsumer";
import { PredictorActionsHandler } from "./predictorActionsHandler";

export default function() {
    describe('Predictor Actions Tests', () => {
        
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

        describe('Basic entity storing and fetching', () => {
            
            it('should create a player in storage', async () => {
                await predictorHandler.putPlayer("P1", "Phil", "phil@code67.com");
                const player = await predictorStorage.fetchPlayer("P1");
                expect(player).toEqual({
                    entityType: "PLAYER",
                    partitionKey: "PLAYER_P1",
                    lookupId: null,
                    meta: {
                        playerId: "P1",
                        name: "Phil",
                        email: "phil@code67.com",
                    }
                });
            })

            it('should create a tournament in storage', async () => {
                await predictorHandler.putTournament("T1", "Phils Tournament");
                const tournament = await predictorStorage.fetchTournament("T1");
                expect(tournament).toEqual({
                    entityType: "TOURNAMENT",
                    partitionKey: "TOURNAMENT_T1",
                    lookupId: null,
                    meta: {
                        tournamentId: "T1",
                        name: "Phils Tournament",
                    }
                });
            })

            it('should create a competition in storage', async () => {
                await predictorHandler.putCompetition("C1", "T1", "Phils Competition", "P1");
                const competition = await predictorStorage.fetchCompetition("C1");
                expect(competition).toEqual({
                    entityType: "COMPETITION",
                    partitionKey: "COMPETITION_C1",
                    lookupId: "T1",
                    meta: {
                        competitionId: "C1",
                        tournamentId: "T1",
                        name: "Phils Competition",
                        adminPlayerId: "P1",
                    }
                });
            })

            it('should fail to create a competition with bad references', async () => {
                const f = async () => {
                    await predictorHandler.putCompetition("C2", "T1", "Phils Competition", "P2");
                }
                expect(f).rejects.toThrow("Unknown player id: P2");
                const f2 = async () => {
                    await predictorHandler.putCompetition("C2", "T2", "Phils Competition", "P1");
                }
                expect(f2).rejects.toThrow("Unknown tournament id: T2");
            })

            it('should store competing meta', async () => {
                await predictorHandler.playerCompeting("P1", "C1", 1, 0);
                const competing = await predictorStorage.fetchCompetitionPlayerCompeting("C1", "P1");
                expect(competing).toEqual({
                    entityType: "COMPETITION-PLAYER-COMPETING",
                    partitionKey: "COMPETITION-PLAYER-COMPETING_C1_P1",
                    lookupId: "C1",
                    meta: {
                        playerId: "P1",
                        competitionId: "C1",
                        initialPhase: 1,
                        initialPoints: 0,
                    }
                });
            })

            /*
            it('should also store indexed lists of competitors and competitions properly', async () => {
                const competitions = await predictorStorage.fetchPlayerCompetitions("P1");
                expect(competitions).toEqual({
                    entityType: "PLAYER-COMPETITIONS",
                    partitionKey: "PLAYER-COMPETITIONS_P1",
                    meta: {
                        playerId: "P1",
                        competitions: {
                            "C1": true
                        }
                    }
                });

                const competitors = await predictorStorage.fetchCompetitionPlayers("C1");
                expect(competitors).toEqual({
                    entityType: "COMPETITION-PLAYERS",
                    partitionKey: "COMPETITION-PLAYERS_C1",
                    meta: {
                        competitionId: "C1",
                        players: {
                            "P1": {
                                initialPhase: 1,
                                initialPoints: 0,
                            }
                        }
                    }
                })
            })
            */

            it('should update the competing meta appropriately', async () => {
                await predictorHandler.playerCompeting("P1", "C1", 4, 10);
                const competing = await predictorStorage.fetchCompetitionPlayerCompeting("C1", "P1");
                expect(competing).toEqual({
                    entityType: "COMPETITION-PLAYER-COMPETING",
                    partitionKey: "COMPETITION-PLAYER-COMPETING_C1_P1",
                    lookupId: "C1",
                    meta: {
                        playerId: "P1",
                        competitionId: "C1",
                        initialPhase: 4,
                        initialPoints: 10,
                    }
                });

                /*
                const competitors = await predictorStorage.fetchCompetitionPlayers("C1");
                expect(competitors).toEqual({
                    entityType: "COMPETITION-PLAYERS",
                    partitionKey: "COMPETITION-PLAYERS_C1",
                    meta: {
                        competitionId: "C1",
                        players: {
                            "P1": {
                                initialPhase: 4,
                                initialPoints: 10,
                            }
                        }
                    }
                })
                */
            })

            it('should support clearing the competing entity', async () => {
                await predictorHandler.playerNotCompeting("P1", "C1");

                const competing = await predictorStorage.fetchCompetitionPlayerCompeting("C1", "P1");
                expect(competing).toEqual(null);

                /*
                const competitions = await predictorStorage.fetchPlayerCompetitions("P1");
                expect(competitions).toEqual({
                    entityType: "PLAYER-COMPETITIONS",
                    partitionKey: "PLAYER-COMPETITIONS_P1",
                    meta: {
                        playerId: "P1",
                        competitions: {
                            
                        }
                    }
                });

                const competitors = await predictorStorage.fetchCompetitionPlayers("C1");
                expect(competitors).toEqual({
                    entityType: "COMPETITION-PLAYERS",
                    partitionKey: "COMPETITION-PLAYERS_C1",
                    meta: {
                        competitionId: "C1",
                        players: {
                            
                        }
                    }
                })
                */
            })

            it('should support putting new teams', async () => {
                await predictorHandler.putTournamentTeam("T1", "ARS", "Arsenal", "Arsenal", "", ["PL"]);
                const arsenal = await predictorStorage.fetchTournamentTeam("T1", "ARS");
                expect(arsenal).toEqual({
                    entityType: "TOURNAMENT-TEAM",
                    partitionKey: "TOURNAMENT-TEAM_T1_ARS",
                    lookupId: "T1",
                    meta: {
                        tournamentId: "T1",
                        teamId: "ARS",
                        name: "Arsenal",
                        shortName: "Arsenal",
                        logo48: "",
                        groupIds: ["PL"],
                    }
                })

                await predictorHandler.putTournamentTeam("T1", "AST", "Aston Villa", "Villa", "", ["PL"]);
            })

            it('should support putting a new match', async () => {
                await predictorHandler.putTournamentMatch("T1", "ARSAST", "Week 1", "ARS", "AST", { isoDate: "2023-01-01T15:00:00Z" }, "PL", "MATCH_ON", null);
                const match = await predictorStorage.fetchTournamentMatch("T1", "ARSAST");
                expect(match).toEqual({
                    entityType: "TOURNAMENT-MATCH",
                    partitionKey: "TOURNAMENT-MATCH_T1_ARSAST",
                    lookupId: "T1",
                    meta: {
                        tournamentId: "T1",
                        matchId: "ARSAST",
                        homeTeamId: "ARS",
                        awayTeamId: "AST",
                        stageId: "Week 1",
                        scheduledKickoff: {
                            isoDate: "2023-01-01T15:00:00Z"
                        },
                        groupId: "PL",
                        status: "MATCH_ON",
                        statusMessage: null,
                    }
                })
            })

            /*
            it('should be able to fetch matches by tournamentId', async() => {
                const result = await predictorStorage.fetchTournamentMatchesByTournamentId("T1");
                expect(result.length).toEqual(1);
            });
            */

            it('should support putting a players prediction', async () => {
                await predictorHandler.putPlayerPrediction("P1", "T1", "ARSAST", {
                    isBanker: false,
                    score: {
                        home: 1,
                        away: 3,
                    }
                });
                const prediction = await predictorStorage.fetchPrediction("T1", "ARSAST", "P1");
                expect(prediction).toEqual({
                    entityType: "PREDICTION",
                    partitionKey: "PREDICTION_T1_ARSAST_P1",
                    lookupId: null,
                    meta: {
                        tournamentId: "T1",
                        matchId: "ARSAST",
                        playerId: "P1",
                        prediction: {
                            isBanker: false,
                            score: {
                                home: 1,
                                away: 3,
                            }
                        }
                    }
                })
            })

            it('should support putting a match score', async () => {
                await predictorHandler.putTournamentMatchScore("T1", "ARSAST", {
                    isFinalScore: true,
                    homeGoals: 0,
                    awayGoals: 2,
                    gameMinute: null,
                });
                const matchScore = await predictorStorage.fetchTournamentMatchScore("T1", "ARSAST");
                expect(matchScore).toEqual({
                    entityType: "TOURNAMENT-MATCH-SCORE",
                    partitionKey: "TOURNAMENT-MATCH-SCORE_T1_ARSAST",
                    lookupId: null,
                    meta: {
                        tournamentId: "T1",
                        matchId: "ARSAST",
                        score: {
                            isFinalScore: true,
                            homeGoals: 0,
                            awayGoals: 2,
                            gameMinute: null,
                        }
                    }
                });
            })
        })
    })
}
