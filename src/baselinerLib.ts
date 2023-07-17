import { GraphQLClient, gql } from "graphql-request";
import { MatchScoreInput, ClearMatchScoreInput, ScheduledMatchInput, UserPredictionInput, ClearUserPredictionInput, TournamentInput, PlayerInput, CompetitionInput, PlayerCompetingInput, TournamentTeamInput } from "./graphql/generated";

export async function addTournament(client: GraphQLClient, input: TournamentInput) {
    const document = gql`
        mutation($data: TournamentInput!) {
            addTournament(data: $data)
        }
    `
    await client.request(document, {data:input});
}

export async function addTeam(client: GraphQLClient, input: TournamentTeamInput) {
    const document = gql`
        mutation($data: TournamentTeamInput!) {
            addTeam(data: $data)
        }
    `
    await client.request(document, {data:input});
}

export async function addPlayer(client: GraphQLClient, input: PlayerInput) {
    const document = gql`
        mutation($data: PlayerInput!) {
            addPlayer(data: $data)
        }
    `
    await client.request(document, {data:input});
}

export async function addCompetition(client: GraphQLClient, input: CompetitionInput) {
    const document = gql`
        mutation($data: CompetitionInput!) {
            addCompetition(data: $data)
        }
    `
    await client.request(document, {data:input});
}

export async function addPlayerCompeting(client: GraphQLClient, input: PlayerCompetingInput) {
    const document = gql`
        mutation($data: PlayerCompetingInput!) {
            addPlayerCompeting(data: $data)
        }
    `
    await client.request(document, {data:input});
}





export async function setMatchScore(client: GraphQLClient, input: MatchScoreInput) {
    const document = gql`
        mutation($data: MatchScoreInput!) {
            setMatchScore(data: $data)
        }
    `
    await client.request(document, {data:input});
}

export async function clearMatchScore(client: GraphQLClient, input: ClearMatchScoreInput) {
    const document = gql`
        mutation($data: ClearMatchScoreInput!) {
            clearMatchScore(data: $data)
        }
    `
    await client.request(document, {data:input});
}

export async function setScheduledMatch(client: GraphQLClient, input: ScheduledMatchInput) {
    const document = gql`
        mutation($data: ScheduledMatchInput!) {
            setScheduledMatch(data: $data)
        }
    `
    await client.request(document, {data:input});
}

export async function setUserPrediction(client: GraphQLClient, input: UserPredictionInput) {
    const document = gql`
        mutation($data: UserPredictionInput!) {
            setUserPrediction(data: $data)
        }
    `
    await client.request(document, {data:input});
}

export async function clearUserPrediction(client: GraphQLClient, input: ClearUserPredictionInput) {
    const document = gql`
        mutation($data: ClearUserPredictionInput!) {
            clearUserPrediction(data: $data)
        }
    `
    await client.request(document, {data:input});
}

