import memoryEntityStorageEngineTest from "./memoryEntityStorageEngine.test"
import memoryJobBusEngineTest from "./memoryJobBusEngine.test"
import predictorActionsHandlerTest from "./predictorActionsHandler.test"
import predictorBasicRebuildTest from "./predictorBasicRebuild.test"
import predictorCompetitionRebuildTest from "./predictorCompetitionRebuild.test";
import entityStorageV2 from "./entityStorageV2.test";
import { MemoryEntityStorageEngineV2 } from "./memoryEntityStorageEngineV2";

describe('sequentially run tests', () => {
    
    memoryEntityStorageEngineTest();
    memoryJobBusEngineTest();
    predictorActionsHandlerTest();
    predictorBasicRebuildTest();
    predictorCompetitionRebuildTest();
    

    entityStorageV2(new MemoryEntityStorageEngineV2());


});