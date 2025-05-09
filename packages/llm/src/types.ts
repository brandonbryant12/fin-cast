import type { CoreMessage } from 'ai';

/**
 * Options for chat completion requests.
 */
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPrompt?: string;
}

/**
 * Response from a chat completion request.
 * Can include structured output if requested and successfully parsed/validated.
 */
export interface ChatResponse<T = unknown> {
  content: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  structuredOutput?: T;
  error?: string;
} 

/**
 * Interface defining the core methods required by any LLM client.
 */
export interface LLMInterface {
  /**
   * Executes a chat completion request with the LLM.
   *
   * @param promptOrMessages Either a single prompt string or an array of messages.
   * @param options Optional configuration for the chat request.
   * @returns A promise resolving to the chat response, containing the raw content and optional metadata.
   */
  chatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>>;
}