import { TournamentTeam } from "./tournament"

export type LeagueTableSnapshot = {
    table: LeagueTable
    snapshotAt: Date | null // Setting null here means the table is the latest most up to date table
    description: string
}

export type LeagueTableRow = {
    team: TournamentTeam
    rank: null | number
    stats: HomeAwayPoints
}
export type LeagueTable = Array<LeagueTableRow>

export type HomeAwayPoints = {
    played: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
    points: number
    pointsAgainst: {[key: string]: number}
    awayGoalsAgainst: {[key: string]: number}
    penalties: Array<Penalty>
}

export type Penalty = {
    deduction: number
    reason: string
}

export type SnapshotsByGroup = Record<string, LeagueTableSnapshot>;

export type TournamentTablesState = {
    generatedAt: string
    stages: Record<string, SnapshotsByGroup>
    latest: SnapshotsByGroup
}
