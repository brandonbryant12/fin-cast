import * as v from "valibot";
import type { ChatOptions, ChatResponse } from "./types";
import type { CoreMessage } from 'ai';
import { Prompt } from './prompt';


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

  /**
   * Runs a structured prompt, handling input validation, templating,
   * LLM execution, and output parsing/validation based on the definition.
   *
   * @param prompt The Prompt instance defining the schemas, template, and options.
   * @param params The input parameters for the prompt template.
   * @param options Optional configuration overrides for this specific call.
   * @returns A promise resolving to the chat response containing the parsed and validated structured output.
   */
  runPrompt<
    TParams extends object,
    TOutput
  >(
    prompt: Prompt<TParams, TOutput>,
    params: TParams,
    options?: ChatOptions,
  ): Promise<ChatResponse<TOutput>>;
}


/**
 * Abstract base class for LLM clients, implementing the core prompt execution pipeline
 * using the Template Method pattern. Concrete providers must implement `_executeModel`.
 */
export abstract class BaseLLM implements LLMInterface {
  /* lowest‑level thing a provider must give */
  protected abstract _executeModel(
    request: CoreMessage[],
    options: ChatOptions,
  ): Promise<ChatResponse<string | null>>;

  /* ---------------- main algorithm – never touched per‑provider ------------- */

  /**
   * Runs a structured prompt using the Prompt class.
   * Handles input validation, templating, model execution via `_executeModel`,
   * and output parsing/validation using the Prompt instance methods.
   */
  async runPrompt<
    TParams extends object,
    TOutput
  >(
    prompt: Prompt<TParams, TOutput>,
    params: TParams,
    options?: ChatOptions,
  ): Promise<ChatResponse<TOutput>> {
      const promptName = prompt.name;
      let validatedParams: TParams;
      let prompts: { system: string, user: string };
      let messages: CoreMessage[];
      let rawResponse: ChatResponse<string | null> | undefined = undefined;
      let structuredOutput: TOutput | undefined = undefined;

      try {
          // 1. Validate Input Parameters (using Prompt method)
          validatedParams = prompt.validateParams(params);

          // 2. Merge Options (Prompt Defaults < Call-specific Options)
          // Note: Provider defaults (like default model) are handled within _executeModel
          const finalOptions: ChatOptions = {
              // Extract only SUPPORTED LLM options from the prompt's defaults
              temperature: prompt.defaultOptions.temperature,
              maxTokens: prompt.defaultOptions.maxTokens,
              // topP is NOT in ChatOptions, so we exclude it
              // model can be specified in call-specific options if needed

              // Merge/override with call-specific options
              ...(options ?? {}),
              // System prompt comes from prompt.render, not options here
          };

          // 3. Render the prompts (using Prompt method)
          prompts = prompt.render(validatedParams, finalOptions); // Pass finalOptions for potential system prompt override

          // 4. Format messages for the LLM
          messages = [
              { role: 'system', content: prompts.system },
              { role: 'user', content: prompts.user },
          ];

          console.log(`[LLM Prompt - Base] Running prompt \"${promptName}\"`, { params: validatedParams, finalOptions });

          // 5. Execute the LLM Call (using abstract method)
          rawResponse = await this._executeModel(messages, finalOptions);

          // 6. Handle Raw LLM Call Failure or Empty Content
          if (rawResponse.error || rawResponse.content === null || rawResponse.content.trim() === '') {
              const errorMsg = rawResponse.error || (rawResponse.content === null ? 'LLM returned null content' : 'LLM returned empty content');
              console.error(`[LLM Prompt Error - Base] LLM execution failed or returned empty content for prompt \"${promptName}\": ${errorMsg}`, { rawResponse });
              return {
                  ...rawResponse, // Spread original response (might contain useful metadata)
                  content: rawResponse.content, // Keep original raw content
                  structuredOutput: undefined as TOutput, // Explicitly undefined
                  error: rawResponse.error ?? `LLM execution failed for prompt \"${promptName}\": ${errorMsg}`, // Ensure error is set
              };
          }

          // 7. Parse and Validate Output (using Prompt method)
          // This method handles cleaning, JSON parsing, and schema validation.
          // It throws an error if any step fails.
          structuredOutput = prompt.parseOutput(rawResponse.content);
          console.log(`[LLM Prompt - Base] Successfully parsed and validated structured output for prompt \"${promptName}\".`);

          // 8. Return Success Response
          return {
              ...rawResponse,
              structuredOutput: structuredOutput,
              error: undefined, // Explicitly clear any potential error from rawResponse
          };

      } catch (error: unknown) {
           const baseErrorMessage = `Error processing prompt \"${promptName}\"`;
           let specificError = "An unknown error occurred.";
           let errorType = "ProcessingError"; // Default type

            // Check if it's a validation error from the Prompt class methods
           if (error instanceof Error) {
              specificError = error.message;
              // Check if the error message indicates a specific failure type from Prompt
              if (error.message.includes('Input validation failed') || error.message.includes('Output validation failed') || error.message.includes('JSON Parsing Error')) {
                  errorType = "ValidationError"; // More specific error category
              }
              console.error(`${baseErrorMessage}: ${specificError}`, { error });
           } else { // Handle non-Error throws
               specificError = String(error);
               console.error(`${baseErrorMessage}: Unknown error type`, { error });
           }


           // Return an error response
           const responseBase = rawResponse ?? { content: null, structuredOutput: undefined, error: undefined }; // Use existing response if available
           return {
               ...responseBase,
               structuredOutput: undefined as TOutput, // Ensure undefined on error
               error: `${baseErrorMessage} (${errorType}): ${specificError}`, // Include error type
           };
      }
  }

  /**
   * Provides basic chat completion functionality by directly calling the provider's
   * underlying model execution. Does not use the structured prompt pipeline.
   * Adapts promptOrMessages to CoreMessage[] if a single string is given.
   */
  async chatCompletion(
      promptOrMessages: string | CoreMessage[],
      options?: ChatOptions,
    ): Promise<ChatResponse<string | null>> {
        const finalOptions = { ...(options ?? {}) };
        let messages: CoreMessage[];

        if (typeof promptOrMessages === 'string') {
            messages = [{ role: 'user', content: promptOrMessages }];
            // If a system prompt is in options, prepend it
            if (finalOptions.systemPrompt) {
                messages.unshift({ role: 'system', content: finalOptions.systemPrompt });
            }
        } else {
            messages = promptOrMessages;
            // Consider if options.systemPrompt should override first message if it's system?
            // For now, let's assume options.systemPrompt is only used if input is a string.
        }

        // Ensure we don't pass systemPrompt *within* options if it was used to build messages
        const { systemPrompt, ...restOptions } = finalOptions;

        return this._executeModel(messages, restOptions);
    }
}