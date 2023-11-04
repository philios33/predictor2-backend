
export type ProfileImage = {
    activatedAt: string
    imageUrl: string
}

export type PlayerState = {
    playerId: string
    
    registeredAt: string
    name: string
    email: string

    profileImages: Array<ProfileImage>
}


export type PlayerPrediction = {
    score: PlayerPredictionScore | null
    isBanker: boolean
}

export type PlayerPredictionScore = {
    home: number
    away: number
}