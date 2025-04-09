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
export interface ChatResponse<T = unknown> { // Default to unknown for structured output
  /** The raw text content returned by the LLM, or null if an error occurred. */
  content: string | null;
  /** Token usage information, if provided by the LLM. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** The parsed and validated structured output, if requested and successful. */
  structuredOutput?: T;
  /** Optional field to include error details if parsing/validation failed */
  error?: string;
} 