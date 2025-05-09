import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import superagent from 'superagent';
import type { ChatOptions, ChatResponse } from './types';
import type { CoreMessage } from 'ai';
import { type LLMInterface } from './types';

export interface CustomOpenAIClientConfig {
  BASE_URL: string;
  BEARER_TOKEN_URL: string;
  BEARER_TOKEN_CLIENT_ID: string;
  BEARER_TOKEN_SCOPE: string;
  BEARER_TOKEN_USERNAME: string;
  BEARER_TOKEN_PASSWORD: string;
  HTTP_PROXY?: string;
  HTTPS_PROXY?: string;
}

interface TokenCache {
  access_token: string;
  expires_at: number;
}

export class CustomOpenAIClient implements LLMInterface {
  private config: CustomOpenAIClientConfig;
  private tokenCache: TokenCache | null = null;
  private proxyAgent?: HttpsProxyAgent<string>;

  constructor(config: CustomOpenAIClientConfig) {
    this.config = config;
    const proxyUrl = config.HTTPS_PROXY || config.HTTP_PROXY;
    if (proxyUrl) this.proxyAgent = new HttpsProxyAgent(proxyUrl);
  }

  /* ------------------------------------------------------ */
  /*  Bearer‑token helper                                    */
  /* ------------------------------------------------------ */
  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expires_at > now) return this.tokenCache.access_token;

    const {
      BEARER_TOKEN_URL,
      BEARER_TOKEN_CLIENT_ID,
      BEARER_TOKEN_SCOPE,
      BEARER_TOKEN_USERNAME,
      BEARER_TOKEN_PASSWORD,
    } = this.config;

    const payload = [
      `client_id=${BEARER_TOKEN_CLIENT_ID}`,
      `scope=${BEARER_TOKEN_SCOPE}`,
      `username=${BEARER_TOKEN_USERNAME}`,
      `password=${BEARER_TOKEN_PASSWORD}`,
      'grant_type=password',
    ].join('&');

    let req = superagent.post(BEARER_TOKEN_URL).type('form').send(payload).disableTLSCerts();
    req = this.proxyAgent ? req.agent(this.proxyAgent) : req.agent(new https.Agent({ rejectUnauthorized: false }));

    const res = await req;
    const { access_token } = res.body;
    if (!access_token) throw new Error('No access_token in bearer token response');

    this.tokenCache = { access_token, expires_at: now + 55 * 60 * 1000 };
    return access_token;
  }

  public async chatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>> {
    const token = await this.getToken();

    let actualMessages: CoreMessage[];
    const finalOptions = { ...(options ?? {}) };

    if (typeof promptOrMessages === 'string') {
      actualMessages = [{ role: 'user', content: promptOrMessages }];
      if (finalOptions.systemPrompt) {
        actualMessages.unshift({ role: 'system', content: finalOptions.systemPrompt });
      }
    } else {
      actualMessages = promptOrMessages;
    }

    const apiRequestBody = { messages: actualMessages };

    try {
      let req = superagent
        .post(this.config.BASE_URL)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .disableTLSCerts();
      req = this.proxyAgent ? req.agent(this.proxyAgent) : req.agent(new https.Agent({ rejectUnauthorized: false }));

      const res = await req.send(apiRequestBody);
      const rawContent = res.body?.choices?.[0]?.message?.content ?? null;
      return { content: rawContent, error: undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Custom OpenAI Client] Error: ${msg}`, { error: err });
      return { content: null, error: `Custom OpenAI Client failed: ${msg}` };
    }
  }
}