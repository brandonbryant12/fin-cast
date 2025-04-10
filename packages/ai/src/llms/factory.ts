import type { LLMInterface } from "./base";
import { GeminiClient } from "./gemini";
import { OpenAIClient } from "./openai";

// Individual provider option types
interface OpenAIOptions {
  apiKey: string;
  baseURL?: string;
}

interface AnthropicOptions {
  apiKey: string;
  baseURL?: string; // Assuming similar structure
}

interface GeminiOptions {
  apiKey: string;
}

/**
 * Discriminated union type for LLM service configuration.
 * Ensures that options provided match the specified provider.
 */
export type LLMServiceConfig =
  | { provider: 'openai'; options: OpenAIOptions }
  | { provider: 'anthropic'; options: AnthropicOptions }
  | { provider: 'gemini'; options: GeminiOptions };

/**
 * Configuration object containing API keys and optional base URLs for different LLM providers.
 * This is used within LLMFactoryConfig.
 */
export interface LLMProviderConfig {
  openai?: { apiKey: string; baseURL?: string };
  anthropic?: { apiKey: string; baseURL?: string };
  gemini?: { apiKey: string };
  // Add configurations for other providers as needed
}

/**
 * Union type of supported LLM provider identifiers.
 */
export type SupportedLLMProviders = "openai" | "anthropic" | "gemini";


/**
 * Configuration for creating an LLM service instance.
 * Specifies the provider and the necessary options (credentials, etc.).
 */
export interface LLMFactoryConfig {
  provider: SupportedLLMProviders;
  providerOptions: LLMProviderConfig; // Contains API keys etc. for all potential providers
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
      // apiKey is guaranteed by OpenAIOptions type
      return new OpenAIClient({
        apiKey: config.options.apiKey,
        baseURL: config.options.baseURL,
      });

    case "anthropic":
      // apiKey is guaranteed by AnthropicOptions type
      // TODO: Implement Anthropic client instantiation when available
      throw new Error("Anthropic client not yet implemented.");
      // Example: return new AnthropicClient(config.options);

    case "gemini":
      // apiKey is guaranteed by GeminiOptions type
      return new GeminiClient({
        apiKey: config.options.apiKey,
      });

    default:
      // This case should be unreachable due to the discriminated union type,
      // but provides robustness and satisfies TypeScript's exhaustiveness check.
      const exhaustiveCheck: never = config;
      throw new Error(`Unsupported LLM configuration: ${JSON.stringify(exhaustiveCheck)}`);
  }
} 