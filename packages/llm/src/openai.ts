import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { type OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { generateText, type CoreMessage, type GenerateTextResult } from "ai";
import type { ChatOptions, ChatResponse } from "./types";
import { type LLMInterface } from "./types";

interface OpenAIClientOptions {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
    defaultSystemPrompt?: string;
}

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

export class OpenAIClient implements LLMInterface {
    private client: OpenAIProvider;
    private options: OpenAIClientOptions;

    constructor(options: OpenAIClientOptions) {
        if (!options.apiKey) {
            throw new Error("OpenAI API key is required.");
        }
        this.options = {
            apiKey: options.apiKey,
            baseURL: options.baseURL,
            defaultModel: options.defaultModel ?? DEFAULT_MODEL,
            defaultSystemPrompt: options.defaultSystemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        };

        // Initialize the OpenAI provider client
        this.client = createOpenAI({
            apiKey: this.options.apiKey,
            ...(options.baseURL && { baseURL: options.baseURL }),
        });
    }

    /**
     * Executes a chat completion request with the OpenAI API.
     *
     * @param promptOrMessages Either a single prompt string or an array of messages.
     * @param options Optional configuration for the chat request.
     * @returns A promise resolving to the chat response.
     */
    public async chatCompletion(
        promptOrMessages: string | CoreMessage[],
        options?: ChatOptions, // options is optional here
    ): Promise<ChatResponse<string | null>> {
        // Resolve options, providing empty object if undefined to simplify access
        const currentOptions = options ?? {};

        const modelId = currentOptions.model ?? this.options.defaultModel;
        const systemPrompt = currentOptions.systemPrompt ?? this.options.defaultSystemPrompt;
        const temperature = currentOptions.temperature;
        const maxTokens = currentOptions.maxTokens;

        try {
            const generateTextParams: any = {
                model: this.client(modelId as OpenAIChatModelId),
                system: systemPrompt, // System prompt is always passed
            };

            // Conditionally add temperature and maxTokens if they are defined
            if (temperature !== undefined) {
                generateTextParams.temperature = temperature;
            }
            if (maxTokens !== undefined) {
                generateTextParams.maxTokens = maxTokens;
            }

            // Add prompt or messages based on the type of promptOrMessages
            if (typeof promptOrMessages === 'string') {
                generateTextParams.prompt = promptOrMessages;
            } else {
                generateTextParams.messages = promptOrMessages;
            }

            const result: GenerateTextResult<never, Record<string, unknown>> = await generateText(generateTextParams);
            const { text, usage } = result;
            return {
                content: text,
                usage: {
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens,
                },
                structuredOutput: undefined,
                error: undefined,
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error during API call";
            console.error(
                `Error during OpenAI API call (Model: ${modelId}): ${message}`,
                error,
            );

            return {
                content: null,
                usage: undefined,
                structuredOutput: undefined,
                error: `OpenAI API Error: ${message}`,
            };
        }
    }
} 