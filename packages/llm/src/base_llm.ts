import * as v from "valibot";
import type { LLMInterface } from "./base";
import type { ChatOptions, ChatResponse, PromptDefinition } from "./types";
import type { CoreMessage } from 'ai';

/**
 * Abstract base class for LLM clients, handling common prompt execution logic.
 */
export abstract class BaseLLM implements LLMInterface {

    /**
     * Abstract method that concrete implementations must provide to execute
     * the actual call to the underlying LLM API.
     *
     * @param promptOrMessages The formatted prompt string or message history.
     * @param options The final, merged chat options for the API call.
     * @returns A promise resolving to the raw chat response from the LLM.
     */
    protected abstract _executeModel(
        promptOrMessages: string | CoreMessage[],
        options: ChatOptions
    ): Promise<ChatResponse<string | null>>;

    /**
     * Performs a standard chat completion request using the underlying model execution.
     */
    public async chatCompletion(
        promptOrMessages: string | CoreMessage[],
        options?: ChatOptions,
    ): Promise<ChatResponse<string | null>> {
        // Use provided options or an empty object if none are given
        const finalOptions = { ...(options ?? {}) };
        // Delegate directly to the provider-specific implementation
        return this._executeModel(promptOrMessages, finalOptions);
    }

    /**
     * Runs a prompt based on the provided definition and parameters, handling validation and parsing.
     */
    public async runPrompt<
        TInputParams extends Record<string, unknown>,
        TOutputSchema = unknown, // Represents the output schema type itself (e.g., v.ObjectSchema<...>)
        // O is the inferred type of the *parsed and validated* output, or string | null if no schema
        O = TOutputSchema extends v.GenericSchema<infer P> ? P : string | null
    >(
        promptDef: PromptDefinition<TInputParams, TOutputSchema>,
        params: TInputParams,
        options?: ChatOptions,
    ): Promise<ChatResponse<O>> { // Return type uses the inferred type O for structuredOutput

        const promptName = promptDef.description || 'unnamed prompt';

        // 1. Validate Input Parameters
        let validatedParams = params; // Assume valid initially
        if (promptDef.paramsSchema) {
            try {
                validatedParams = v.parse(promptDef.paramsSchema, params);
            } catch (error: unknown) {
                let errorMessage = "Unknown input validation error";
                if (error instanceof v.ValiError) {
                    errorMessage = error.issues.map((issue) => `${issue.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${issue.message}`).join("; ");
                    console.error(`[LLM Prompt Error] Invalid input parameters for prompt "${promptName}": ${errorMessage}`, { params, issues: error.issues });
                    // Re-throw the original ValiError for detailed debugging upstream if needed
                    throw new v.ValiError(error.issues);
                } else if (error instanceof Error) {
                    errorMessage = error.message;
                    console.error(`[LLM Prompt Error] Error during input validation for prompt "${promptName}": ${errorMessage}`, { params, error });
                    throw new Error(`Input validation failed for prompt "${promptName}": ${errorMessage}`);
                } else {
                    console.error(`[LLM Prompt Error] Unknown error during input validation for prompt "${promptName}":`, error);
                    throw new Error(`An unknown error occurred during input validation for prompt "${promptName}".`);
                }
            }
        }

        // 2. Format the Prompt
        const formattedPrompt = promptDef.template(validatedParams);

        // 3. Merge Options (Client Defaults < Prompt Defaults < Call-specific Options)
        // Note: Client defaults are applied within the _executeModel implementation (e.g., OpenAIClient)
        const finalOptions: ChatOptions = {
            ...promptDef.defaultOptions, // Start with prompt defaults
            ...(options ?? {}),          // Override with call-specific options
        };

        console.log(`[LLM Prompt] Running prompt "${promptName}"`, { params: validatedParams, finalOptions });

        // 4. Execute the LLM Call via the provider-specific method
        const rawResponse = await this._executeModel(formattedPrompt, finalOptions);

        // 5. Handle Raw LLM Call Failure
        if (rawResponse.content === null || rawResponse.error) {
            console.error(`[LLM Prompt Error] LLM execution failed for prompt "${promptName}": ${rawResponse.error || 'Content was null'}`, { rawResponse });
            // Return the failure response, casting structuredOutput appropriately for the signature
            return {
                ...rawResponse,
                structuredOutput: undefined as unknown as O, // Ensure type consistency
                error: rawResponse.error ?? `LLM execution failed for prompt "${promptName}": Content was null`,
            };
        }

        // 6. Process Output: Parse and Validate if an outputSchema exists
        if (promptDef.outputSchema && typeof rawResponse.content === 'string') {
            let parsedJson: unknown;
            try {
                // Strip potential markdown fences (```json ... ```)
                let contentToParse = rawResponse.content.trim();
                const jsonFenceRegex = /^```json\s*([\s\S]*?)\s*```$/;
                const match = contentToParse.match(jsonFenceRegex);
                if (match && match[1]) {
                    contentToParse = match[1].trim();
                    console.log(`[LLM Prompt] Extracted JSON content from within markdown fence for prompt "${promptName}".`);
                } else if (contentToParse.startsWith('```') && contentToParse.endsWith('```')) {
                    // Handle generic code blocks if ```json is missing
                    contentToParse = contentToParse.substring(3, contentToParse.length - 3).trim();
                     console.log(`[LLM Prompt] Extracted content from within generic markdown fence for prompt "${promptName}".`);
                }

                // Attempt to parse the potentially cleaned string content as JSON
                parsedJson = JSON.parse(contentToParse);
            } catch (parseError: unknown) {
                const message = parseError instanceof Error ? parseError.message : "Unknown JSON parsing error";
                console.error(`[LLM Prompt Error] Failed to parse LLM output as JSON for prompt "${promptName}": ${message}`, { rawContent: rawResponse.content });
                // Throw a specific error indicating JSON parsing failure
                 throw new Error(`Failed to parse LLM output as JSON for prompt "${promptName}". Error: ${message}. Raw Content Snippet: "${rawResponse.content.substring(0, 150)}..."`);
            }

            try {
                // Validate the parsed JSON against the provided output schema
                const validatedOutput = v.parse(promptDef.outputSchema, parsedJson);
                 console.log(`[LLM Prompt] Successfully parsed and validated structured output for prompt "${promptName}".`);

                // Return successful response with the validated structured output
                // The type `validatedOutput` is inferred by v.parse based on the schema,
                // which matches the expected type `O` derived from TOutputSchema.
                return {
                    ...rawResponse, // Include original content, usage, etc.
                    structuredOutput: validatedOutput as unknown as O, // Cast to O, should be type-safe here
                    error: undefined, // Explicitly clear any potential previous error
                };
            } catch (validationError: unknown) {
                 // Handle output schema validation error
                let errorMessage = "Unknown output schema validation error";
                if (validationError instanceof v.ValiError) {
                    errorMessage = validationError.issues.map((issue) => `${issue.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${issue.message} (received: ${JSON.stringify(issue.input)})`).join("; ");
                    console.error(`[LLM Prompt Error] LLM output failed schema validation for prompt "${promptName}": ${errorMessage}`, { parsedJson, issues: validationError.issues });
                     // Re-throw the original ValiError for detailed debugging upstream
                    throw new v.ValiError(validationError.issues);
                } else if (validationError instanceof Error) {
                    errorMessage = validationError.message;
                     console.error(`[LLM Prompt Error] Error during output validation for prompt "${promptName}": ${errorMessage}`, { parsedJson, validationError });
                    throw new Error(`LLM output validation failed for prompt "${promptName}": ${errorMessage}`);
                } else {
                    console.error(`[LLM Prompt Error] Unknown error during output validation for prompt "${promptName}":`, validationError);
                     throw new Error(`An unknown error occurred during output validation for prompt "${promptName}".`);
                }
            }
        } else {
            // No output schema, return raw content.
            // We need to cast the response to match the return signature where O is (string | null).
             console.log(`[LLM Prompt] Prompt "${promptName}" has no outputSchema or content was not string. Returning raw content.`);
             if (typeof rawResponse.content !== 'string' && !promptDef.outputSchema) {
                 console.warn(`[LLM Prompt] Raw response content was not a string for prompt "${promptName}" and no output schema was defined.`, { rawResponse });
             }
            return {
                ...rawResponse,
                 // Explicitly set structuredOutput to undefined as per the type `O` when no schema is present.
                structuredOutput: undefined as unknown as O,
                error: undefined, // Explicitly clear any potential previous error
            } as ChatResponse<O>; // Cast needed because O defaults to string | null here
        }
    }
}