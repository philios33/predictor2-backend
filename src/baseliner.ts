import { GraphQLClient } from 'graphql-request';
import { addCompetition, addPlayer, addPlayerCompeting, addTeam, addTournament, setMatchScore, setScheduledMatch, setUserPrediction } from './baselinerLib';
import { ScheduledStatus } from './graphql/generated';

// Just call some of the graphql mutations to create events
const client = new GraphQLClient("http://localhost:8082/graphql");

// Run these sequentially
(async () => {
    try {
        console.log("Running baseliner...");

        await addTournament(client, {
            tournamentId: "PL2223",
            name: "Premier League 2022-23",
        });
        console.log("Added tournament");

        await addTeam(client, {
            tournamentId: "PL2223",
            teamId: "ARS",
            name: "Arsenal",
            shortName: "ARS",
            logo48: "arsenal.jpg",
            groups: ["PL"],
        });
        console.log("Added team");

        await addTeam(client, {
            tournamentId: "PL2223",
            teamId: "AST",
            name: "Aston Villa",
            shortName: "AST",
            logo48: "villa.jpg",
            groups: ["PL"],
        });
        console.log("Added team");

        await addTeam(client, {
            tournamentId: "PL2223",
            teamId: "CHE",
            name: "Chelsea",
            shortName: "CHE",
            logo48: "chelsea.jpg",
            groups: ["PL"],
        });
        console.log("Added team");

        await addTeam(client, {
            tournamentId: "PL2223",
            teamId: "MAC",
            name: "Manchester City",
            shortName: "MAC",
            logo48: "citeh.jpg",
            groups: ["PL"],
        });
        console.log("Added team");

        await setScheduledMatch(client, {
            tournamentId: "PL2223",
            matchId: "ARSAST",
            homeTeamId: "ARS",
            awayTeamId: "AST",
            groupId: "PL",
            scheduledKickoff: "2023-04-31T16:00:00Z",
            stageId: "Game Week 1",
            status: ScheduledStatus.MatchOn,
        });
        console.log("Added match");

        await setScheduledMatch(client, {
            tournamentId: "PL2223",
            matchId: "CHEMAC",
            homeTeamId: "CHE",
            awayTeamId: "MAC",
            groupId: "PL",
            scheduledKickoff: "2023-04-31T16:00:00Z",
            stageId: "Game Week 1",
            status: ScheduledStatus.MatchOn,
        });
        console.log("Added match");

        await addPlayer(client, {
            playerId: "PHIL",
            name: "Phil",
            email: "phil@code67.com",
        });
        console.log("Added player");

        await addCompetition(client, {
            competitionId: "1234",
            tournamentId: "PL2223",
            adminPlayerId: "PHIL",
            name: "My dirty league",
        });
        console.log("Added competition");

        await addPlayerCompeting(client, {
            competitionId: "1234",
            playerId: "PHIL",
        });
        console.log("Added player competing");

        await setUserPrediction(client, {
            playerId: "PHIL",
            tournamentId: "PL2223",
            matchId: "ARSAST",
            homeGoals: 0,
            awayGoals: 2,
            isBanker: true,
        });
        console.log("Added player prediction");

        await setUserPrediction(client, {
            playerId: "PHIL",
            tournamentId: "PL2223",
            matchId: "CHEMAC",
            homeGoals: 1,
            awayGoals: 1,
            isBanker: false,
        });
        console.log("Added player prediction");

        await setMatchScore(client, {
            tournamentId: "PL2223",
            matchId: "ARSAST",
            homeGoals: 0,
            awayGoals: 2,
            isFinalScore: true,
        });
        console.log("Added match score");

        console.log("Completed baselining, don't ever run this again");
        process.exit(0);

    } catch(e: any) {
        console.error(e);
        process.exit(1);
    }
})();
