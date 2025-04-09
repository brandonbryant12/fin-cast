import type { CoreMessage } from 'ai';
import type { ChatOptions, ChatResponse, PromptDefinition } from "../types";
import type * as v from 'valibot';

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
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>>;

  /**
   * Runs a prompt based on the provided definition and parameters.
   * If the prompt definition includes an `outputSchema`, this method attempts
   * to parse and validate the LLM response against that schema, returning
   * the structured data in `structuredOutput`.
   *
   * @template TInputParams The expected type of the input parameters object.
   * @template TOutputSchema The type of the output schema itself (or unknown if none).
   * @template O The inferred output type (parsed schema output or string | null).
   * @param promptDef The prompt definition object containing schema, template, etc.
   * @param params The parameters object matching the prompt definition's input requirements.
   * @param options Optional chat configuration, overriding prompt definition and client defaults.
   * @returns A promise resolving to the chat response. `structuredOutput` will contain
   * the parsed and validated output if `outputSchema` was provided and processing succeeded.
   */
  runPrompt<
      TInputParams extends Record<string, any>,
      TOutputSchema = unknown, // Input: the schema type or unknown
      // Output: inferred type O
      O = TOutputSchema extends v.GenericSchema<infer P> ? P : string | null
  >(
      promptDef: PromptDefinition<TInputParams, TOutputSchema>, // Definition uses schema type
      params: TInputParams,
      options?: ChatOptions,
  ): Promise<ChatResponse<O>>; // Return type uses inferred type O
} 