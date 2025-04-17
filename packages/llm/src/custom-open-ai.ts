import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import superagent from 'superagent';
import * as v from 'valibot';
import type { ChatOptions, ChatResponse, PromptDefinition } from './types';
import type { CoreMessage } from 'ai';
import { BaseLLM, type LLMInterface } from './base_llm';

export interface CustomOpenAIClientConfig {
  BASE_URL: string;
  API_VERSION: string;
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

export class CustomOpenAIClient extends BaseLLM implements LLMInterface {
  private config: CustomOpenAIClientConfig;
  private tokenCache: TokenCache | null = null;
  private proxyAgent?: HttpsProxyAgent<string>;

  constructor(config: CustomOpenAIClientConfig) {
    super();
    this.config = config;
    const proxyUrl = config.HTTPS_PROXY || config.HTTP_PROXY;
    if (proxyUrl) this.proxyAgent = new HttpsProxyAgent(proxyUrl);
  }

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

  protected async _executeModel(
    request: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>> {
      const token = await this.getToken();
      let req = superagent
        .post(this.config.BASE_URL)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .disableTLSCerts();
      req = this.proxyAgent ? req.agent(this.proxyAgent) : req.agent(new https.Agent({ rejectUnauthorized: false }));

      const body = typeof request === 'string'
          ? { messages: [{ role: 'user', content: request }] }
          : { messages: request };

      const { ...apiOptions } = options ?? {};
      if (Object.keys(apiOptions).length > 0) {
          Object.assign(body, apiOptions);
      }

      try {
        const res = await req.send(body);
        const rawContent = res.body?.choices?.[0]?.message?.content ?? null;
        const usage = undefined;
        return { content: rawContent, usage: usage, error: undefined, structuredOutput: undefined };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Custom OpenAI Client] Error: ${msg}`, { error: err });
        return { content: null, error: `Custom OpenAI Client failed: ${msg}`, structuredOutput: undefined, usage: undefined };
      }
  }
}