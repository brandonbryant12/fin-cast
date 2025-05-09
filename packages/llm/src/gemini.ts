import { type Content, type Part, GoogleGenAI } from "@google/genai";
import { type CoreMessage } from "ai";
import type { ChatOptions, ChatResponse } from "./types";
import { type LLMInterface } from "./types";

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

export class GeminiClient implements LLMInterface {
    private client: GoogleGenAI;
    private options: GeminiClientOptions;

    constructor(options: GeminiClientOptions) {
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
     * Executes a chat completion request with the Gemini API.
     *
     * @param promptOrMessages Either a single prompt string or an array of messages.
     * @param options Optional configuration for the chat request.
     * @returns A promise resolving to the chat response.
     */
    public async chatCompletion(
        promptOrMessages: string | CoreMessage[],
        options?: ChatOptions,
    ): Promise<ChatResponse<string | null>> {
        const modelId = options?.model ?? this.options.defaultModel ?? DEFAULT_GEMINI_MODEL;
        const systemPromptForAdapt = options?.systemPrompt ?? this.options.defaultSystemPrompt ?? '';

        let messagesToProcess: CoreMessage[];
        if (typeof promptOrMessages === 'string') {
            messagesToProcess = [{ role: 'user', content: promptOrMessages }];
        } else {
            messagesToProcess = promptOrMessages;
        }

        const finalContents: Content[] = adaptMessagesToGoogleGenAIContent(messagesToProcess, systemPromptForAdapt);

        try {
            const generationConfig: Record<string, any> = {};
            if (options?.temperature !== undefined) {
                generationConfig.temperature = options.temperature;
            }
            if (options?.maxTokens !== undefined) {
                generationConfig.maxOutputTokens = options.maxTokens;
            }

            const apiPayload: { model: string, contents: Content[], generationConfig?: Record<string, any> } = {
                model: modelId,
                contents: finalContents,
            };
            
            if (Object.keys(generationConfig).length > 0) {
                apiPayload.generationConfig = generationConfig;
            }
            
            const response = await this.client.models.generateContent(apiPayload);

            const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
            const usageMetadata = response?.usageMetadata;

            return {
                content: responseText ?? null,
                usage: usageMetadata ? {
                    promptTokens: usageMetadata.promptTokenCount,
                    completionTokens: usageMetadata.candidatesTokenCount,
                    totalTokens: usageMetadata.totalTokenCount,
                } : undefined,
                structuredOutput: undefined,
                error: undefined,
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error during API call";
            console.error(
                `Error during Gemini API call (Model: ${modelId}): ${message}`,
                { errorDetails: error },
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