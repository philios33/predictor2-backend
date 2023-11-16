import { instantiateMemorySystemForTestPurposes } from "../lib/memoryTestHarness";
import { PredictorStorage } from "../lib/predictorStorage";
import { JobsConsumer } from "../processors/jobsConsumer";
import { PredictorActionsHandler } from "./predictorActionsHandler";
import { PredictorJobBus } from "./predictorJobBus";

export default function() {
    describe('Predictor Basic Rebuild Tests', () => {
        
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

        describe('Basic tournament rebuilding', () => {
            
            it('should build tournament structure and phase tables', async () => {

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

                const time1 = new Date("2023-01-01T00:00:00Z");
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
                    "PREDICTOR-EVENT-REBUILT-TOURNAMENT-STRUCTURE_T1", // Only 1 structure rebuild will actually occur
                ]);
                
                // Week 1 scores only
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
                

                const time2 = new Date("2023-01-01T16:00:00Z"); // Note, after phase 0, but before phase 1 starts
                // So only tournament phase 0 should update since phase 1 is not active yet
                const jobs2 = await jobsConsumer.processAllJobsNow(time2);
                expect(jobs2).toEqual([
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH-SCORE_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH-SCORE_T1",
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_0",
                    // "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_1",
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_0",
                    // "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_1",
                    "PREDICTOR-EVENT-REBUILT-TOURNAMENT-PHASE-TABLE_T1_0", // This is phase 0 table updating, but it wont lead to any competition events yet without a competition
                    // "PREDICTOR-EVENT-REBUILT-TOURNAMENT-PHASE-TABLE_T1_1" // This is phase 1 table updating, but it wont lead to any competition events yet without a competition
                ]);
                
                // Check tournament structure
                const structure = await predictorStorage.fetchTournamentStructure("T1");
                
                // Expect the 4 teams
                expect(Object.values(structure?.meta.groupTeams.PL || []).length).toEqual(4);

                // Check the stage phase mapping works
                expect(structure?.meta.phaseBeforeStageStarts).toEqual({
                    "Week 2": 0, // Because stage "Week 2" starts after phase 0 completes
                    // The phase table after phase 0 will be used to calculate bankers for "Week 2" stage
                });
                
                // Check 2 tournament phase structures
                const phase0 = await predictorStorage.fetchTournamentPhaseStructure("T1", "0");
                expect(phase0).toEqual({
                    entityType: "TOURNAMENT-PHASE-STRUCTURE", 
                    partitionKey: "TOURNAMENT-PHASE-STRUCTURE_T1_0",
                    lookupId: "T1",
                    meta: {
                        tournamentId: "T1",
                        phaseId: "0", 
                        earliestMatchKickoff: {isoDate: "2023-01-01T14:00:00Z"}, 
                        includedStages: ["Week 1"], 
                        latestMatchKickoff: {isoDate: "2023-01-01T14:00:00Z"}, 
                        matches: [
                            {
                                tournamentId: "T1",
                                matchId: "ARSAST",
                                groupId: "PL", 
                                homeTeam: {"groupIds": ["PL"], "logo48": "", "name": "Arsenal", "shortName": "Arsenal", "teamId": "ARS", "tournamentId": "T1"}, 
                                homeTeamId: "ARS", 
                                awayTeam: {"groupIds": ["PL"], "logo48": "", "name": "Aston Villa", "shortName": "Villa", "teamId": "AST", "tournamentId": "T1"}, 
                                awayTeamId: "AST",
                                scheduledKickoff: {isoDate: "2023-01-01T14:00:00Z"}, 
                                stageId: "Week 1", 
                                status: "MATCH_ON", 
                                statusMessage: null, 
                                
                            }, {
                                tournamentId: "T1",
                                matchId: "CHEMAN",
                                groupId: "PL", 
                                homeTeam: {"groupIds": ["PL"], "logo48": "", "name": "Chelsea", "shortName": "Chelsea", "teamId": "CHE", "tournamentId": "T1"}, 
                                homeTeamId: "CHE", 
                                awayTeam: {"groupIds": ["PL"], "logo48": "", "name": "Manchester City", "shortName": "City", "teamId": "MAN", "tournamentId": "T1"}, 
                                awayTeamId: "MAN", 
                                scheduledKickoff: {isoDate: "2023-01-01T14:00:00Z"}, 
                                stageId: "Week 1", 
                                status: "MATCH_ON", 
                                statusMessage: null, 
                            }
                        ], 
                        startingStages: ["Week 1"], 
                    },
                });

                const phase1 = await predictorStorage.fetchTournamentPhaseStructure("T1", "1");
                expect(phase1).toEqual({
                    entityType: "TOURNAMENT-PHASE-STRUCTURE",
                    partitionKey: "TOURNAMENT-PHASE-STRUCTURE_T1_1",
                    lookupId: "T1",
                    meta: {
                        tournamentId: "T1",
                        phaseId: "1",
                        earliestMatchKickoff: {isoDate: "2023-02-01T14:00:00Z"}, 
                        includedStages: ["Week 2"], 
                        latestMatchKickoff: {isoDate: "2023-02-01T14:00:00Z"}, 
                        matches: [
                            {
                                tournamentId: "T1",
                                matchId: "ARSCHE", 
                                groupId: "PL", 
                                homeTeam: {"groupIds": ["PL"], "logo48": "", "name": "Arsenal", "shortName": "Arsenal", "teamId": "ARS", "tournamentId": "T1"}, 
                                homeTeamId: "ARS",
                                awayTeam: {"groupIds": ["PL"], "logo48": "", "name": "Chelsea", "shortName": "Chelsea", "teamId": "CHE", "tournamentId": "T1"}, 
                                awayTeamId: "CHE",  
                                scheduledKickoff: {isoDate: "2023-02-01T14:00:00Z"}, 
                                stageId: "Week 2", 
                                status: "MATCH_ON", 
                                statusMessage: null,
                            }, {
                                tournamentId: "T1",
                                matchId: "ASTMAN",
                                groupId: "PL", 
                                homeTeam: {"groupIds": ["PL"], "logo48": "", "name": "Aston Villa", "shortName": "Villa", "teamId": "AST", "tournamentId": "T1"}, 
                                homeTeamId: "AST", 
                                awayTeam: {"groupIds": ["PL"], "logo48": "", "name": "Manchester City", "shortName": "City", "teamId": "MAN", "tournamentId": "T1"},
                                awayTeamId: "MAN", 
                                scheduledKickoff: {isoDate: "2023-02-01T14:00:00Z"}, 
                                stageId: "Week 2", 
                                status: "MATCH_ON", 
                                statusMessage: null, 
                            }
                        ], 
                        startingStages: ["Week 2"], 
                    }, 
                });

                // Check 4 tournament match phases
                const matchPhase1 = await predictorStorage.fetchTournamentMatchPhase("T1", "ARSAST");
                expect(matchPhase1?.meta.phaseId).toEqual("0");
                const matchPhase2 = await predictorStorage.fetchTournamentMatchPhase("T1", "CHEMAN");
                expect(matchPhase2?.meta.phaseId).toEqual("0");
                const matchPhase3 = await predictorStorage.fetchTournamentMatchPhase("T1", "ARSCHE");
                expect(matchPhase3?.meta.phaseId).toEqual("1");
                const matchPhase4 = await predictorStorage.fetchTournamentMatchPhase("T1", "ASTMAN");
                expect(matchPhase4?.meta.phaseId).toEqual("1");

                // Check tournament phase 0 table
                const tables = await predictorStorage.fetchTournamentTablesPostPhase("T1", "0");
                expect(tables?.meta.cumGroupTeamPoints["PL"]["ARS"].home.losses).toEqual(1);
                expect(tables?.meta.cumGroupTeamPoints["PL"]["ARS"].home.points).toEqual(0);
                expect(tables?.meta.cumGroupTeamPoints["PL"]["AST"].away.wins).toEqual(1);
                expect(tables?.meta.cumGroupTeamPoints["PL"]["AST"].away.points).toEqual(3);
                expect(tables?.meta.cumGroupTeamPoints["PL"]["CHE"].home.draws).toEqual(1);
                expect(tables?.meta.cumGroupTeamPoints["PL"]["CHE"].home.points).toEqual(1);
                expect(tables?.meta.cumGroupTeamPoints["PL"]["MAN"].away.draws).toEqual(1);
                expect(tables?.meta.cumGroupTeamPoints["PL"]["MAN"].away.points).toEqual(1);

                expect(tables?.meta.matchScores).toEqual({
                    ARSAST: {
                        homeGoals: 1,
                        awayGoals: 3,
                        gameMinute: null,
                        isFinalScore: true
                    },
                    CHEMAN: {
                        homeGoals: 2,
                        awayGoals: 2,
                        gameMinute: null,
                        isFinalScore: true
                    }
                });

                expect(tables?.meta.latestTables["PL"].table[0].rank).toEqual(1);
                expect(tables?.meta.latestTables["PL"].table[0].team.teamId).toEqual("AST");
                expect(tables?.meta.latestTables["PL"].table[0].stats.points).toEqual(3);

                expect(tables?.meta.latestTables["PL"].table[1].rank).toEqual(2);
                expect(tables?.meta.latestTables["PL"].table[1].team.teamId).toEqual("MAN");
                expect(tables?.meta.latestTables["PL"].table[1].stats.points).toEqual(1);

                expect(tables?.meta.latestTables["PL"].table[2].rank).toEqual(3); // Note: Not 2nd, because ManC has two away goals against them
                expect(tables?.meta.latestTables["PL"].table[2].team.teamId).toEqual("CHE");
                expect(tables?.meta.latestTables["PL"].table[2].stats.points).toEqual(1);

                expect(tables?.meta.latestTables["PL"].table[3].rank).toEqual(4);
                expect(tables?.meta.latestTables["PL"].table[3].team.teamId).toEqual("ARS");
                expect(tables?.meta.latestTables["PL"].table[3].stats.points).toEqual(0);

                // Now we start phase 1, but the tables wont be generated for the phase unless it is started, so this needs to handle that
                await predictorHandler.triggerKickoffsChanged("T1");
                const time3 = new Date("2023-02-01T15:00:00Z");
                const jobs3 = await jobsConsumer.processAllJobsNow(time3);
                expect(jobs3).toEqual([
                    "PREDICTOR-EVENT-POSSIBLE-KICKOFFS_T1",
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_0",
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_1",
                    "PREDICTOR-EVENT-REBUILT-TOURNAMENT-PHASE-TABLE_T1_1", // Phase 1 changed
                ]);

                // Check tournament phase 1 table hasn't changed yet

                const phase1Table = await predictorStorage.fetchTournamentTablesPostPhase("T1", "1");
                expect(phase1Table?.meta.latestTables.PL.table[0].team.name).toBe("Aston Villa");
                expect(phase1Table?.meta.latestTables.PL.table[0].rank).toBe(1);
                expect(phase1Table?.meta.latestTables.PL.table[0].stats.points).toBe(3);

                expect(phase1Table?.meta.latestTables.PL.table[1].team.name).toBe("Manchester City");
                expect(phase1Table?.meta.latestTables.PL.table[1].rank).toBe(2);
                expect(phase1Table?.meta.latestTables.PL.table[1].stats.points).toBe(1);
                
                expect(phase1Table?.meta.latestTables.PL.table[2].team.name).toBe("Chelsea");
                expect(phase1Table?.meta.latestTables.PL.table[2].rank).toBe(3);
                expect(phase1Table?.meta.latestTables.PL.table[2].stats.points).toBe(1);

                expect(phase1Table?.meta.latestTables.PL.table[3].team.name).toBe("Arsenal");
                expect(phase1Table?.meta.latestTables.PL.table[3].rank).toBe(4);
                expect(phase1Table?.meta.latestTables.PL.table[3].stats.points).toBe(0);

                // Update phase 1 (week 2) scores

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

                const time4 = new Date("2023-02-01T18:00:00Z");
                const jobs4 = await jobsConsumer.processAllJobsNow(time4);
                expect(jobs4).toEqual([
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH-SCORE_T1",
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH-SCORE_T1",
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_1", // Only phase 1 tables (not phase 0 tables)
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_1",
                    "PREDICTOR-EVENT-REBUILT-TOURNAMENT-PHASE-TABLE_T1_1", // Phase 1 table changed
                ]);

                const phase0Table2 = await predictorStorage.fetchTournamentTablesPostPhase("T1", "0");
                expect(phase0Table2?.meta.latestTables.PL.table[0].team.name).toBe("Aston Villa");
                expect(phase0Table2?.meta.latestTables.PL.table[0].rank).toBe(1);
                expect(phase0Table2?.meta.latestTables.PL.table[0].stats.points).toBe(3);
                expect(phase0Table2?.meta.latestTables.PL.table[0].stats.goalsFor).toBe(3);

                const phase1Table2 = await predictorStorage.fetchTournamentTablesPostPhase("T1", "1");
                expect(phase1Table2?.meta.latestTables.PL.table[0].team.name).toBe("Aston Villa");
                expect(phase1Table2?.meta.latestTables.PL.table[0].rank).toBe(1);
                expect(phase1Table2?.meta.latestTables.PL.table[0].stats.points).toBe(6);
                expect(phase1Table2?.meta.latestTables.PL.table[0].stats.goalsFor).toBe(5);

                // GO back and fix a score from phase 0
                await predictorHandler.putTournamentMatchScore("T1", "ARSAST", {
                    isFinalScore: true,
                    homeGoals: 1,
                    awayGoals: 4,
                    gameMinute: null
                });

                const time5 = new Date("2023-02-01T18:00:00Z");
                const jobs5 = await jobsConsumer.processAllJobsNow(time5);
                expect(jobs5).toEqual([
                    "PREDICTOR-EVENT-PUT-TOURNAMENT-MATCH-SCORE_T1",
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_0",
                    "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_1", // Both phases
                    "PREDICTOR-EVENT-REBUILT-TOURNAMENT-PHASE-TABLE_T1_0", // Phase 0 table changed
                    "PREDICTOR-EVENT-REBUILT-TOURNAMENT-PHASE-TABLE_T1_1", // Phase 1 table changed
                ]);

                const phase0Table3 = await predictorStorage.fetchTournamentTablesPostPhase("T1", "0");
                expect(phase0Table3?.meta.latestTables.PL.table[0].team.name).toBe("Aston Villa");
                expect(phase0Table3?.meta.latestTables.PL.table[0].stats.goalsFor).toBe(4);

                const phase1Table3 = await predictorStorage.fetchTournamentTablesPostPhase("T1", "1");
                expect(phase1Table3?.meta.latestTables.PL.table[0].team.name).toBe("Aston Villa");
                expect(phase1Table3?.meta.latestTables.PL.table[0].stats.goalsFor).toBe(6);
                
                
            })
        })
    })
}

