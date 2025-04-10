import { type Content, type GenerateContentResponse, type Part, GoogleGenAI } from "@google/genai";
import { type CoreMessage } from "ai";
import type { ChatOptions, ChatResponse } from "../types";
import { BaseLLM } from "./base_llm";

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

export class GeminiClient extends BaseLLM {
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

    protected async _executeModel(
        promptOrMessages: string | CoreMessage[],
        options: ChatOptions,
    ): Promise<ChatResponse<string | null>> {
        const modelId = options?.model ?? this.options.defaultModel ?? DEFAULT_GEMINI_MODEL;
        const systemPrompt = options?.systemPrompt ?? this.options.defaultSystemPrompt ?? '';

        try {
            let response: GenerateContentResponse;

            // Create a chat instance if we have a message history
            if (Array.isArray(promptOrMessages)) {
                const history = adaptMessagesToGoogleGenAIContent(promptOrMessages, systemPrompt);
                const lastMessage = promptOrMessages[promptOrMessages.length - 1];
                if (!lastMessage || lastMessage.role !== 'user') {
                    throw new Error("Last message must be from user");
                }

                response = await this.client.models.generateContent({
                    model: modelId,
                    contents: history,
                });
            } else {
                // Single prompt case
                response = await this.client.models.generateContent({
                    model: modelId,
                    contents: promptOrMessages,
                });
            }

            // Get the first candidate's text
            const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
            return {
                content: responseText ?? null,
                usage: response.usageMetadata ? {
                    promptTokens: response.usageMetadata.promptTokenCount,
                    completionTokens: response.usageMetadata.candidatesTokenCount,
                    totalTokens: response.usageMetadata.totalTokenCount
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