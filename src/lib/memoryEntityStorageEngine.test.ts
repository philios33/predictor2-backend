import { MemoryEntityStorageEngine } from "./memoryEntityStorageEngine";

const engine = new MemoryEntityStorageEngine();

export default function() {
    describe('Memory Entity Storage Engine', () => {
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
                lookupId: "G1",
                meta: {
                    tournamentId: "T2",
                    name: "T2"
                }
            });
            await engine.storeEntity("TOURNAMENT", ["T3"], {
                lookupId: "G2",
                meta: {
                    tournamentId: "T3",
                    name: "T3"
                }
            });
            await engine.storeEntity("TOURNAMENT", ["T4"], {
                lookupId: "G1",
                meta: {
                    tournamentId: "T4",
                    name: "T4"
                }
            });

            const results1 = await engine.findByLookupId("TOURNAMENT", "G1");
            expect(results1).toEqual([{
                lookupId: "G1",
                meta: {
                    tournamentId: "T2",
                    name: "T2"
                }
            },{
                lookupId: "G1",
                meta: {
                    tournamentId: "T4",
                    name: "T4"
                }
            }]);

            const results2 = await engine.findByLookupId("TOURNAMENT", "G2");
            expect(results2).toEqual([{
                lookupId: "G2",
                meta: {
                    tournamentId: "T3",
                    name: "T3"
                }
            }]);
        });

        it('should not mutate values', async () => {
            await engine.storeEntity("TEST", ["T1"], {
                hello: "hello",
            });
            const result = await engine.fetchEntity("TEST", ["T1"]) as any;
            expect(result).toEqual({
                hello: "hello",
            });

            // Mutate without saving
            result.hello = "MUTATED";

            const result2 = await engine.fetchEntity("TEST", ["T1"]) as any;
            expect(result2).toEqual({
                hello: "hello",
            });

        });

    })
}