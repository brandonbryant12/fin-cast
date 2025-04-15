import type * as v from 'valibot';

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
  /** Optional field to include error details if the call failed or parsing/validation failed */
  error?: string;
} 

/**
 * Defines the structure for a reusable prompt template.
 * Uses generics for input parameters and potential structured output types.
 */
export interface PromptDefinition<
    TInputParams extends Record<string, any> = Record<string, any>,
    TOutput = unknown, // Default output is unknown if no schema
> {
    /** Optional Valibot schema for validating input parameters. */
    paramsSchema?: v.GenericSchema<TInputParams>;

    /** Function to generate the prompt string from validated parameters. */
    template: (params: TInputParams) => string;

    /** Optional Valibot schema for validating and parsing the LLM JSON output. */
    outputSchema?: v.GenericSchema<TOutput>;

    /** Optional: Default configuration options for the LLM call for this prompt. */
    defaultOptions?: Partial<ChatOptions>;

    /** Optional: A description of what the prompt does. */
    description?: string;
}