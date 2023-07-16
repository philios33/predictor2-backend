

// Store each competition in a hashmap of tournament competitions

export type CompetitionState = {
    competitionId: string
    tournamentId: string
    name: string
    createdAt: string
    adminPlayerId: string

    // TODO settings for the competition like scoring structure

    // players: Array<CompetitionPlayer> 
    // Use hashset for each competition to reference the set of player ids
    // Use hashset for each player to reference what competition ids they are part of
    // This technique is known as a mirrored hashset, the players and competitions themselves are stored in single hashmaps by id.

}


