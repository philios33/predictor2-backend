import 'graphql-import-node';

import * as EmptyTypeDefs from './schemas/empty.graphql';
import * as BaseTypeDefs from './schemas/base.graphql';

import { makeExecutableSchema } from '@graphql-tools/schema';
import resolvers from './resolversMap';
import { GraphQLSchema } from 'graphql';

const schema: GraphQLSchema = makeExecutableSchema({
    typeDefs: [EmptyTypeDefs, BaseTypeDefs],
    resolvers,
});

export default schema;
