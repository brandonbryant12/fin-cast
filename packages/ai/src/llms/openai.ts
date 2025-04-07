import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { generateText, type CoreMessage } from "ai";
import type { LLMInterface } from "./base";
import type { ChatOptions, ChatResponse } from "../types";
import * as v from "valibot";
import {
  prompts,
  type PromptName,
  type PromptParams,
} from "../prompts"; // Import the registry and types

interface OpenAIClientOptions {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string; // Optional: Specify a default model
  defaultSystemPrompt?: string; // Optional: Specify a default system prompt
}

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

export class OpenAIClient implements LLMInterface {
  private client: OpenAIProvider; // Stores the configured provider instance
  private options: OpenAIClientOptions;

  constructor(options: OpenAIClientOptions) {
    if (!options.apiKey) {
      throw new Error("OpenAI API key is required.");
    }
    this.options = {
      ...options,
      defaultModel: options.defaultModel ?? DEFAULT_MODEL,
      defaultSystemPrompt: options.defaultSystemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    };

    // Use createOpenAI to configure the provider with credentials
    this.client = createOpenAI({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseURL,
      // Add other provider-level settings if needed
    });
  }

  async chatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const modelId = options?.model ?? this.options.defaultModel!;
    const systemPrompt = options?.systemPrompt ?? this.options.defaultSystemPrompt!;

    try {
      // Get the specific model instance from the configured provider
      // const model = this.client(modelId); // Previous approach

      // Prepare generateText parameters
      const generateTextParams = {
        // Obtain the model instance directly within this object
        model: this.client(modelId),
        system: systemPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        messages: [] as CoreMessage[],
        prompt: undefined as string | undefined,
      };

      // Assign prompt or messages based on input type
      if (typeof promptOrMessages === "string") {
        generateTextParams.prompt = promptOrMessages;
      } else {
        generateTextParams.messages = promptOrMessages;
      }

      const { text, usage } = await generateText(generateTextParams);

      return {
        content: text,
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Error during OpenAI chat completion (Model: ${modelId}): ${message}`,
      );
      console.error(error); // Log the full error object for detailed debugging

      return {
        content: null,
      };
    }
  }

  async runPrompt<T extends PromptName>(
    name: T,
    params: PromptParams<T>,
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    // 1. Look up prompt details in the registry
    const promptModule = prompts[name];

    if (!promptModule) {
      // Should ideally not happen if using PromptName type, but good practice
      throw new Error(`Prompt named "${name}" not found in registry.`);
    }

    // 2. Validate input parameters against the prompt's schema (if it exists)
    if ("paramsSchema" in promptModule && promptModule.paramsSchema) {
      try {
        v.parse(promptModule.paramsSchema, params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Invalid parameters for prompt "${name}": ${message}`, params);
        // Optionally re-throw a more specific error or return an error response
        throw new Error(`Invalid parameters for prompt "${name}": ${message}`);
        // Or return { content: null, error: { message: `Invalid parameters: ${message}` } };
      }
    }

    // 3. Get the template function
    if (!("template" in promptModule) || typeof promptModule.template !== 'function') {
      throw new Error(`Prompt "${name}" is missing a valid 'template' function.`);
    }
    const templateFn = promptModule.template as (
      p: PromptParams<T>,
    ) => string;

    // 4. Format the prompt string
    const formattedPrompt = templateFn(params);

    // 5. Determine chat options (merge defaults from prompt and call-specific options)
    const promptDefaults = ("defaultOptions" in promptModule && promptModule.defaultOptions)
        ? promptModule.defaultOptions
        : {};
    const finalOptions = { ...promptDefaults, ...options };

    // 6. Call the standard chatCompletion method
    console.log(`Running prompt "${name}" with params:`, params);
    return this.chatCompletion(formattedPrompt, finalOptions);
  }

  // Implementation for custom prompts will be added here
  // (likely referencing templates from ../prompts/*)
} 