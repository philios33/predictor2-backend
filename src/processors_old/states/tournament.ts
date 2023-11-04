export type TournamentTeam = {
    teamId: string
    name: string
    shortName: string // Unique 3 letter country code, or team code
    logo48: string // Some reference to some known logo asset that is 48px wide
    groups: Array<string> // List of all relevant group codes that this team participates in this tournament
                    // E.g. Could be just ["PL"] or ["Group A", "Last 16", "Quarter Finals"]
}

export type TournamentState = {
    tournamentId: string

    name: string
    createdAt: string
    // registeredTeams: Record<string, TournamentTeam> // Now a map
    // stageIds: Array<string> // Now a set 
}

export type TournamentMatch = {
    matchId: string

    homeTeamId: string
    awayTeamId: string

    scheduledKickoff: string
    stageId: string
    groupId: string
    status:  "MATCH_ON" | "MATCH_POSTPONED" | "MATCH_ABANDONED" | "MATCH_CANCELLED" | "MATCH_DELETED"
    statusMessage: string | null

    score: MatchScore | null
    knownBankerMultiplier: number | null
}

export type TournamentMatchWithTeams = TournamentMatch & {
    homeTeam: TournamentTeam
    awayTeam: TournamentTeam
}

export type MatchScore = {
    homeGoals: number
    awayGoals: number
    extraTime? : {
        homeGoals: number
        awayGoals: number
        penalties? : {
            homeGoals: number
            awayGoals: number
        }
    }
    isFinalScore: boolean
    gameMinute: string | null
}

export type TournamentPhase = {
    phaseId: string
    numberOfMatches: number
    earliestMatchKickoff: string
    lastMatchKickoff: string
    includedStages: Array<string>
    startingStages: Array<string>
    
    matches: Array<TournamentMatchWithTeams> 
    // Note: TournamentMatch has no score on purpose so we don't have to rebuild the tournament structure phases every time a match changes its score.
    // Note: Using TournamentMatchWithTeams now, which includes a snapshot of the team in the phase.  
    // If the teams update anything, a full structure rebuild will be needed, but this is rare enough.
}



export type TournamentPhasesState = {
    generatedAt: string
    phases: Array<TournamentPhase>
    groupTeams: Record<string, Record<string, TournamentTeam>>
}
