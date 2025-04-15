import https from 'node:https';
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
      BEARER_TOKEN_CLIENT_ID,
      BEARER_TOKEN_SCOPE,
      BEARER_TOKEN_USERNAME,
      BEARER_TOKEN_PASSWORD,
    } = this.config;
    try {
      const payload = [
        `client_id=${BEARER_TOKEN_CLIENT_ID}`,
        `scope=${BEARER_TOKEN_SCOPE}`,
        `username=${BEARER_TOKEN_USERNAME}`,
        `password=${BEARER_TOKEN_PASSWORD}`,
        'grant_type=password'
      ].join('&');
      let req = superagent
        .post(BEARER_TOKEN_URL)
        .type('form')
        .send(payload)
        .disableTLSCerts();
      if (this.proxyAgent) {
        req = req.agent(this.proxyAgent);
      } else {
        req = req.agent(new https.Agent({ rejectUnauthorized: false }));
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
    // Always instruct the LLM to return JSON
    let promptWithJsonInstruction: string | CoreMessage[];
    if (typeof promptOrMessages === 'string') {
      promptWithJsonInstruction = `${promptOrMessages}\n\nRespond ONLY in valid JSON.`;
    } else if (Array.isArray(promptOrMessages)) {
      // Prepend a system message if not already present
      const systemMsg: CoreMessage = { role: 'system', content: 'Respond ONLY in valid JSON.' };
      if (promptOrMessages.length > 0 && promptOrMessages[0]!.role === 'system') {
        const firstMsg = promptOrMessages[0];
        if (firstMsg && typeof firstMsg.content === 'string') {
          promptWithJsonInstruction = [
            {
              ...firstMsg,
              content: `${firstMsg.content}\n\nRespond ONLY in valid JSON.` as any,
            },
            ...promptOrMessages.slice(1)
          ];
        } else {
          // If content is not a string, do not modify it
          promptWithJsonInstruction = promptOrMessages;
        }
      } else {
        promptWithJsonInstruction = [systemMsg, ...promptOrMessages];
      }
    } else {
      promptWithJsonInstruction = promptOrMessages;
    }
    const token = await this.getToken();
    const { BASE_URL, API_VERSION } = this.config;
    const url = `${BASE_URL.replace(/\/$/, '')}/chat/completions?api_version=${API_VERSION}`;
    let req = superagent
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .disableTLSCerts();
    if (this.proxyAgent) {
      req = req.agent(this.proxyAgent);
    } else {
      req = req.agent(new (await import('node:https')).Agent({ rejectUnauthorized: false }));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = {};
    if (typeof promptWithJsonInstruction === 'string') {
      body = { messages: [{ role: 'user', content: promptWithJsonInstruction }] };
    } else {
      body = { messages: promptWithJsonInstruction };
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
    // Build prompt from definition and always instruct JSON output
    const prompt = `${promptDef.template(params)}\n\nRespond ONLY in valid JSON.`;
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
