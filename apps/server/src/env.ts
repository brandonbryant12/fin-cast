import { createLogger, type AppLogger } from '@repo/logger';
import { createSecretsManager } from '@repo/secrets';
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

const supportedLLMProviders = ['openai', 'gemini', 'anthropic', 'custom-openai'] as const;
const supportedTTSProviders = ['openai', 'azure'] as const;

export const envSchema = v.object({
  SERVER_PORT: createPortSchema({ defaultPort: DEFAULT_SERVER_PORT }),
  SERVER_HOST: v.pipe(
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
    v.optional(v.picklist(supportedLLMProviders, 'LLM_PROVIDER must be one of: openai, gemini, custom-openai'), 'gemini'),
    v.transform(val => val as SupportedLLMProviders)
  ),
  OPENAI_API_KEY: v.optional(v.string()),
  OPENAI_BASE_URL: v.optional(v.pipe(v.string(), v.url())),
  GEMINI_API_KEY: v.optional(v.string()),

  TTS_PROVIDER: v.pipe(
    v.optional(v.picklist(supportedTTSProviders, 'TTS_PROVIDER must be one of: openai, azure'), 'openai'),
    v.transform(val => val as 'openai' | 'azure')
  ),
  OPENAI_TTS_API_KEY: v.optional(v.string()),
  AZURE_SPEECH_KEY: v.optional(v.string()),
  AZURE_SPEECH_WS_URL: v.optional(v.string()),

  LOG_LEVEL: v.optional(v.string(), 'info'),
  NODE_ENV: v.optional(v.picklist(['development', 'production', 'test']), 'development'),
  IS_RUNNING_IN_DOCKER: v.pipe(
    v.optional(v.string(), 'false'),
    v.transform(value => typeof value === 'string' && value.toLowerCase() === 'true'),
    v.boolean()
  ),
  CUSTOM_OPENAI_URL: v.optional(v.string()),
  CUSTOM_OPENAI_BEARER_TOKEN_URL: v.optional(v.string()),
  CUSTOM_OPENAI_BEARER_TOKEN_CLIENT_ID: v.optional(v.string()),
  CUSTOM_OPENAI_BEARER_TOKEN_SCOPE: v.optional(v.string()),
  CUSTOM_OPENAI_BEARER_TOKEN_USERNAME: v.optional(v.string()),
  CUSTOM_OPENAI_BEARER_TOKEN_PASSWORD: v.optional(v.string()),
  HTTP_PROXY: v.optional(v.string()),
  HTTPS_PROXY: v.optional(v.string()),

  NODE_TLS_REJECT_UNAUTHORIZED: v.optional(
    v.picklist(['0', '1'], 'must be "0" or "1"'),
    '1'
  ),
  // Secrets Manager Config - Required if secretsManager is 'enabled'
  SECRETS_API_URL: v.optional(v.pipe(v.string(), v.url())),
  SECRETS_OAUTH_URL: v.optional(v.pipe(v.string(), v.url())),
  SECRETS_OAUTH_CLIENT_ID: v.optional(v.string()),
  SECRETS_OAUTH_CLIENT_SECRET: v.optional(v.string()),
  // Flag to enable/disable secrets manager
  SECRETS_MANAGER_ENABLED: v.pipe(
    v.optional(v.string(), 'false'),
    v.transform(value => typeof value === 'string' && value.toLowerCase() === 'true'),
    v.boolean()
  ),
});




async function loadEnvInternal(logger: AppLogger) {
    logger.info('Loading environment variables...');
    let rawEnv: Record<string, string | undefined> = { ...process.env };

    const secretsManagerEnabled = process.env?.SECRETS_MANAGER_ENABLED?.toLowerCase() === 'true';

    if (secretsManagerEnabled) {
        logger.info('SecretsManager is enabled. Attempting to fetch secrets...');

        const apiUrl = process.env.SECRETS_API_URL;
        const oauthUrl = process.env.SECRETS_OAUTH_URL;
        const oauthClientId = process.env.SECRETS_OAUTH_CLIENT_ID;
        const oauthClientSecret = process.env.SECRETS_OAUTH_CLIENT_SECRET;

        if (!apiUrl || !oauthUrl || !oauthClientId || !oauthClientSecret) {
             logger.error('Missing required environment variables for SecretsManager: SECRETS_API_URL, SECRETS_OAUTH_URL, SECRETS_OAUTH_CLIENT_ID, SECRETS_OAUTH_CLIENT_SECRET');
            
        } else {
            try {
                const secretsManager = createSecretsManager({
                    apiUrl,
                    oauthUrl,
                    oauthClientId,
                    oauthClientSecret,
                    proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
                    rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '1',
                    logger: logger.child({ service: 'SecretsManagerClient' })
                });
                const apiSecrets = await secretsManager.load();
                logger.info(`Fetched ${Object.keys(apiSecrets).length} secrets from API.`);
                // Merge fetched secrets, giving them precedence over process.env
                rawEnv = {
                    ...rawEnv,
                    ...apiSecrets,
                };
            } catch (error) {
                logger.error({ err: error }, 'Failed to fetch secrets from SecretsManager. Proceeding with existing environment variables only.');
            }
        }
    } else {
        logger.info('SecretsManager is disabled (SECRETS_MANAGER_ENABLED is not "true"). Using local environment variables only.');
    }

    try {
        const parsedEnv = v.parse(envSchema, rawEnv);
        logger.info('Successfully loaded and validated environment variables.');
        return parsedEnv;
    } catch (error: any) {
         logger.error({ errors: error.issues }, 'Failed to validate environment variables.');
         if (error instanceof v.ValiError) {

            const messages = error.issues.map(issue => `${issue.path?.map((p: any) => p.key).join('.') || 'root'}: ${issue.message} (received: ${JSON.stringify(issue.input)})`);
            console.error('Environment validation errors:\n' + messages.join('\n'));
         }
         throw new Error('Environment validation failed.'); 
    }
}

export async function setupEnv() {
  const logger = createLogger({ 
    level: process.env.LOG_LEVEL as any || 'info', 
    prettyPrint: process.env.NODE_ENV !== 'production' 
  });
  const env = await loadEnvInternal(logger);
  return { env, logger };
}

export type Env = v.InferOutput<typeof envSchema>;