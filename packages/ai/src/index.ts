// Main entry point for the @repo/ai package

// Export the factory
export { AIServiceFactory } from "./factory";

// Export core types and interfaces
export type { AIConfig, SupportedLLMs } from "./factory";
export type { ChatOptions, ChatResponse } from "./types";
export type { LLMInterface } from "./llms/base";

// Export LLM client implementations (optional, maybe only expose via factory)
// export { OpenAIClient } from "./llms/openai";

// Export prompt types (if needed directly by consumers)
// Exporting the generated index might be more useful once implemented
// export * as prompts from "./prompts"; 