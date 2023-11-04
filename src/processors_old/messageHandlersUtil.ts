import { MessageProcessor } from "./messageProcessor";
import { CompetitionMessageHandler } from "./messageHandlers/competition";
import { CompetitionRebuildResultsMessageHandler } from "./messageHandlers/competitionRebuildResults";
import { PlayerMessageHandler } from "./messageHandlers/player";
import { PlayerCompetingMessageHandler } from "./messageHandlers/playerCompeting";
import { PlayerPredictionMessageHandler } from "./messageHandlers/playerPrediction";
import { TournamentMessageHandler } from "./messageHandlers/tournament";
import { TournamentMatchScheduledMessageHandler } from "./messageHandlers/tournamentMatchScheduled";
import { TournamentMatchScoreMessageHandler } from "./messageHandlers/tournamentMatchScore";
import { TournamentRebuildTablesMessageHandler } from "./messageHandlers/tournamentRebuildTables";
import { TournamentStructureChangedMessageHandler } from "./messageHandlers/tournamentStructureChanged";
import { TournamentTeamMessageHandler } from "./messageHandlers/tournamentTeam";

export function loadMessageHandlers(processor: MessageProcessor) {
    const tmh = new TournamentMessageHandler();
    processor.registerMessageHandler(tmh);

    const ttmh = new TournamentTeamMessageHandler();
    processor.registerMessageHandler(ttmh);

    const tms = new TournamentMatchScheduledMessageHandler();
    processor.registerMessageHandler(tms);

    const tms2 = new TournamentMatchScoreMessageHandler();
    processor.registerMessageHandler(tms2);

    const tbt = new TournamentRebuildTablesMessageHandler();
    processor.registerMessageHandler(tbt);

    const tsc = new TournamentStructureChangedMessageHandler();
    processor.registerMessageHandler(tsc);

    const cmh = new CompetitionMessageHandler();
    processor.registerMessageHandler(cmh);

    const crr = new CompetitionRebuildResultsMessageHandler();
    processor.registerMessageHandler(crr);

    const pmh = new PlayerMessageHandler();
    processor.registerMessageHandler(pmh);

    const pch = new PlayerCompetingMessageHandler();
    processor.registerMessageHandler(pch);

    const pph = new PlayerPredictionMessageHandler();
    processor.registerMessageHandler(pph);

}
