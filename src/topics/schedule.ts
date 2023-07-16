import { TournamentMessage } from '../processors/messageHandlers/tournament';
import { TournamentTeamMessage } from '../processors/messageHandlers/tournamentTeam';
import { TournamentMatchScheduledMessage } from '../processors/messageHandlers/tournamentMatchScheduled';
import { TournamentMatchScoreMessage } from '../processors/messageHandlers/tournamentMatchScore';

export type ScheduleTopicMessage = TournamentMessage | TournamentTeamMessage | TournamentMatchScheduledMessage | TournamentMatchScoreMessage;
