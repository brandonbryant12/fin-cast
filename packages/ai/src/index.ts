export { createLLMService } from './llms/factory';
export type { LLMServiceConfig } from './llms/factory';

export type { ChatOptions, ChatResponse } from "./types";

export type { LLMInterface } from "./llms/base";


export { OpenAIClient } from "./llms/openai";
export { GeminiClient } from "./llms/gemini";


// --- TTS Exports ---
export { createTtsService } from './tts/factory';
export { OpenAITtsService } from './tts/providers/openai';
export type { TtsOptions, VoiceInfo, TtsFactoryConfig, TTSService } from './tts/types'; 