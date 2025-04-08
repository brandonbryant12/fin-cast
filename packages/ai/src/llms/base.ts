import type {
  PromptName,
  PromptParams,
} from "../prompts";
import type { ChatOptions, ChatResponse } from "../types";

/**
 * Common interface for interacting with different LLM providers.
 */
export interface LLMInterface {
  /**
   * Performs a standard chat completion request.
   *
   * @param promptOrMessages The user's prompt (string) or a structured message history (CoreMessage[]).
   * @param options Optional configuration for the request.
   * @returns A promise resolving to the chat response.
   */
  chatCompletion(
    promptOrMessages: string | import("ai").CoreMessage[], // Explicitly type CoreMessage
    options?: ChatOptions,
  ): Promise<ChatResponse>;

  /**
   * Runs a registered custom prompt with type-safe parameters.
   *
   * @param name The name of the prompt registered in `src/prompts/index.ts`.
   * @param params The parameters object matching the specific prompt's schema.
   * @param options Optional chat configuration, potentially overriding prompt defaults.
   * @returns A promise resolving to the chat response.
   */
  runPrompt<T extends PromptName>(
    name: T,
    params: PromptParams<T>,
    options?: ChatOptions,
  ): Promise<ChatResponse>;
} 