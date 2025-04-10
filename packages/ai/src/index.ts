export { AIServiceFactory } from "./factory";
export type { AIConfig, SupportedLLMs } from "./factory";

export type { ChatOptions, ChatResponse } from "./types";

export type { LLMInterface } from "./llms/base";

// Re-export Clients
export { OpenAIClient } from "./llms/openai";
export { GeminiClient } from "./llms/gemini";

// Re-export prompts
export * as prompts from "./prompts";

// --- TTS Exports ---
export { createTtsService } from './tts/factory';
export { OpenAITtsService } from './tts/providers/openai';
export type { ITtsService, TtsOptions, VoiceInfo, TtsFactoryConfig } from './tts/types'; 