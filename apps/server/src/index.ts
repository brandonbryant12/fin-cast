import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { createTtsService } from '@repo/tts';
import { createApi } from '@repo/api/server';
import { createAuth } from '@repo/auth/server';
import { createDb } from '@repo/db/client';
import { createLLMService, type LLMServiceConfig } from '@repo/llm';
import { createLogger, type LogLevel } from '@repo/logger';
import { createPodcastService } from '@repo/podcast';
import { createScraper } from '@repo/webscraper';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env';

const logger = createLogger({
  level: (env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug')) as LogLevel,
  prettyPrint: env.NODE_ENV === 'development',
  serviceName: 'hono-server',
});

function initializeLLMService() {
  let llmConfig: LLMServiceConfig;

  logger.info(`Initializing LLM service based on LLM_PROVIDER: ${env.LLM_PROVIDER}`);

  switch (env.LLM_PROVIDER) {
    case 'openai':
      if (!env.OPENAI_API_KEY) {
        logger.error('LLM_PROVIDER is "openai", but OPENAI_API_KEY is not set.');
        return null;
      }
      llmConfig = {
        provider: 'openai',
        options: {
          apiKey: env.OPENAI_API_KEY,
          baseURL: env.OPENAI_BASE_URL,
        },
      };
      break;
    case 'gemini':
      if (!env.GEMINI_API_KEY) {
        logger.error('LLM_PROVIDER is "gemini", but GEMINI_API_KEY is not set.');
        return null;
      }
      llmConfig = {
        provider: 'gemini',
        options: {
          apiKey: env.GEMINI_API_KEY,
        },
      };
      break;
    // case 'anthropic':
    //   if (!env.ANTHROPIC_API_KEY) {
    //      logger.error('LLM_PROVIDER is "anthropic", but ANTHROPIC_API_KEY is not set.');
    //      return null;
    //   }
    //   llmConfig = {
    //     provider: 'anthropic',
    //     options: { apiKey: env.ANTHROPIC_API_KEY },
    //   };
    //   break;
    default:
       logger.error(`Unsupported LLM_PROVIDER value: ${env.LLM_PROVIDER}`);
       return null;
  }


  const llmService = createLLMService(llmConfig);
  logger.info(`Successfully initialized LLM service with provider: ${env.LLM_PROVIDER}`);
  return llmService;

}

const llm = initializeLLMService();
const db = createDb({ databaseUrl: env.SERVER_POSTGRES_URL });
const auth = createAuth({
  authSecret: env.SERVER_AUTH_SECRET,
  db,
  webUrl: env.PUBLIC_WEB_URL,
});
const scraper = createScraper();

const tts = env.OPENAI_API_KEY
  ? createTtsService({ provider: 'openai', options: { apiKey: env.OPENAI_API_KEY } })
  : null;

if (!llm) {
  throw new Error('LLM service could not be initialized. Features requiring LLM may be unavailable.');
}

if (!tts) {
  throw new Error('TTS service could not be initialized. Features requiring TTS may be unavailable.');
}

const podcast = createPodcastService({
  db,
  llm,
  logger,
  scraper,
  tts,
  isRunningInDocker: env.IS_RUNNING_IN_DOCKER
});

const api = createApi({ auth, db, logger, podcast, tts });

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

const trustedOrigins = [env.PUBLIC_WEB_URL].map((url) => new URL(url).origin);

const wildcardPath = {
  ALL: '*',
  BETTER_AUTH: '/api/auth/*',
  TRPC: '/trpc/*',
} as const;

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