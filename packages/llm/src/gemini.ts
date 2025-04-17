import { type Content, type Part, GoogleGenAI } from "@google/genai";
import { type CoreMessage } from "ai";
import type { ChatOptions, ChatResponse } from "./types";
import { BaseLLM, type LLMInterface } from "./base_llm";

interface GeminiClientOptions {
    apiKey: string;
    defaultModel?: string;
    defaultSystemPrompt?: string;
}

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

/**
 * Helper to convert Vercel AI CoreMessages to Google GenAI Content format
 * Handles system prompts and maintains chat history properly
 */
function adaptMessagesToGoogleGenAIContent(messages: CoreMessage[], systemPrompt?: string): Content[] {
    const history: Content[] = [];
    
    if (systemPrompt && messages.length > 0 && messages[0]?.role === 'user') {
        history.push({
            role: 'user',
            parts: [{ text: systemPrompt }]
        });
        history.push({
            role: 'model',
            parts: [{ text: 'I understand and will act accordingly.' }]
        });
    }
    
    for (const msg of messages) {
        const parts: Part[] = [];

        if (typeof msg.content === 'string') {
            parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
                if (part && part.type === 'text' && 'text' in part) {
                    parts.push({ text: part.text });
                }
            }
        }

        if (parts.length > 0) {
            history.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts
            });
        }
    }

    return history;
}

export class GeminiClient extends BaseLLM implements LLMInterface {
    private client: GoogleGenAI;
    private options: GeminiClientOptions;

    constructor(options: GeminiClientOptions) {
        super();
        if (!options.apiKey) {
            throw new Error("Gemini API key is required.");
        }
        this.options = {
            apiKey: options.apiKey,
            defaultModel: options.defaultModel ?? DEFAULT_GEMINI_MODEL,
            defaultSystemPrompt: options.defaultSystemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        };

        this.client = new GoogleGenAI({ apiKey: this.options.apiKey });
    }

    /**
     * Executes the actual Gemini API call.
     * This method implements the abstract `_executeModel` from `BaseLLM`.
     * @param request The formatted prompt string or message array.
     * @param options Merged options potentially overriding client defaults.
     * @returns Raw response from the Gemini API.
     */
    protected async _executeModel(
        request: string | CoreMessage[],
        options: ChatOptions,
    ): Promise<ChatResponse<string | null>> {
        const modelId = options?.model ?? this.options.defaultModel ?? DEFAULT_GEMINI_MODEL;
        const systemPrompt = options?.systemPrompt ?? this.options.defaultSystemPrompt ?? '';

        try {
            const contents: Content[] | string = Array.isArray(request)
                ? adaptMessagesToGoogleGenAIContent(request, systemPrompt)
                : request;

            // Use generateContent for both cases now
            const response = await this.client.models.generateContent({
                model: modelId,
                contents: contents,
                // NOTE: Gemini API generationConfig (temp, maxTokens etc.) is set here if needed
                // generationConfig: {
                //   temperature: options.temperature,
                //   maxOutputTokens: options.maxTokens
                // }
            });


            const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
            const usageMetadata = response?.usageMetadata;

            return {
                content: responseText ?? null,
                usage: usageMetadata ? {
                    promptTokens: usageMetadata.promptTokenCount,
                    completionTokens: usageMetadata.candidatesTokenCount,
                    totalTokens: usageMetadata.totalTokenCount
                } : undefined,
                structuredOutput: undefined,
                error: undefined,
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error during API call";
            console.error(
                `Error during Gemini API call (Model: ${modelId}): ${message}`,
                error,
            );

            return {
                content: null,
                usage: undefined,
                structuredOutput: undefined,
                error: `Gemini API Error: ${message}`,
            };
        }
    }
} 