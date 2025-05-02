import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { createApi } from '@repo/api/server';
import { createAuth } from '@repo/auth/server';
import { createDb } from '@repo/db/client';
import { createLLMService, type LLMServiceConfig } from '@repo/llm';
import { createPodcastService } from '@repo/podcast';
import { createTtsService } from '@repo/tts';
import { createScraper } from '@repo/webscraper';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { setupEnv, type Env } from './env';

async function startServer() {
  const { env, logger } = await setupEnv();
  logger.info('Environment loaded, starting server setup...');

  function initializeLLMService(env: Env) {
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
      case 'custom-openai':
        if (
          !env.CUSTOM_OPENAI_URL ||
          !env.CUSTOM_OPENAI_BEARER_TOKEN_URL ||
          !env.CUSTOM_OPENAI_BEARER_TOKEN_CLIENT_ID ||
          !env.CUSTOM_OPENAI_BEARER_TOKEN_SCOPE ||
          !env.CUSTOM_OPENAI_BEARER_TOKEN_USERNAME ||
          !env.CUSTOM_OPENAI_BEARER_TOKEN_PASSWORD
        ) {
          logger.error('LLM_PROVIDER is "custom-openai", but one or more required environment variables are not set.');
          return null;
        }
        llmConfig = {
          provider: 'custom-openai',
          options: {
            BASE_URL: env.CUSTOM_OPENAI_URL,
            BEARER_TOKEN_URL: env.CUSTOM_OPENAI_BEARER_TOKEN_URL,
            BEARER_TOKEN_CLIENT_ID: env.CUSTOM_OPENAI_BEARER_TOKEN_CLIENT_ID,
            BEARER_TOKEN_SCOPE: env.CUSTOM_OPENAI_BEARER_TOKEN_SCOPE,
            BEARER_TOKEN_USERNAME: env.CUSTOM_OPENAI_BEARER_TOKEN_USERNAME,
            BEARER_TOKEN_PASSWORD: env.CUSTOM_OPENAI_BEARER_TOKEN_PASSWORD,
            HTTP_PROXY: env.HTTP_PROXY,
            HTTPS_PROXY: env.HTTPS_PROXY,
          },
        };
        break;
      default:
         logger.error(`Unsupported LLM_PROVIDER value: ${env.LLM_PROVIDER}`);
         return null;
    }

    try {
      const llmService = createLLMService(llmConfig);
      logger.info(`Successfully initialized LLM service with provider: ${env.LLM_PROVIDER}`);
      return llmService;
    } catch (error) {
      logger.error({ err: error, provider: env.LLM_PROVIDER }, 'Failed to initialize LLM service');
      return null;
    }
  }

  function initializeTTSService(env: Env) {
    logger.info(`Initializing TTS service based on TTS_PROVIDER: ${env.TTS_PROVIDER}`);
    try {
      switch (env.TTS_PROVIDER) {
        case 'azure': {
          if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_WS_URL) {
            logger.error('TTS_PROVIDER is "azure", but AZURE_SPEECH_KEY or AZURE_SPEECH_WS_URL is not set.');
            return null;
          }
          return createTtsService({
            provider: 'azure',
            options: {
              speechKey: env.AZURE_SPEECH_KEY,
              wsUrl: env.AZURE_SPEECH_WS_URL,
            },
          });
        }
        case 'openai':
        default: {
          const apiKey = env.OPENAI_API_KEY;
          if (!apiKey) {
            logger.error('TTS_PROVIDER is "openai", but OPENAI_TTS_API_KEY or OPENAI_API_KEY is not set.');
            return null;
          }
          return createTtsService({
            provider: 'openai',
            options: { apiKey },
          });
        }
      }
    } catch (error) {
        logger.error({ err: error, provider: env.TTS_PROVIDER }, 'Failed to initialize TTS service');
        return null;
    }
  }

  const llm = initializeLLMService(env);
  const db = createDb({ databaseUrl: env.SERVER_POSTGRES_URL });
  const auth = createAuth({ 
    authSecret: env.SERVER_AUTH_SECRET, 
    db, 
    webUrl: env.PUBLIC_WEB_URL 
  });
  const scraper = createScraper({ 
    logger: logger.child({ service: 'scraper' }), 
    proxy: env.HTTPS_PROXY ?? env.HTTP_PROXY, 
    allowUnsignedCerts: env.NODE_TLS_REJECT_UNAUTHORIZED === '0' 
  });
  const tts = initializeTTSService(env);

  if (!llm) {
    logger.fatal('LLM service could not be initialized. Exiting.');
    process.exit(1);
  }
  if (!tts) {
    logger.fatal('TTS service could not be initialized. Exiting.');
    process.exit(1);
  }

  const podcast = createPodcastService({ 
    db, 
    llm, 
    logger: logger.child({ service: 'podcast' }), 
    scraper, 
    tts, 
    isRunningInDocker: env.IS_RUNNING_IN_DOCKER 
  });
  const api = createApi({ auth, db, logger: logger.child({ service: 'api' }), podcast, tts });

  const app = new Hono<{ Variables: { user: any; session: any; }}>({
    strict: false
  });

  app.use('*', honoLogger((message: string, ...rest: string[]) => logger.info({ honoLog: { message, rest } }, 'Hono request')));

  const trustedOrigins = [env.PUBLIC_WEB_URL].map((url) => new URL(url).origin);
  const wildcardPath = { ALL: '*', BETTER_AUTH: '/api/auth/*', TRPC: '/trpc/*' } as const;

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

  app.on(['POST', 'GET'], wildcardPath.BETTER_AUTH, (c) => auth.handler(c.req.raw));

  app.use(
    wildcardPath.TRPC,
    trpcServer({ 
      router: api.trpcRouter, 
      createContext: async (opts, c) => {
        const headers = c.req.header();
        const context = await api.createTRPCContext({ headers: headers as any });
        return context as any;
      }
    })
  );

  app.get('/', (c) => c.text('Hello Hono!'));
  app.get('/healthcheck', (c) => c.text('OK'));

  const server = serve(
    { fetch: app.fetch, port: env.SERVER_PORT, hostname: env.SERVER_HOST },
    (info) => {
      const host = info.family === 'IPv6' ? `[${info.address}]` : info.address;
      logger.info(`Hono server listening on http://${host}:${info.port}`);
    }
  );

  const shutdown = () => {
    logger.info('Shutdown signal received. Closing server...');
    server.close((error) => {
      if (error) {
        logger.error({ err: error }, 'Server failed to close gracefully');
        process.exit(1);
      } else {
        logger.info('Server has stopped gracefully.');
        process.exit(0);
      }
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM' , shutdown);
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});