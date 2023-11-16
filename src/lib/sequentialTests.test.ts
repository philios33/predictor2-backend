import memoryEntityStorageEngineTest from "./memoryEntityStorageEngine.test"
import memoryJobBusEngineTest from "./memoryJobBusEngine.test"
import predictorActionsHandlerTest from "./predictorActionsHandler.test"
import predictorBasicRebuildTest from "./predictorBasicRebuild.test"
import predictorCompetitionRebuildTest from "./predictorCompetitionRebuild.test";

describe('sequentially run tests', () => {
    memoryEntityStorageEngineTest();
    memoryJobBusEngineTest();
    predictorActionsHandlerTest();
    predictorBasicRebuildTest();
    predictorCompetitionRebuildTest();
    // TODO. Next add a competition test to check the reactive logic

});