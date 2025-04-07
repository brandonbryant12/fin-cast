import * as v from "valibot";

/**
 * Valibot schema for OpenAI configuration environment variables.
 * NOTE: This is for reference and type inference only. Environment variables
 * are validated and parsed in the consuming application (e.g., apps/server).
 */
export const OpenAIEnvSchema = v.object({
  // Consuming app should define e.g., SERVER_AI_OPENAI_API_KEY
  AI_OPENAI_API_KEY: v.pipe(
    v.string(),
    v.minLength(1, "OpenAI API Key is required."),
    v.startsWith("sk-", "Invalid OpenAI API Key format."),
  ),
  // Consuming app should define e.g., SERVER_AI_OPENAI_BASE_URL (optional)
  AI_OPENAI_BASE_URL: v.optional(
    v.pipe(v.string(), v.url("Must be a valid URL.")),
  ),
});

/**
 * Valibot schema for Anthropic configuration environment variables (Example).
 * NOTE: For reference only.
 */
export const AnthropicEnvSchema = v.object({
  // Consuming app should define e.g., SERVER_AI_ANTHROPIC_API_KEY
  AI_ANTHROPIC_API_KEY: v.pipe(
    v.string(),
    v.minLength(1, "Anthropic API Key is required."),
    // Add specific validation if known (e.g., startsWith)
  ),
  // Consuming app should define e.g., SERVER_AI_ANTHROPIC_BASE_URL (optional)
  AI_ANTHROPIC_BASE_URL: v.optional(
    v.pipe(v.string(), v.url("Must be a valid URL.")),
  ),
});

// Add schemas for other providers as needed 