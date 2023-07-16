import { CompetitionMessage } from '../processors/messageHandlers/competition';
import { PlayerMessage } from '../processors/messageHandlers/player';
import { PlayerCompetingMessage } from '../processors/messageHandlers/playerCompeting';
import { PlayerPredictionMessage } from '../processors/messageHandlers/playerPrediction';

export type CompetitionTopicMessage = CompetitionMessage | PlayerMessage | PlayerCompetingMessage | PlayerPredictionMessage;
