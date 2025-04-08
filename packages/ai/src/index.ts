export { AIServiceFactory } from "./factory";
export type { AIConfig, SupportedLLMs } from "./factory";

export type { ChatOptions, ChatResponse } from "./types";

export type { LLMInterface } from "./llms/base";

// Re-export OpenAI Client
export { OpenAIClient } from "./llms/openai";

// Re-export prompts
export * as prompts from "./prompts"; 