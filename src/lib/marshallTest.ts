import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const mapValue = {
    one: 1,
    two: 2,
};

console.log({
    M: marshall(mapValue, {convertTopLevelContainer: false}),
});