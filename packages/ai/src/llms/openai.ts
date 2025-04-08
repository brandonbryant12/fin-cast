import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { type OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { generateText, type CoreMessage } from "ai";
import * as v from "valibot";
import type { LLMInterface } from "./base";
import type { ChatOptions, ChatResponse } from "../types";
import {
  prompts,
  type PromptName,
  type PromptParams,
  type PromptRegistry,
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

  async chatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const modelId = options?.model ?? this.options.defaultModel;
    const systemPrompt = options?.systemPrompt ?? this.options.defaultSystemPrompt;

    try {
      // Update the type to match the AI SDK's expected parameters
      const generateTextParams = {
        model: this.client(modelId as OpenAIChatModelId),
        system: systemPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        messages: typeof promptOrMessages === 'string' ? [] : promptOrMessages,
        prompt: typeof promptOrMessages === 'string' ? promptOrMessages : undefined,
      };

      // Specify the generic types for GenerateTextResult
      const result = await generateText<Record<string, never>, undefined>(generateTextParams);
      const { text, usage } = result;

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
      // It's often helpful to log the full error object for debugging
      console.error(error);

      return {
        content: null, // Indicate failure clearly
        usage: undefined,
      };
    }
  }

  async runPrompt<T extends PromptName>(
    name: T,
    params: PromptParams<T>,
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const promptModule = prompts[name] as PromptRegistry[T]; // Assert type for safety

    if (!promptModule) {
      throw new Error(`Prompt named "${name}" not found in registry.`);
    }

    // Validate parameters if a schema exists
    if ("paramsSchema" in promptModule && promptModule.paramsSchema) {
       const schema = promptModule.paramsSchema as v.GenericSchema; // Ensure it's a schema
      try {
         v.parse(schema, params);
       } catch (error: unknown) {
          let errorMessage = "Unknown validation error";
          if (error instanceof v.ValiError) {
            errorMessage = error.issues.map((issue) => issue.message).join(", ");
          } else if (error instanceof Error) {
             errorMessage = error.message;
          }
         console.error(`Invalid parameters for prompt "${name}": ${errorMessage}`, params);
         throw new Error(`Invalid parameters for prompt "${name}": ${errorMessage}`);
       }
    }


    // Ensure the template function exists and is a function
    if (!("template" in promptModule) || typeof promptModule.template !== 'function') {
       throw new Error(`Prompt "${name}" is missing a valid 'template' function.`);
    }
    // Type assertion for the template function
    const templateFn = promptModule.template as (p: PromptParams<T>) => string;

    const formattedPrompt = templateFn(params);

    // Merge default options from the prompt module with call-specific options
    const promptDefaults = ("defaultOptions" in promptModule && promptModule.defaultOptions)
       ? promptModule.defaultOptions
       : {};
    const finalOptions: ChatOptions = { ...promptDefaults, ...options };


    console.log(`Running prompt "${name}" with params:`, params, "Final Options:", finalOptions);
    // Call chatCompletion with the formatted prompt and merged options
    return this.chatCompletion(formattedPrompt, finalOptions);
  }
} 