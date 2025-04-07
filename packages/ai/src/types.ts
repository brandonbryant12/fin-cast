// Placeholder for shared types

/**
 * Options for chat completion requests.
 */
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string; // Allow overriding the default model per call
  systemPrompt?: string; // Allow overriding the default system prompt per call
  // Add other common options as needed
}

/**
 * Response from a chat completion request.
 */
export interface ChatResponse {
  content: string | null; // Content of the response
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  // Add other potential response fields (e.g., error, finishReason)
} 