import { MemoryEntityStorageEngine } from "./memoryEntityStorageEngine";

const engine = new MemoryEntityStorageEngine();

describe('Basic functionality', () => {
    
    it('should return null for missing entities', async () => {
        const result = await engine.fetchEntity("TEST", ["T1"]);
        expect(result).toEqual(null);
    });

    it('should create simple entities', async () => {
        await engine.storeEntity("TEST", ["T1"], {
            hello: "hello"
        });
        const result = await engine.fetchEntity("TEST", ["T1"]);
        expect(result).toEqual({
            hello: "hello"
        });
    })

    it('should update entities', async () => {
        await engine.storeEntity("TEST", ["T1"], {
            hello: "hello",
            complex: {
                arr: [4,2,3],
                yes: true,
            }
        });
        const result = await engine.fetchEntity("TEST", ["T1"]);
        expect(result).toEqual({
            hello: "hello",
            complex: {
                arr: [4,2,3],
                yes: true,
            }
        });
    })

    it('should remove entities', async () => {
        await engine.removeEntity("TEST", ["T1"]);
        const result = await engine.fetchEntity("TEST", ["T1"]);
        expect(result).toEqual(null);
    });

    it('should return null for other missing entities', async () => {
        const result = await engine.fetchEntity("TEST", ["OTHER"]);
        expect(result).toEqual(null);
    });

    it('should support composite keys seamlessly', async () => {
        await engine.storeEntity("TEST", ["P1", "T1"], {
            playerId: "P1",
            tournamentId: "T1",
            name: "composite",
        });
        const result1 = await engine.fetchEntity("TEST", ["P1"]);
        expect(result1).toEqual(null);

        const result2 = await engine.fetchEntity("TEST", ["T1"]);
        expect(result2).toEqual(null);

        const result3 = await engine.fetchEntity("TEST", ["T1", "P1"]);
        expect(result3).toEqual(null);

        const result4 = await engine.fetchEntity("TEST", ["P1", "T1"]);
        expect(result4).toEqual({
            playerId: "P1",
            tournamentId: "T1",
            name: "composite",
        });

    });

    it('should support finding by tournament id key', async () => {

        await engine.storeEntity("TOURNAMENT", ["T2"], {
            meta: {
                tournamentId: "1",
                name: "T2"
            }
        });
        await engine.storeEntity("TOURNAMENT", ["T3"], {
            meta: {
                tournamentId: "2",
                name: "T3"
            }
        });
        await engine.storeEntity("TOURNAMENT", ["T4"], {
            meta: {
                tournamentId: "1",
                name: "T4"
            }
        });

        const results1 = await engine.findByTournamentId("TOURNAMENT", "1");
        expect(results1).toEqual([{
            meta: {
                tournamentId: "1",
                name: "T2"
            }
        },{
            meta: {
                tournamentId: "1",
                name: "T4"
            }
        }]);

        const results2 = await engine.findByTournamentId("TOURNAMENT", "2");
        expect(results2).toEqual([{
            meta: {
                tournamentId: "2",
                name: "T3"
            }
        }]);
    });
})