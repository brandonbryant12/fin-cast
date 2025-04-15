import * as v from 'valibot';
import type { SupportedLLMProviders } from '@repo/llm';

const DEFAULT_SERVER_PORT = 3035;
const DEFAULT_SERVER_HOST = 'localhost';

const createPortSchema = ({ defaultPort }: { defaultPort: number }) =>
  v.pipe(
    v.optional(v.string(), `${defaultPort}`),
    v.transform((s) => parseInt(s, 10)),
    v.number(),
    v.minValue(0),
    v.maxValue(65535),
  );

const supportedLLMProviders = ['openai', 'gemini', 'anthropic'] as const;

export const envSchema = v.object({
  PORT: createPortSchema({ defaultPort: DEFAULT_SERVER_PORT }),
  HOST: v.pipe(
    v.optional(v.string(), DEFAULT_SERVER_HOST),
    v.minLength(1),
  ),
  SERVER_AUTH_SECRET: v.pipe(v.string(), v.minLength(1)),
  SERVER_POSTGRES_URL: v.optional(
    v.string(),
    'postgres://postgres:postgres@localhost:5432/postgres',
  ),

  PUBLIC_WEB_URL: v.pipe(v.string(), v.url()),

  LLM_PROVIDER: v.pipe(
    v.optional(v.picklist(supportedLLMProviders, 'LLM_PROVIDER must be one of: openai, gemini, anthropic'), 'gemini'),
    v.transform(val => val as SupportedLLMProviders)
  ),
  OPENAI_API_KEY: v.optional(v.string()),
  OPENAI_BASE_URL: v.optional(v.pipe(v.string(), v.url())),
  GEMINI_API_KEY: v.optional(v.string()),
  // ANTHROPIC_API_KEY: v.optional(v.string()),

  TTS_PROVIDER: v.optional(v.picklist(['openai'])),

  LOG_LEVEL: v.optional(v.string(), 'info'),
  NODE_ENV: v.optional(v.picklist(['development', 'production', 'test']), 'development'),
  IS_RUNNING_IN_DOCKER: v.pipe(
    v.optional(v.string(), 'false'),
    v.transform(value => typeof value === 'string' && value.toLowerCase() === 'true'),
    v.boolean()
  ),
});

export const env = v.parse(envSchema, process.env);