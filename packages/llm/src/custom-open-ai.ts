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

  /* ------------------------------------------------------ */
  /*  _executeModel (replaces chatCompletion)             */
  /* ------------------------------------------------------ */
  protected async _executeModel(
    request: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>> {

    /* HTTP call */
    const token = await this.getToken();
    let req = superagent
      .post(this.config.BASE_URL)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .disableTLSCerts();
    req = this.proxyAgent ? req.agent(this.proxyAgent) : req.agent(new https.Agent({ rejectUnauthorized: false }));

    // Use the request directly; JSON instruction handled by renderPrompt hook
    const body = typeof request === 'string'
        ? { messages: [{ role: 'user', content: request }] }
        : { messages: request };

    // Apply options like temperature, maxTokens if provided
    const { ...apiOptions } = options ?? {};
    if (Object.keys(apiOptions).length > 0) {
        Object.assign(body, apiOptions);
    }

    try {
      const res = await req.send(body);
      // Extract content - note: fence stripping is now handled by BaseLLM.postProcessRaw
      const rawContent = res.body?.choices?.[0]?.message?.content ?? null;

      // Usage data extraction would depend on the specific custom API response format
      // Example placeholder:
      const usage = undefined; // TODO: Adapt if usage info is available

      return { content: rawContent, usage: usage, error: undefined, structuredOutput: undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Custom OpenAI Client] Error: ${msg}`, { error: err });
      return { content: null, error: `Custom OpenAI Client failed: ${msg}`, structuredOutput: undefined, usage: undefined };
    }
  }

  /* ------------------------------------------------------ */
  /*  renderPrompt Hook Override                          */
  /* ------------------------------------------------------ */
  /**
   * Override renderPrompt to enforce JSON output.
   * Matches the base class signature exactly.
   */
  protected renderPrompt<P extends Record<string, any>>(
      def: PromptDefinition<P, unknown>,
      params: P
  ): string {
    // Call the base implementation to get the standard prompt
    const standardPrompt = super.renderPrompt(def, params);
    // Append the JSON instruction
    return standardPrompt + '\n\nRespond ONLY in valid JSON.';
  }

  /* ------------------------------------------------------ */
  /*  runPrompt                                             */
  /* ------------------------------------------------------ */
  async runPrompt<
    TInputParams extends Record<string, unknown>,
    TOutputSchema = unknown,
    O = TOutputSchema extends v.GenericSchema<infer P> ? P : string | null,
  >(
    promptDef: PromptDefinition<TInputParams, TOutputSchema>,
    params: TInputParams,
    options?: ChatOptions,
  ): Promise<ChatResponse<O>> {
    const prompt = promptDef.template(params);
    const baseRes = await this.chatCompletion(prompt, options);

    if (baseRes.error || baseRes.content === null) {
      return { ...baseRes, structuredOutput: undefined };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(baseRes.content);
    } catch (e) {
      return {
        ...baseRes,
        structuredOutput: undefined,
        error: `Failed to parse JSON: ${(e as Error).message}`,
      };
    }

    if (promptDef.outputSchema) {
      try {
        const validated = v.parse(promptDef.outputSchema as v.GenericSchema, parsed);
        return { ...baseRes, structuredOutput: validated as O };
      } catch (e) {
        const msg =
          e instanceof v.ValiError
            ? e.issues.map(i => i.message).join('; ')
            : (e as Error).message;
        return { ...baseRes, structuredOutput: undefined, error: `Schema validation error: ${msg}` };
      }
    }

    return { ...baseRes, structuredOutput: parsed as O };
  }

  /* ------------------------------------------------------ */
  /*  chatCompletion                                        */
  /* ------------------------------------------------------ */
  async chatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>> {
    /* append JSON‑only instruction once */
    const instruction = '\n\nRespond ONLY in valid JSON.';
    const promptWithJson =
      typeof promptOrMessages === 'string'
        ? `${promptOrMessages}${instruction}`
        : [
            { role: 'system', content: 'Respond ONLY in valid JSON.' },
            ...(promptOrMessages as CoreMessage[]),
          ];

    /* HTTP call */
    const token = await this.getToken();
    let req = superagent
      .post(this.config.BASE_URL)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .disableTLSCerts();
    req = this.proxyAgent ? req.agent(this.proxyAgent) : req.agent(new https.Agent({ rejectUnauthorized: false }));

    const body =
      typeof promptWithJson === 'string'
        ? { messages: [{ role: 'user', content: promptWithJson }] }
        : { messages: promptWithJson };

    if (options) Object.assign(body, options);

    try {
      const res = await req.send(body);
      const raw = res.body?.choices?.[0]?.message?.content ?? null;
      if (typeof raw !== 'string') return { content: null, error: 'No content' };

      /* strip ```json fences if present */
      const fenced = raw.trim();
      const match = fenced.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      const cleaned = match?.[1]?.trim() ?? fenced;

      return { content: cleaned };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: null, error: `chatCompletion failed: ${msg}` };
    }
  }
}