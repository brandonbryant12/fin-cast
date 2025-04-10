import * as v from "valibot";

// Schema for OpenAI environment variables
export const OpenAIEnvSchema = v.object({
    apiKey: v.string("OpenAI API key is required"),
    baseURL: v.optional(v.pipe(v.string("Must be a valid URL"), v.url())), // Corrected with pipe
});
export type OpenAIEnv = v.InferInput<typeof OpenAIEnvSchema>;

// Schema for Anthropic environment variables (Example)
export const AnthropicEnvSchema = v.object({
    apiKey: v.string("Anthropic API key is required"),
    baseURL: v.optional(v.pipe(v.string("Must be a valid URL"), v.url())),
});
export type AnthropicEnv = v.InferInput<typeof AnthropicEnvSchema>;

// Schema for Gemini environment variables
export const GeminiEnvSchema = v.object({
    apiKey: v.string("Gemini API key is required"),
    // Gemini doesn't typically use a baseURL in the same way,
    // but keeping pattern consistency or for future potential use cases
    // baseURL: v.optional(v.string([v.url()])),
});
export type GeminiEnv = v.InferInput<typeof GeminiEnvSchema>;

// Add other provider schemas here 