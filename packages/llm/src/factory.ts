import type { LLMInterface } from "./base";
import type { CustomOpenAIClientConfig } from "./custom-open-ai";
import { CustomOpenAIClient } from "./custom-open-ai";
import { GeminiClient } from "./gemini";
import { OpenAIClient } from "./openai";
// import { AnthropicClient } from "./anthropic";


export type SupportedLLMProviders = "openai" | "gemini" | "anthropic";


interface OpenAIOptions {
  apiKey: string;
  baseURL?: string;

}

interface GeminiOptions {
  apiKey: string;

}

interface AnthropicOptions {
  apiKey: string;
  baseURL?: string;

}


export type LLMServiceConfig =
  | { provider: 'openai'; options: OpenAIOptions }
  | { provider: 'anthropic'; options: AnthropicOptions }
  | { provider: 'gemini'; options: GeminiOptions }
  | { provider: 'custom-openai'; options: CustomOpenAIClientConfig };

/**
 * Configuration object containing API keys and optional base URLs for different LLM providers.
 * This is used within LLMFactoryConfig.
 */
export interface LLMProviderConfig {
  openai?: { apiKey: string; baseURL?: string };
  anthropic?: { apiKey: string; baseURL?: string };
  gemini?: { apiKey: string };
  customOpenAI?: CustomOpenAIClientConfig;
}


/**
 * Creates an LLM client instance based on the specified provider and configuration.
 *
 * @param config A configuration object specifying the LLM provider and its required options.
 * @returns An instance conforming to the LLMInterface.
 * @throws Error if the provider is unsupported or options are invalid.
 */
export function createLLMService(config: LLMServiceConfig): LLMInterface {
  switch (config.provider) {
    case "openai":
      if (!config.options.apiKey) throw new Error("OpenAI API key missing in provided config.");
      return new OpenAIClient({
        apiKey: config.options.apiKey,
        baseURL: config.options.baseURL,

      });

    case "gemini":
       if (!config.options.apiKey) throw new Error("Gemini API key missing in provided config.");
      return new GeminiClient({
        apiKey: config.options.apiKey,

      });

    case "anthropic":
       if (!config.options.apiKey) throw new Error("Anthropic API key missing in provided config.");

      throw new Error("Anthropic client not yet implemented.");


    case "custom-openai":
      return new CustomOpenAIClient(config.options);

    default:
      // eslint-disable-next-line no-case-declarations
      const exhaustiveCheck: never = config;
      throw new Error(`Unsupported LLM configuration passed to factory: ${JSON.stringify(exhaustiveCheck)}`);
  }
} 