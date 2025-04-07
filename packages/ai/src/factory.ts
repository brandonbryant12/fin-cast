import type { LLMInterface } from "./llms/base";
import { OpenAIClient } from "./llms/openai";

/**
 * Configuration object passed by the consuming application.
 * Contains validated environment variables or other settings.
 */
export interface AIConfig {
  openai?: { apiKey: string; baseURL?: string };
  anthropic?: { apiKey: string; baseURL?: string };
  // Add configurations for other providers as needed
}

/**
 * Union type of supported LLM provider identifiers.
 */
export type SupportedLLMs = "openai" | "anthropic"; // Add others as they are implemented

/**
 * Factory for creating instances of LLM clients.
 */
export const AIServiceFactory = {
  /**
   * Creates an LLM client instance based on the specified type and configuration.
   *
   * @param type The identifier of the LLM provider (e.g., 'openai').
   * @param config The configuration object containing necessary credentials and settings.
   * @returns An instance conforming to the LLMInterface.
   * @throws Error if the required configuration for the specified type is missing.
   */
  createLLM(type: SupportedLLMs, config: AIConfig): LLMInterface {
    switch (type) {
      case "openai":
        if (!config.openai?.apiKey) {
          throw new Error(
            "OpenAI configuration (apiKey) is required but missing in the provided AIConfig.",
          );
        }
        return new OpenAIClient({
          apiKey: config.openai.apiKey,
          baseURL: config.openai.baseURL,
        });

      case "anthropic":
        // Example placeholder for Anthropic
        if (!config.anthropic?.apiKey) {
          throw new Error(
            "Anthropic configuration (apiKey) is required but missing in the provided AIConfig.",
          );
        }
        throw new Error("Anthropic client not yet implemented.");

      default:
        const _exhaustiveCheck: never = type;
        throw new Error(`Unsupported LLM type: ${_exhaustiveCheck}`);
    }
  },
}; 