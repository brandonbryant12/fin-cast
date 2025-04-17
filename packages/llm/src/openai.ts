import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { type OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { generateText, type CoreMessage, type GenerateTextResult } from "ai";
import type { ChatOptions, ChatResponse } from "./types";
import { BaseLLM, type LLMInterface } from "./base_llm";

interface OpenAIClientOptions {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
    defaultSystemPrompt?: string;
}

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

export class OpenAIClient extends BaseLLM implements LLMInterface {
    private client: OpenAIProvider;
    private options: OpenAIClientOptions;

    constructor(options: OpenAIClientOptions) {
        super();
        if (!options.apiKey) {
            throw new Error("OpenAI API key is required.");
        }
        // Store options including defaults
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
     * Executes the actual OpenAI API call.
     * This method implements the abstract `_executeModel` from `BaseLLM`.
     * @param request The formatted prompt string or message array.
     * @param options Merged options potentially overriding client defaults.
     * @returns Raw response from the OpenAI API.
     */
    protected async _executeModel(
        request: string | CoreMessage[],
        options: ChatOptions,
    ): Promise<ChatResponse<string | null>> {
        const modelId = options?.model ?? this.options.defaultModel;
        const systemPrompt = options?.systemPrompt ?? this.options.defaultSystemPrompt;
        const temperature = options?.temperature;
        const maxTokens = options?.maxTokens;


        try {
            const generateTextParams = {
                model: this.client(modelId as OpenAIChatModelId),
                system: systemPrompt,
                temperature: temperature,
                maxTokens: maxTokens,
                ...(typeof request === 'string'
                    ? { prompt: request }
                    : { messages: request }),
            };

            // Explicitly type the result expected
            const result: GenerateTextResult<never, Record<string, unknown>> = await generateText(generateTextParams);
            const { text, usage } = result;
            return {
                content: text,
                usage: {
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens,
                },
                structuredOutput: undefined, // Raw call doesn't produce structured output
                error: undefined,
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error during API call";
            console.error(
                `Error during OpenAI API call (Model: ${modelId}): ${message}`,
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

} 