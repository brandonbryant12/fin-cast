/**
 * Options for chat completion requests.
 */
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPrompt?: string;
}

/**
 * Response from a chat completion request.
 */
export interface ChatResponse {
  content: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
} 