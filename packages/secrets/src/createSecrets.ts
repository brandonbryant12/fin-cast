import * as https from 'node:https';
import { createLogger, type AppLogger as Logger } from '@repo/logger';
import * as superagent from 'superagent';
import type {
    CreateSecretsManagerOptions,
    SecretsManager
} from './types';

async function createAgent(options: Pick<CreateSecretsManagerOptions, 'proxy' | 'rejectUnauthorized'>): Promise<https.Agent | undefined> {
    const rejectUnauthorized = options.rejectUnauthorized ?? true;
    let agent: https.Agent | undefined;

    if (options.proxy) {
        try {
            const { HttpsProxyAgent } = await import('https-proxy-agent');
            agent = new HttpsProxyAgent(options.proxy, { rejectUnauthorized });
        } catch (err) {
            console.error('Failed to create HttpsProxyAgent:', err);
            agent = new https.Agent({ rejectUnauthorized });
        }
    } else {
        agent = new https.Agent({ rejectUnauthorized });
    }
    return agent;
}


/**
 * Fetches an OAuth token using Client Credentials flow with superagent.
 */
async function fetchOAuthToken(
    options: CreateSecretsManagerOptions,
    agent: https.Agent | undefined,
    logger?: Logger
): Promise<string> {
    const { oauthUrl, oauthClientId, oauthClientSecret } = options;
    logger?.debug('Fetching OAuth token...');

    try {
        const request = superagent
            .post(oauthUrl)
            .type('form') // Set content type to form-urlencoded
            .send({
                grant_type: 'client_credentials',
                client_id: oauthClientId,
                client_secret: oauthClientSecret,
            });

        if (agent) {
            request.agent(agent);
        }

        const response = await request;

        if (!response.ok || !response.body?.access_token) {
            logger?.error(
                { status: response.status, body: response.body, url: oauthUrl },
                'Failed to fetch OAuth token or token missing in response'
            );
            throw new Error(
                `Failed to fetch OAuth token: ${response.status} - Body: ${JSON.stringify(response.body)}`
            );
        }

        logger?.debug('Successfully fetched OAuth token.');
        return response.body.access_token;
    } catch (error: any) {
        logger?.error({ err: error, url: oauthUrl }, 'Error fetching OAuth token');
         const status = error.status;
         const responseBody = error.response?.body || error.response?.text;
         throw new Error(`OAuth token fetch failed: ${status || 'N/A'} - ${responseBody || error.message}`);
    }
}

/**
 * Creates and configures a SecretsManager instance.
 *
 * @param options Configuration options for the SecretsManager.
 * @returns An instance of SecretsManager.
 */
export function createSecretsManager(
    options: CreateSecretsManagerOptions
): SecretsManager {
    const { apiUrl } = options;
    const logger = options.logger ?? createLogger({ serviceName: 'SecretsManager' });
    let token: string | null = null;
    let agentPromise: Promise<https.Agent | undefined> | null = null;

    if (!apiUrl || !options.oauthUrl || !options.oauthClientId || !options.oauthClientSecret) {
        logger.error('Missing required options for SecretsManager (apiUrl, oauthUrl, oauthClientId, oauthClientSecret)');
        throw new Error('Missing required options for SecretsManager');
    }
    const getAgent = (): Promise<https.Agent | undefined> => {
        if (!agentPromise) {
            agentPromise = createAgent(options).catch(err => {
                logger.error({ err }, "Failed to create HTTP/S agent, proceeding without agent.");
                return undefined; // Allow fallback if agent creation fails
            });
        }
        return agentPromise;
    };

    async function getToken(): Promise<string> {
        if (token) return token;
        const agent = await getAgent();
        logger.info('No cached token, fetching new OAuth token...');
        token = await fetchOAuthToken(options, agent, logger);
        return token;
    }

    return {
        async load(): Promise<Record<string, string | undefined>> {
            logger.info(`Fetching secrets from API: ${apiUrl}`);
            const agent = await getAgent();
            try {
                const currentToken = await getToken();

                const request = superagent
                    .get(apiUrl)
                    .set('Authorization', `Bearer ${currentToken}`)
                    .set('Accept', 'application/json');

                if (agent) {
                    request.agent(agent);
                }

                const response = await request;

                if (!response.ok) {
                    logger.error(
                        { status: response.status, url: apiUrl, body: response.body || response.text },
                        'Failed to fetch secrets from API'
                    );
                    token = null; // Clear token on auth failure
                    throw new Error(
                        `Failed to fetch secrets: ${response.status} - Body: ${JSON.stringify(response.body || response.text)}`
                    );
                }

                const secrets = response.body as Record<string, string | undefined>;
                logger.info('Successfully fetched secrets from API.');
                return secrets;
            } catch (error: any) {
                logger.error({ err: error, url: apiUrl }, 'Error fetching secrets');
                 if (error.status === 401 || error.status === 403) {
                     logger.warn(`Received ${error.status} fetching secrets, invalidating token cache.`);
                     token = null;
                 }
                 const status = error.status;
                 const responseBody = error.response?.body || error.response?.text;
                 throw new Error(`Secrets fetch failed: ${status || 'N/A'} - ${responseBody || error.message}`);
            }
        },
    };
}

export type { SecretsManager, CreateSecretsManagerOptions };