import { PlayerPrediction } from "./player"
import { LeagueTableSnapshot } from "./tables"
import { MatchScore, TournamentPhase, TournamentTeam } from "./tournament"

export type CompetitionPlayer = {
    playerId: string
    name: string
}

export type PlayerStandingsRow = {
    position: number
    player: CompetitionPlayer
    points: PlayerPointsRow

    previousRankingPosition?: number
}

export type PlayerPointsRow = {
    predicted: number
    missed: number

    correctScoresTotal: number
    correctGDTotal: number
    correctOutcomeTotal: number
    correctTotal: number
    incorrectTotal: number
    regularPoints: number
    bankerPoints: number
    totalPoints: number
}

export type PlayerPredictionResult = {
    resultType: "MISSED" | "CORRECT_SCORE" | "CORRECT_GD" | "CORRECT_RESULT" | "INCORRECT_RESULT"
    regularPoints: number
    bankerPoints: number
    wasBanker: boolean
}

export type PhaseMatch = {
    matchId: string

    homeTeam: TournamentTeam
    awayTeam: TournamentTeam

    scheduledKickoff: Date
    hasKickedOff: boolean
    stage: string
    group: string

    knownBankerMultiplier: null | number

    latestScore: null | MatchScore
}

export type PhaseResult = {
    details: TournamentPhase
    stageGroupLeagueSnapshotBefore: Record<string, Record<string, LeagueTableSnapshot>>
    // If a stage is starting during this phase, we put a snapshot of all group tables here

    // topFourSnapshotBefore: null | LeagueTable
    matchPlayerPredictions: Record<string, Record<string, PlayerPrediction>>
    matchPlayerPoints: Record<string, Record<string, PlayerPredictionResult>>
    playerTotalPoints: Record<string, number>
    standingsSnapshotAfter: Array<PlayerStandingsRow>
}

export type ResultsPage = {
    competitionId: string
    pageNum: number
    isLastPage: boolean

    phases: Array<PhaseResult>
}