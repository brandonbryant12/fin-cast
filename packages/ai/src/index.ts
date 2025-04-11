export { createLLMService } from './llms/factory';
export type { LLMServiceConfig } from './llms/factory';

export type { ChatOptions, ChatResponse } from "./types";

export type { LLMInterface } from "./llms/base";


export { OpenAIClient } from "./llms/openai";
export { GeminiClient } from "./llms/gemini";


export { createTtsService } from './tts/factory';
export { OpenAITtsService } from './tts/openai/client';
export type { TtsOptions, VoiceInfo, TtsFactoryConfig, TTSService } from './tts/types';
export { PersonalityId, personalities, getPersonalityInfo } from './tts/personalities';
export type { PersonalityInfo } from './tts/personalities';