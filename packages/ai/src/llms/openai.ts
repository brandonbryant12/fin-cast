import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { type OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { generateText, type CoreMessage, type GenerateTextResult } from "ai";
import * as v from "valibot";
import type { LLMInterface } from "./base";
import type { ChatOptions, ChatResponse } from "../types";
import {
  prompts,
  type PromptName,
  type PromptParams,
  type PromptRegistry,
  type PromptOutputType, // Import the helper type
  type PromptOutputSchema, // Import the helper type
} from "../prompts";

interface OpenAIClientOptions {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  defaultSystemPrompt?: string;
}


const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

export class OpenAIClient implements LLMInterface {
  private client: OpenAIProvider;
  private options: OpenAIClientOptions;

  constructor(options: OpenAIClientOptions) {
    if (!options.apiKey) {
      throw new Error("OpenAI API key is required.");
    }
    // Ensure defaults are set
    this.options = {
      apiKey: options.apiKey,
      baseURL: options.baseURL, // Keep optional
      defaultModel: options.defaultModel ?? DEFAULT_MODEL,
      defaultSystemPrompt: options.defaultSystemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    };

    this.client = createOpenAI({
      apiKey: this.options.apiKey,
      ...(options.baseURL && { baseURL: options.baseURL }),
    });
  }

  // Internal method for raw chat completion
  private async _rawChatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>> { // Explicitly returns string content
    const modelId = options?.model ?? this.options.defaultModel;
    const systemPrompt = options?.systemPrompt ?? this.options.defaultSystemPrompt;

    try {
      const generateTextParams = {
        model: this.client(modelId as OpenAIChatModelId),
        system: systemPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        ...(typeof promptOrMessages === 'string'
          ? { prompt: promptOrMessages }
          : { messages: promptOrMessages }),
        // Do NOT use JSON mode here - we handle parsing manually
      };

      // Explicitly type the result expected (no specific object shape)
      const result: GenerateTextResult<never, Record<string, unknown>> = await generateText(generateTextParams);
      const { text, usage } = result;

      return {
        content: text,
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        },
        structuredOutput: undefined, // No structured output from raw call
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error during API call";
      console.error(
        `Error during OpenAI raw chat completion (Model: ${modelId}): ${message}`,
        error, // Log full error
      );

      return {
        content: null, // Indicate failure clearly
        usage: undefined,
        structuredOutput: undefined,
        error: `OpenAI API Error: ${message}`,
      };
    }
  }

  // Public chatCompletion method adhering to the interface
  async chatCompletion(
      promptOrMessages: string | CoreMessage[],
      options?: ChatOptions,
  ): Promise<ChatResponse<string | null>> {
      return this._rawChatCompletion(promptOrMessages, options);
  }


  async runPrompt<T extends PromptName>(
    name: T,
    params: PromptParams<T>,
    options?: ChatOptions,
  ): Promise<ChatResponse<PromptOutputType<T>>> { // Use inferred output type
    const promptModule = prompts[name] as PromptRegistry[T]; // Assert type for safety

    if (!promptModule) {
      throw new Error(`Prompt named "${name}" not found in registry.`);
    }

    // 1. Validate Input Parameters
    if ("paramsSchema" in promptModule && promptModule.paramsSchema) {
       const schema = promptModule.paramsSchema as v.GenericSchema; // Ensure it's a schema
       try {
          v.parse(schema, params);
        } catch (error: unknown) {
          let errorMessage = "Unknown input validation error";
          if (error instanceof v.ValiError) {
            // Format the detailed message from Valibot issues
            errorMessage = error.issues.map((issue) => `${issue.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${issue.message}`).join("; ");
            console.error(`Invalid parameters for prompt "${name}": ${errorMessage}`, params);
            // Re-throw the original Valibot error
            throw error;
          } else if (error instanceof Error) {
             errorMessage = error.message;
             console.error(`Error during input validation for prompt "${name}": ${errorMessage}`, params);
             throw new Error(`Input validation failed for prompt "${name}": ${errorMessage}`);
          } else {
             // Handle unknown error type
             console.error(`Unknown error during input validation for prompt "${name}":`, error);
             throw new Error(`An unknown error occurred during input validation for prompt "${name}".`);
          }
        }
    }

    // 2. Get Template Function and Format Prompt
    if (!("template" in promptModule) || typeof promptModule.template !== 'function') {
        throw new Error(`Prompt "${name}" is missing a valid 'template' function.`);
    }
    const templateFn = promptModule.template as (p: PromptParams<T>) => string;
    const formattedPrompt = templateFn(params);

    // 3. Merge Options
    const promptDefaults = ("defaultOptions" in promptModule && promptModule.defaultOptions)
       ? promptModule.defaultOptions
       : {};
    const finalOptions: ChatOptions = { ...promptDefaults, ...options };

    console.log(`Running prompt "${name}" with params:`, JSON.stringify(params), "Final Options:", finalOptions);

    // 4. Call LLM (using internal raw method)
    const response = await this._rawChatCompletion(formattedPrompt, finalOptions);

    // 5. Handle LLM Call Failure
    if (response.content === null || response.error) {
      console.error(`LLM call failed for prompt "${name}": ${response.error}`);
      // Return the failure response directly, casting the type
      return response as ChatResponse<PromptOutputType<T>>;
    }

    // 6. Check for Output Schema and Attempt Parsing/Validation
    const outputSchema = ("outputSchema" in promptModule ? promptModule.outputSchema : undefined) as PromptOutputSchema<T> | undefined;

    if (outputSchema) {
        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(response.content);
        } catch (parseError: unknown) {
            const message = parseError instanceof Error ? parseError.message : "Unknown JSON parsing error";
            console.error(`Failed to parse LLM output as JSON for prompt "${name}": ${message}`, response.content);
            // Throw specific parsing error
            throw new Error(`Failed to parse LLM output as JSON for prompt "${name}". Error: <span class="math-inline">\{message\}\. Raw Content\: "</span>{response.content.substring(0, 100)}..."`);
        }

        try {
            // Validate the parsed JSON against the prompt's output schema
            const validatedOutput = v.parse(outputSchema, parsedJson) as PromptOutputType<T>; // Cast needed after parse
            console.log(`Successfully parsed and validated output for prompt "${name}".`);
            return {
                ...response,
                structuredOutput: validatedOutput, // Add validated structured output
            };
        } catch (validationError: unknown) {
            let errorMessage = "Unknown schema validation error";
             if (validationError instanceof v.ValiError) {
               errorMessage = validationError.issues.map((issue) => `${issue.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${issue.message} (received: ${JSON.stringify(issue.input)})`).join("; ");
             } else if (validationError instanceof Error) {
               errorMessage = validationError.message;
             }
            console.error(`LLM output failed validation for prompt "${name}": ${errorMessage}`, parsedJson);
             // Throw specific validation error including details
            throw new Error(`LLM output failed validation for prompt "${name}". Issues: ${errorMessage}`);
        }

    } else {
        // No output schema defined, return the raw response (casting type)
        console.log(`Prompt "${name}" has no outputSchema. Returning raw content.`);
        return response as ChatResponse<PromptOutputType<T>>; // OutputType will be 'never'
    }
  }
} 