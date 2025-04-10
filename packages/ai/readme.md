# AI Package (@repo/ai)

This package centralizes functionalities related to Large Language Model (LLM) interactions within the monorepo. It provides standardized ways to define environment configurations, create typed prompt templates, and potentially interact with different LLM providers.

## Purpose

-   **Shared Logic:** Consolidates AI-related code (prompts, configurations, potentially clients) for reuse across different applications (e.g., `apps/server`, `apps/web`) or other packages.
-   **Type Safety:** Uses `valibot` for schema definition and validation, ensuring that environment variables and prompt parameters adhere to expected formats.
-   **Standardized Prompts:** Offers a structured way to create, manage, and use prompt templates.

## Usage

Applications or other packages within the monorepo can consume this package's exports.

### 1. Environment Configuration

-   Define environment variable schemas for different LLM providers (like OpenAI, Anthropic, Gemini) in `src/env.ts` using `valibot`.
-   These schemas (`OpenAIEnvSchema`, `AnthropicEnvSchema`, `GeminiEnvSchema`, etc.) serve as a reference and for type inference.
-   **Important:** The actual *validation and parsing* of environment variables should happen in the consuming application (e.g., `apps/server/src/env.ts`) by importing the relevant schema from this package and potentially prefixing variable names (e.g., `SERVER_AI_GEMINI_API_KEY`).

### 2. Prompt Templates

-   Import prompt templates (like the `template` function from `src/prompts/example.prompt.ts`) to generate prompts with validated parameters.
-   Use the exported `paramsSchema` for validating inputs before calling the `template` function, or rely on the internal validation within the template itself.
-   Access optional metadata like `description` or `defaultOptions` if needed.

```typescript
// Example in consuming app/package
import {
  template as examplePromptTemplate,
  paramsSchema as exampleParamsSchema,
  Params as ExampleParams,
} from "@repo/ai/prompts/example";
import { safeParse } from "valibot"; // Or your preferred validation method

const params: ExampleParams = {
  topic: "Valibot",
  tone: "formal",
};

// Validate params (optional if template does internal validation)
const result = safeParse(exampleParamsSchema, params);
if (!result.success) {
  console.error("Invalid prompt params:", result.issues);
  // Handle error
} else {
  const prompt = examplePromptTemplate(result.output);
  // Use the generated prompt with an LLM client
  console.log(prompt);
}
```

## Extending the Package

### Adding a New LLM Provider

1.  **Environment Variables:**
    *   Add a new `valibot` schema (e.g., `XYZProviderEnvSchema`) to `src/env.ts` defining the required environment variables (API keys, base URLs, etc.) for the new provider. Follow the existing patterns (see `OpenAIEnvSchema`, `GeminiEnvSchema`).
2.  **Client Implementation:**
    *   Create a new client class (e.g., `src/llms/xyz-provider.ts`) that extends `BaseLLM` (`src/llms/base_llm.ts`).
    *   Implement the required `_executeModel` method using the provider's SDK (e.g., `@ai-sdk/google` for Gemini, `@ai-sdk/openai` for OpenAI).
    *   The constructor should accept an options object with necessary configurations (like `apiKey`).
3.  **Factory Integration:**
    *   Import the new client into `src/factory.ts`.
    *   Add the provider's identifier (e.g., `'xyz'`) to the `SupportedLLMs` type union.
    *   Add the necessary configuration interface to `AIConfig` (e.g., `xyz?: { apiKey: string; }`).
    *   Add a `case` for the new provider in the `createLLM` method within `AIServiceFactory`.
4.  **Index Export:**
    *   Re-export the new client class from `src/index.ts`.
5.  **Documentation:**
    *   Update this `readme.md` to mention the new provider, its configuration requirements, and any specific usage notes.
6.  **Dependencies:**
    *   Add the necessary provider-specific SDK (e.g., `@ai-sdk/google`) to the `dependencies` in `package.json` and run `pnpm install` (or equivalent).

### Creating New Prompt Templates

1.  **Create File:** Add a new file in the `src/prompts/` directory, following the naming convention (e.g., `src/prompts/my-new-prompt.prompt.ts`).
2.  **Define Schema:** Use `valibot` to create a `paramsSchema` object defining the expected input parameters, their types, and validation rules.
3.  **Infer Type:** Define a `Params` type alias using `v.InferInput<typeof paramsSchema>`.
4.  **Implement Template Function:** Create an exported `template` function that accepts the `Params` object and returns the formatted prompt string. Include runtime validation using `v.parse` within a `try...catch` block inside the function for robustness.
5.  **Add Metadata (Optional):** Export `description` (string) and `defaultOptions` (object for LLM settings like `temperature`, `maxTokens`) if desired.
6.  **Export:** Ensure all necessary components (`paramsSchema`, `Params`, `template`, `description`, `defaultOptions`) are exported from the new file.
