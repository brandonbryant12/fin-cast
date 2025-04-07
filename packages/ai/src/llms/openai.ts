import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { generateText, type CoreMessage } from "ai";
import type { LLMInterface } from "./base";
import type { ChatOptions, ChatResponse } from "../types";
import * as v from "valibot";
import {
  prompts,
  type PromptName,
  type PromptParams,
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
    this.options = {
      ...options,
      defaultModel: options.defaultModel ?? DEFAULT_MODEL,
      defaultSystemPrompt: options.defaultSystemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    };

    this.client = createOpenAI({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseURL,
    });
  }

  async chatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const modelId = options?.model ?? this.options.defaultModel!;
    const systemPrompt = options?.systemPrompt ?? this.options.defaultSystemPrompt!;

    try {
      const generateTextParams = {
        model: this.client(modelId),
        system: systemPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        messages: [] as CoreMessage[],
        prompt: undefined as string | undefined,
      };

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
      console.error(error);

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
    const promptModule = prompts[name];

    if (!promptModule) {
      throw new Error(`Prompt named "${name}" not found in registry.`);
    }

    if ("paramsSchema" in promptModule && promptModule.paramsSchema) {
      try {
        v.parse(promptModule.paramsSchema, params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Invalid parameters for prompt "${name}": ${message}`, params);
        throw new Error(`Invalid parameters for prompt "${name}": ${message}`);
      }
    }

    if (!("template" in promptModule) || typeof promptModule.template !== 'function') {
      throw new Error(`Prompt "${name}" is missing a valid 'template' function.`);
    }
    const templateFn = promptModule.template as (
      p: PromptParams<T>,
    ) => string;

    const formattedPrompt = templateFn(params);

    const promptDefaults = ("defaultOptions" in promptModule && promptModule.defaultOptions)
        ? promptModule.defaultOptions
        : {};
    const finalOptions = { ...promptDefaults, ...options };

    console.log(`Running prompt "${name}" with params:`, params);
    return this.chatCompletion(formattedPrompt, finalOptions);
  }
} 