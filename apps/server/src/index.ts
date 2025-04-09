import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { AIServiceFactory } from '@repo/ai';
import { createApi } from '@repo/api/server';
import { createAuth } from '@repo/auth/server';
import { createDb } from '@repo/db/client';
import { createLogger, type LogLevel } from '@repo/logger';
import { createScraper } from '@repo/webscraper';
import { createPodcast } from '@repo/podcast';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env';

const trustedOrigins = [env.PUBLIC_WEB_URL].map((url) => new URL(url).origin);

const wildcardPath = {
  ALL: '*',
  BETTER_AUTH: '/api/auth/*',
  TRPC: '/trpc/*',
} as const;


const apiKey = env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is not set. AI features may be unavailable.');
}
const llm = apiKey ? AIServiceFactory.createLLM('openai', { openai: { apiKey } }) : null; 

const db = createDb({ databaseUrl: env.SERVER_POSTGRES_URL });
const auth = createAuth({
  authSecret: env.SERVER_AUTH_SECRET,
  db,
  webUrl: env.PUBLIC_WEB_URL,
});

const logger = createLogger({
  level: (env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug')) as LogLevel,
  prettyPrint: env.NODE_ENV === 'development',
  serviceName: 'hono-server',
});

const scraper = createScraper();

// Ensure LLM is initialized before creating API
if (!llm) {
  logger.fatal('LLM service could not be initialized. Check API Key and configuration.');
  process.exit(1); // Exit if LLM is essential
}

// Create the podcast service
const podcast = createPodcast({ db, llm, logger, scraper });

// Pass the podcast service to createApi
const api = createApi({ auth, db, llm, logger, scraper, podcast });
const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

app.use(
  wildcardPath.BETTER_AUTH,
  cors({
    origin: trustedOrigins,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  }),
);

app.use(
  wildcardPath.TRPC,
  cors({
    origin: trustedOrigins,
    credentials: true,
  }),
);

app.on(['POST', 'GET'], wildcardPath.BETTER_AUTH, (c) =>
  auth.handler(c.req.raw),
);

app.use(
  wildcardPath.TRPC,
  trpcServer({
    router: api.trpcRouter,
    createContext: async (c) => {
      // Explicitly await and cast the context to 'any' to satisfy the adapter type
      // This assumes the runtime structure is compatible, despite the strict type mismatch.
      const context = await api.createTRPCContext({ headers: c.req.headers });
      return context as any; 
    },
  }),
);

app.get('/', (c) => {
  logger.info('Root path accessed');
  return c.text('Hello Hono!');
});

app.get('/healthcheck', (c) => {
  return c.text('OK');
});

const server = serve(
  {
    fetch: app.fetch,
    port: env.SERVER_PORT,
    hostname: env.SERVER_HOST,
  },
  (info) => {
    const host = info.family === 'IPv6' ? `[${info.address}]` : info.address;
    logger.info(`Hono server listening on http://${host}:${info.port}`);
  },
);

const shutdown = () => {
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Server failed to close gracefully');
    } else {
      logger.info('Server has stopped gracefully.');
    }
    process.exit(error ? 1 : 0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);