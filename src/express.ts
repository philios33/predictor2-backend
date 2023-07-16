// Just a basic RESTful server that produces events in to the system

import express from 'express';
import cors from 'cors';
import graphqlExpress, { startupContext } from './graphql/express';
import { getEventSourceConfig, getServiceConfig } from './config';
import { Server } from 'http';
import { handleGracefulShutdownSignals } from './shutdown';

const eventsSourceConfig = getEventSourceConfig();
const serviceConfig = getServiceConfig();

const app = express();

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('This is the server')
});

let server: Server | null = null;

(async () => {
    try {
        console.log("Starting up context...");
        const graphQLContext = await startupContext(eventsSourceConfig);
        console.log("Done");
        app.use('/graphql', graphqlExpress(graphQLContext));

        server = app.listen(serviceConfig.listenPort, () => {
            console.log("GraphQL Server listening on port: " + serviceConfig.listenPort);
        });
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();

handleGracefulShutdownSignals(() => {
    return new Promise((resolve, reject) => {
        if (server !== null) {
            server.close((e) => {
                if (e) {
                    reject(e);
                } else {
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
});
