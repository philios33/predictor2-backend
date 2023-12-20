import { IEntityStorageEngineV2 } from "./entityStorageV2";

export default function(implementation: IEntityStorageEngineV2) {
    describe('Memory Entity Storage Engine V2', () => {
        it('should give null for a missing entity', async () => {
            const result = await implementation.fetchEntity("123");
            expect(result).toEqual(null);
        });
        it('should put and fetch', async () => {
            await implementation.putEntity({
                entityId: "123",
                test: true,
                nums: [1,2,3,4],
                hello: "Phil",
                map: {}
            });
            const result = await implementation.fetchEntity("123");
            expect(result).toEqual({
                entityId: "123",
                test: true,
                nums: [1,2,3,4],
                hello: "Phil",
                map: {}
            });
        });
        it('should not overwrite if already exists', async () => {
            await implementation.putEntityIfNotExists({
                entityId: "123",
                test: false,
                nums: [5,6,7],
                hello: "Not Phil",
            });
            const result = await implementation.fetchEntity("123");
            expect(result).toEqual({
                entityId: "123",
                test: true,
                nums: [1,2,3,4],
                hello: "Phil",
                map: {}
            });
        });
        
        it('should support generic updates', async () => {
            await implementation.updateEntity("123", {
                test: false,
                hello: "you",
                nums: [1,2]
            });
            const result = await implementation.fetchEntity("123");
            expect(result).toEqual({
                entityId: "123",
                test: false,
                nums: [1,2],
                hello: "you",
                map: {}
            });
            await implementation.updateEntity("123", {
                test: true,
                hello: "Phil",
                nums: [1,2,3,4]
            });
        });

        it('should set mapped values', async () => {
            await implementation.setMapKeyValueOfEntity<{test:boolean}>("123", "map", "1", {
                test: true
            });
            const result = await implementation.fetchEntity("123");
            expect(result).toEqual({
                entityId: "123",
                test: true,
                nums: [1,2,3,4],
                hello: "Phil",
                map: {
                    "1": {
                        test: true
                    }
                }
            });
        });
        it('and remove them again', async () => {
            await implementation.removeMapKeyValueOfEntity("123", "map", "1");
            const result = await implementation.fetchEntity("123");
            expect(result).toEqual({
                entityId: "123",
                test: true,
                nums: [1,2,3,4],
                hello: "Phil",
                map: { }
            });
        });
        it('should delete entities', async () => {
            await implementation.deleteEntity("123");
            const result = await implementation.fetchEntity("123");
            expect(result).toEqual(null);
        });
        it('should error on set mapped values for missing entity', async () => {
            const f = async () => {
                await implementation.setMapKeyValueOfEntity<{test:boolean}>("1234", "map", "1", {
                    test: true
                });
            }
            expect(f).rejects.toThrow();
        });
        it('should error on remove mapped values for missing entity', async () => {
            const f = async () => {
                await implementation.removeMapKeyValueOfEntity("1234", "map", "1");
            }
            expect(f).rejects.toThrow();
        });
        
    })
}
