import * as v from "valibot";

export const OpenAIEnvSchema = v.object({
    apiKey: v.string("OpenAI API key is required"),
    baseURL: v.optional(v.pipe(v.string("Must be a valid URL"), v.url())),
});
export type OpenAIEnv = v.InferInput<typeof OpenAIEnvSchema>;

export const AnthropicEnvSchema = v.object({
    apiKey: v.string("Anthropic API key is required"),
    baseURL: v.optional(v.pipe(v.string("Must be a valid URL"), v.url())),
});
export type AnthropicEnv = v.InferInput<typeof AnthropicEnvSchema>;

export const GeminiEnvSchema = v.object({
    apiKey: v.string("Gemini API key is required"),
});
export type GeminiEnv = v.InferInput<typeof GeminiEnvSchema>;