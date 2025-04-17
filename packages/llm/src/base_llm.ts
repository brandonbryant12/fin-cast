import * as v from "valibot";
import type { ChatOptions, ChatResponse, PromptDefinition } from "./types";
import type { CoreMessage } from 'ai';


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
   * @param promptDef The definition of the prompt, including schemas and template.
   * @param params The input parameters for the prompt template.
   * @param options Optional configuration overrides for this specific call.
   * @returns A promise resolving to the chat response, potentially containing parsed and validated structured output.
   */
  runPrompt<
    TInputParams extends Record<string, unknown>,
    TOutputSchema = unknown, // Represents the output schema type itself
    // O is the inferred type of the *parsed and validated* output
    O = TOutputSchema extends v.GenericSchema<infer P> ? P : string | null
  >(
    promptDef: PromptDefinition<TInputParams, TOutputSchema>,
    params: TInputParams,
    options?: ChatOptions,
  ): Promise<ChatResponse<O>>;
}


/**
 * Abstract base class for LLM clients, implementing the core prompt execution pipeline
 * using the Template Method pattern. Concrete providers must implement `_executeModel`
 * and can optionally override hooks to customize behavior.
 */
export abstract class BaseLLM implements LLMInterface {
  /* lowest‑level thing a provider must give */
  protected abstract _executeModel(
    request: string | CoreMessage[],
    options: ChatOptions,
  ): Promise<ChatResponse<string | null>>;

  /* ---- HOOKS a provider may override, but never has to -------- */

  /**
   * Hook to validate input parameters before rendering the prompt.
   * Default implementation uses the `paramsSchema` from the prompt definition.
   * Throws `ValiError` on failure.
   */
  protected preValidateParams<P extends Record<string, any>>(
    def: PromptDefinition<P, unknown>,
    params: P,
  ): P {
    if (def.paramsSchema) {
      try {
        // Use v.parse for runtime validation which throws on error
        return v.parse(def.paramsSchema, params);
      } catch (error: unknown) {
        const promptName = def.description || 'unnamed prompt';
        if (error instanceof v.ValiError) {
            const errorMessage = error.issues.map((issue) => `${issue.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${issue.message}`).join("; ");
            console.error(`[LLM Prompt Error - Base] Invalid input parameters for prompt "${promptName}": ${errorMessage}`, { params, issues: error.issues });
            // Re-throw the original ValiError for detailed debugging upstream
            throw new v.ValiError(error.issues);
        } else {
          const message = error instanceof Error ? error.message : "Unknown validation error";
          console.error(`[LLM Prompt Error - Base] Error during input validation for prompt "${promptName}": ${message}`, { params, error });
          throw new Error(`Input validation failed for prompt "${promptName}": ${message}`);
        }
      }
    }
    // If no schema, return params as is
    return params;
  }

  /**
   * Hook to render the prompt string using the template and validated parameters.
   */
  protected renderPrompt<P extends Record<string, unknown>>(
    def: PromptDefinition<P, unknown>,
    params: P
  ): string {
    return def.template(params);
  }

  /**
   * Hook to post-process the raw string response from the LLM before JSON parsing.
   * Default implementation strips common markdown code fences (```json ... ```) and trims whitespace.
   */
  protected postProcessRaw(raw: string | null | undefined): string {
    if (typeof raw !== 'string') return ''; // Handle null/undefined input

    const trimmed = raw.trim();
    // Regex to match optional 'json' language identifier and capture content
    const jsonFenceRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
    const match = trimmed.match(jsonFenceRegex);

    // If match found, return captured group, otherwise return the trimmed original string
    return (match?.[1] ?? trimmed).trim();
  }


  /**
   * Hook to parse the cleaned string response into a JSON object.
   * Returns `undefined` if parsing fails.
   */
  protected parseJson(cleanedJsonString: string): unknown | undefined {
    if (!cleanedJsonString) return undefined; // Handle empty string after postProcessRaw
    try {
      return JSON.parse(cleanedJsonString);
    } catch (e) {
       console.warn(`[LLM Prompt - Base] Failed to parse JSON: ${(e as Error).message}. Content: "${cleanedJsonString.substring(0,100)}..."`);
       return undefined; // Return undefined on parsing error
    }
  }

  /**
   * Hook to validate the parsed JSON object against the `outputSchema`.
   * Default implementation uses `v.parse` which throws `ValiError` on failure.
   * If no schema is defined, it performs a type cast.
   *
   * Note: The generic type `O` here represents the *schema definition itself* if provided,
   * or the expected raw output type otherwise. The return type `ValidatedO` infers
   * the actual validated data type from the schema.
   */
  protected validateOutput<
    OutputSchemaDefinition,
    ValidatedO = OutputSchemaDefinition extends v.GenericSchema<infer P> ? P : OutputSchemaDefinition
  >(
      def: PromptDefinition<any, OutputSchemaDefinition>,
      parsed: unknown
  ): ValidatedO {
      if (def.outputSchema) {
          try {
              // Use v.parse for runtime validation which throws on error
              // Cast the outputSchema to GenericSchema as we've checked it exists
              return v.parse(def.outputSchema as v.GenericSchema, parsed) as ValidatedO;
          } catch (error: unknown) {
              const promptName = def.description || 'unnamed prompt';
              if (error instanceof v.ValiError) {
                  const errorMessage = error.issues.map((issue) => `${issue.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${issue.message} (received: ${JSON.stringify(issue.input)})`).join("; ");
                  console.error(`[LLM Prompt Error - Base] LLM output failed schema validation for prompt "${promptName}": ${errorMessage}`, { parsedJson: parsed, issues: error.issues });
                  // Re-throw the original ValiError
                  throw new v.ValiError(error.issues);
              } else {
                const message = error instanceof Error ? error.message : "Unknown validation error";
                console.error(`[LLM Prompt Error - Base] Error during output validation for prompt "${promptName}": ${message}`, { parsedJson: parsed, error });
                throw new Error(`Output validation failed for prompt "${promptName}": ${message}`);
              }
          }
      }
      // If no outputSchema, cast the parsed JSON to the expected type O.
      // This assumes the caller knows the expected structure if no schema is provided.
       
      return parsed as ValidatedO;
  }


  /* ---------------- main algorithm – never touched per‑provider ------------- */

  /**
   * Runs a structured prompt using the defined pipeline.
   * Handles input validation, templating, model execution via `_executeModel`,
   * response post-processing, JSON parsing, and output validation using the hooks.
   */
  async runPrompt<
    TInputParams extends Record<string, unknown>,
    TOutputSchema, // The schema type itself (e.g., v.ObjectSchema<...>) or any other type if no schema
    // Infer the actual output type from the schema if it exists, otherwise use TOutputSchema directly
    ValidatedO = TOutputSchema extends v.GenericSchema<infer P> ? P : TOutputSchema
  >(
    def: PromptDefinition<TInputParams, TOutputSchema>,
    params: TInputParams,
    options?: ChatOptions,
  ): Promise<ChatResponse<ValidatedO>> { // Use the inferred ValidatedO for the response type
      const promptName = def.description || 'unnamed prompt';
      let validatedParams: TInputParams;
      let formattedPrompt: string;
      let rawResponse: ChatResponse<string | null>;
      let cleanedContent: string;
      let parsedJson: unknown | undefined;

      try {
          // 1. Validate Input Parameters (using hook)
          validatedParams = this.preValidateParams(def, params);

          // 2. Format the Prompt (using hook)
          formattedPrompt = this.renderPrompt(def, validatedParams);

          // 3. Merge Options (Provider Defaults < Prompt Defaults < Call-specific Options)
          // Note: Provider defaults (like default model) should be handled within _executeModel
          const finalOptions: ChatOptions = {
              ...def.defaultOptions, // Start with prompt defaults
              ...(options ?? {}),     // Override with call-specific options
          };

          console.log(`[LLM Prompt - Base] Running prompt "${promptName}"`, { params: validatedParams, finalOptions });

          // 4. Execute the LLM Call (using abstract method)
          rawResponse = await this._executeModel(formattedPrompt, finalOptions);

          // 5. Handle Raw LLM Call Failure
          if (rawResponse.content === null || rawResponse.error) {
              const errorMsg = rawResponse.error || 'Content was null';
              console.error(`[LLM Prompt Error - Base] LLM execution failed for prompt "${promptName}": ${errorMsg}`, { rawResponse });
              // Ensure type consistency for structuredOutput even on error
              return {
                  ...rawResponse,
                  structuredOutput: undefined as unknown as ValidatedO,
                  error: rawResponse.error ?? `LLM execution failed for prompt "${promptName}": Content was null`,
              };
          }

          // 6. Post-Process Raw Output (using hook)
          cleanedContent = this.postProcessRaw(rawResponse.content);

          // 7. Parse Cleaned Output to JSON (using hook)
          parsedJson = this.parseJson(cleanedContent);

          // 8. Handle JSON Parsing Failure
          if (parsedJson === undefined) {
              console.error(`[LLM Prompt Error - Base] Failed to parse LLM output as JSON for prompt "${promptName}". Cleaned Content: "${cleanedContent.substring(0,150)}..."`, { rawContent: rawResponse.content});
              return {
                  ...rawResponse,
                  structuredOutput: undefined as unknown as ValidatedO,
                  error: `Failed to parse LLM output as JSON for prompt "${promptName}".`,
              };
          }

          // 9. Validate Parsed JSON (using hook)
          // This hook throws if validation fails
          const structuredOutput = this.validateOutput<TOutputSchema, ValidatedO>(def, parsedJson);
          console.log(`[LLM Prompt - Base] Successfully parsed and validated structured output for prompt "${promptName}".`);

          // 10. Return Success Response
          return {
              ...rawResponse,
              structuredOutput: structuredOutput,
              error: undefined, // Explicitly clear any previous error indication
          };

      } catch (error: unknown) {
           const baseErrorMessage = `Error processing prompt "${promptName}"`;
           let specificError = "An unknown error occurred.";

           if (error instanceof v.ValiError) {
               specificError = `Validation failed: ${error.issues.map(i => i.message).join('; ')}`;
               console.error(`${baseErrorMessage}: ${specificError}`, { error });
           } else if (error instanceof Error) {
               specificError = error.message;
               console.error(`${baseErrorMessage}: ${specificError}`, { error });
           } else {
               console.error(`${baseErrorMessage}: ${specificError}`, { error });
           }

           // Return an error response
           // Need to reconcile the potential rawResponse state if the error occurred late
           const responseBase = rawResponse! ?? { content: null }; // Use existing response if available
           return {
               ...responseBase,
               structuredOutput: undefined as unknown as ValidatedO,
               error: `${baseErrorMessage}: ${specificError}`,
           };
      }
  }

  /**
   * Provides basic chat completion functionality by directly calling the provider's
   * underlying model execution. Does not use the structured prompt pipeline.
   */
  async chatCompletion(
      promptOrMessages: string | CoreMessage[],
      options?: ChatOptions,
    ): Promise<ChatResponse<string | null>> {
        const finalOptions = { ...(options ?? {}) };
        return this._executeModel(promptOrMessages, finalOptions);
    }
}