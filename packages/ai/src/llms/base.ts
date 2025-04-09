import type {
  PromptName,
  PromptParams,
  PromptOutputType, // Import the new helper type
} from "../prompts";
import type { ChatOptions, ChatResponse } from "../types";

/**
 * Common interface for interacting with different LLM providers.
 */
export interface LLMInterface {
  /**
   * Performs a standard chat completion request, returning raw text content.
   *
   * @param promptOrMessages The user's prompt (string) or a structured message history (CoreMessage[]).
   * @param options Optional configuration for the request.
   * @returns A promise resolving to the chat response containing string content.
   */
  chatCompletion(
    promptOrMessages: string | import("ai").CoreMessage[], // Explicitly type CoreMessage
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>>; // Specify string output type

  /**
   * Runs a registered custom prompt with type-safe parameters.
   * If the prompt defines an `outputSchema`, this attempts to parse and validate
   * the LLM response against that schema, returning the structured data.
   *
   * @param name The name of the prompt registered in `src/prompts/index.ts`.
   * @param params The parameters object matching the specific prompt's input schema.
   * @param options Optional chat configuration, potentially overriding prompt defaults.
   * @returns A promise resolving to the chat response, potentially containing structured output.
   */
  runPrompt<T extends PromptName>(
    name: T,
    params: PromptParams<T>,
    options?: ChatOptions,
  ): Promise<ChatResponse<PromptOutputType<T>>>; // Use inferred output type
} 