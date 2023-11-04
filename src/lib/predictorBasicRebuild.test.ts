import { instantiateMemorySystemForTestPurposes } from "../lib/memoryTestHarness";
import { PredictorStorage } from "../lib/predictorStorage";
import { JobsConsumer } from "../processors/jobsConsumer";
import { PredictorActionsHandler } from "./predictorActionsHandler";
import { PredictorJobBus } from "./predictorJobBus";

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
            await predictorHandler.putTournamentTeam("T1", "ARS", "Arsenal", "Arsenal", "", ["PL"], "NEW_TEAM");
            await predictorHandler.putTournamentTeam("T1", "AST", "Aston Villa", "Villa", "", ["PL"], "NEW_TEAM");
            await predictorHandler.putTournamentTeam("T1", "CHE", "Chelsea", "Chelsea", "", ["PL"], "NEW_TEAM");
            await predictorHandler.putTournamentTeam("T1", "MAN", "Manchester City", "City", "", ["PL"], "NEW_TEAM");
            // Week 1
            await predictorHandler.putTournamentMatch("T1", "ARSAST", "Week 1", "ARS", "AST", { isoDate: "2023-01-01T14:00:00Z" }, "PL", "MATCH_ON", null);
            await predictorHandler.putTournamentMatch("T1", "CHEMAN", "Week 1", "CHE", "MAN", { isoDate: "2023-01-01T14:00:00Z" }, "PL", "MATCH_ON", null);
            // Week 2
            await predictorHandler.putTournamentMatch("T1", "ARSCHE", "Week 2", "ARS", "CHE", { isoDate: "2023-02-01T14:00:00Z" }, "PL", "MATCH_ON", null);
            await predictorHandler.putTournamentMatch("T1", "ASTMAN", "Week 2", "AST", "MAN", { isoDate: "2023-02-01T14:00:00Z" }, "PL", "MATCH_ON", null);
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

            const processAt = new Date("2023-01-20T12:00:00Z");
            const result = await jobsConsumer.processAllJobsNow(processAt);
            
            expect(result).toEqual([
                "REBUILD-TOURNAMENT-STRUCTURE_T1",
                "REBUILD-TOURNAMENT-STRUCTURE_T1",
                "REBUILD-TOURNAMENT-STRUCTURE_T1",
                "REBUILD-TOURNAMENT-STRUCTURE_T1",
                "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_0",
                "REBUILD-TOURNAMENT-TABLE-POST-PHASE_T1_1",
            ]);
            
            // Check tournament structure
            const structure = await predictorStorage.fetchTournamentStructure("T1");
            
            // Expect the 4 teams
            expect(Object.values(structure?.meta.groupTeams.PL || []).length).toEqual(4);

            // Expect consistent phase structure hashes
            expect(structure?.meta.contentHashOfPhases).toEqual([
                '181d102b0cc6d205113d7f1c9fd03fe76b06243f',
                '09cdeb0a64f659dc3dcebb2b10d2d7231921e297',
            ]);

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
                meta: {
                    tournamentId: "T1",
                    phaseId: "0", 
                    earliestMatchKickoff: {isoDate: "2023-01-01T14:00:00Z"}, 
                    includedStages: ["Week 1"], 
                    lastMatchKickoff: {isoDate: "2023-01-01T14:00:00Z"}, 
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
                meta: {
                    tournamentId: "T1",
                    phaseId: "1",
                    earliestMatchKickoff: {isoDate: "2023-02-01T14:00:00Z"}, 
                    includedStages: ["Week 2"], 
                    lastMatchKickoff: {isoDate: "2023-02-01T14:00:00Z"}, 
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

            expect(tables?.meta.isPhaseStarted).toEqual(true);
            expect(tables?.meta.isPhaseCompleted).toEqual(true);

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

            // Check tournament phase 1 table
            const tables2 = await predictorStorage.fetchTournamentTablesPostPhase("T1", "1");
            expect(tables2?.meta.isPhaseStarted).toEqual(false);
            expect(tables2?.meta.isPhaseCompleted).toEqual(false);
            
        })
    })
})

