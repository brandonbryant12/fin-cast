// Re-export factory and core types
export { AIServiceFactory } from "./factory";
export type { AIConfig, SupportedLLMs } from "./factory";

// Re-export utility types
export type { ChatOptions, ChatResponse } from "./types";

// Re-export the LLMInterface explicitly
export type { LLMInterface } from "./llms/base";

// Re-export OpenAI Client
export { OpenAIClient } from "./llms/openai";

// Re-export prompts
export * as prompts from "./prompts"; 