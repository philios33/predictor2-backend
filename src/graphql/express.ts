import { createHandler } from 'graphql-http/lib/use/express';

// Exports the middleware for use in the express server
// import * as express_graphql from 'express-graphql';
// import { NextFunction, Request, Response } from 'express';

import schema from './schemaMap';
import { MongoRedisTopicProducer } from 'streamable-topic';
import { ScheduleTopicMessage } from '../topics/schedule';
import { CompetitionTopicMessage } from '../topics/competition';
import { OperationContext } from 'graphql-http';
import { EventSourceConfig } from '../config';


export type GraphQLContext = {
    scheduleTopic: MongoRedisTopicProducer<ScheduleTopicMessage>,
    competitionTopic: MongoRedisTopicProducer<CompetitionTopicMessage>,
}


export async function startupContext(config: EventSourceConfig): Promise<GraphQLContext> {
    /*
    const mongoUrl = "mongodb://localhost:27017";
    const databaseName = "predictor";
    const redisHost = "localhost";
    const redisPort = 6379;
    */
    const ct = new MongoRedisTopicProducer<CompetitionTopicMessage>(config.mongoUrl, config.databaseName, "competitions", config.redisHost, config.redisPort);
    await ct.start();
    const st = new MongoRedisTopicProducer<ScheduleTopicMessage>(config.mongoUrl, config.databaseName, "schedule", config.redisHost, config.redisPort);
    await st.start();
    
    return {
        scheduleTopic: st,
        competitionTopic: ct,
    }
}

async function loadContextFromRequest(req: any, context: GraphQLContext): Promise<GraphQLContext> {
    console.log("Using context");
    return context;
}

export default function(context: GraphQLContext) {

    /*
    return async (req: Request, res: Response, next: NextFunction) => {
        
        express_graphql.graphqlHTTP({
            schema: schema,
            graphiql: true,
            context: await loadContextFromRequest(req, context),
        }).apply(null, [req, res]);
    }
    */

    return createHandler({
        schema: schema,
        context: async (req, params) => {
            return await loadContextFromRequest(req, context);
        },
        formatError: (e: any) => {
            console.error(e);
            return e;
        }
    })
}