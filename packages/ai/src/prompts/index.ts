import * as v from 'valibot'; // Keep valibot if needed for re-export or internal use

// Re-export the core definition type
export type { PromptDefinition } from '../types';

// Export the example prompt's definition object directly
import * as examplePrompt from './example.prompt';
import type { PromptDefinition } from '../types';

// Create and export the definition object for the example prompt
export const examplePromptDefinition: PromptDefinition<examplePrompt.Params, string | null> = {
    paramsSchema: examplePrompt.paramsSchema,
    template: examplePrompt.template,
    defaultOptions: examplePrompt.defaultOptions,
    description: examplePrompt.description,
    // No outputSchema for the basic example, so output type is string | null
};

// You could still export the example module itself if consumers need direct access to its parts
export * as example from './example.prompt';

// --- Cleaned up Helper Type Exports (Optional - Keep if generally useful) ---
/**
 * Helper to infer input params type from a PromptDefinition.
 */
export type InferPromptInput<P extends PromptDefinition<any, any>> =
    P extends PromptDefinition<infer Input, any> ? Input : never;

/**
 * Helper to infer structured output type from a PromptDefinition.
 * Defaults to `never` if no outputSchema exists.
 */
export type InferPromptOutput<P extends PromptDefinition<any, any>> =
    P extends { outputSchema: v.GenericSchema<infer Output> } ? Output : never;