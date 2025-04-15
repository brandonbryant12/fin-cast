import { HttpsProxyAgent } from 'https-proxy-agent';
import superagent from 'superagent';
import type { LLMInterface } from './base';
import type { ChatOptions, ChatResponse, PromptDefinition } from './types';
import type { CoreMessage } from 'ai';
import type * as v from 'valibot';

export interface CustomOpenAIClientConfig {
  BASE_URL: string;
  API_VERSION: string;
  BEARER_TOKEN_URL: string;
  BEARER_TOKEN_CLIENT_SECRET: string;
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
  private proxyAgent: HttpsProxyAgent<string> | undefined;

  constructor(config: CustomOpenAIClientConfig) {
    this.config = config;
    const proxyUrl = this.config.HTTPS_PROXY || this.config.HTTP_PROXY;
    if (proxyUrl) {
      this.proxyAgent = new HttpsProxyAgent(proxyUrl);
    }
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expires_at > now) {
      return this.tokenCache.access_token;
    }
    // Fetch new token
    const {
      BEARER_TOKEN_URL,
      BEARER_TOKEN_CLIENT_SECRET,
      BEARER_TOKEN_SCOPE,
      BEARER_TOKEN_USERNAME,
      BEARER_TOKEN_PASSWORD,
    } = this.config;
    try {
      let req = superagent
        .post(BEARER_TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'password',
          client_id: BEARER_TOKEN_USERNAME,
          client_secret: BEARER_TOKEN_CLIENT_SECRET,
          scope: BEARER_TOKEN_SCOPE,
          username: BEARER_TOKEN_USERNAME,
          password: BEARER_TOKEN_PASSWORD,
        });
      if (this.proxyAgent) {
        req = req.agent(this.proxyAgent);
      }
      const res = await req;
      const { access_token } = res.body;
      if (!access_token) throw new Error('No access_token in bearer token response');
      this.tokenCache = {
        access_token,
        expires_at: now + 55 * 60 * 1000,
      };
      return access_token;
    } catch (err: unknown) {
      throw new Error(`Failed to fetch bearer token: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async chatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse<string | null>> {
    const token = await this.getToken();
    const { BASE_URL, API_VERSION } = this.config;
    const url = `${BASE_URL.replace(/\/$/, '')}/chat/completions?api_version=${API_VERSION}`;
    let req = superagent
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');
    if (this.proxyAgent) {
      req = req.agent(this.proxyAgent);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = {};
    if (typeof promptOrMessages === 'string') {
      body = { messages: [{ role: 'user', content: promptOrMessages }] };
    } else {
      body = { messages: promptOrMessages };
    }
    if (options) {
      Object.assign(body, options);
    }
    try {
      const res = await req.send(body);
      const content = res.body?.choices?.[0]?.message?.content ?? null;
      return { content };
    } catch (err: unknown) {
      throw new Error(`chatCompletion failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async runPrompt<
    TInputParams extends Record<string, unknown>,
    TOutputSchema = unknown,
    O = TOutputSchema extends v.GenericSchema<infer P> ? P : string | null
  >(
    promptDef: PromptDefinition<TInputParams, TOutputSchema>,
    params: TInputParams,
    options?: ChatOptions
  ): Promise<ChatResponse<O>> {
    // Build prompt from definition
    const prompt = promptDef.template(params);
    const chatRes = await this.chatCompletion(prompt, options);
    let structuredOutput: O | undefined = undefined;
    if (promptDef.outputSchema && chatRes.content) {
      try {
        // @ts-expect-error: outputSchema may not match the type of chatRes.content
        structuredOutput = promptDef.outputSchema.parse(chatRes.content);
      } catch {
        structuredOutput = chatRes.content as O;
      }
    } else {
      structuredOutput = chatRes.content as O;
    }
    return { ...chatRes, structuredOutput };
  }
}
