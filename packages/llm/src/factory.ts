import type { LLMInterface } from "./base";
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
  | { provider: 'gemini'; options: GeminiOptions }
  | { provider: 'anthropic'; options: AnthropicOptions };



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


    default:

      const exhaustiveCheck: never = config;
      throw new Error(`Unsupported LLM configuration passed to factory: ${JSON.stringify(exhaustiveCheck)}`);
  }
} 