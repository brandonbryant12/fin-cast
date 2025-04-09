import * as v from "valibot";
import * as example from "./example.prompt";
import * as generatePodcastScript from "./generate-podcast-script.prompt";

export const prompts = {
  example,
  generatePodcastScript,
} as const;

/**
 * The type representing the prompt registry object.
 */
export type PromptRegistry = typeof prompts;

/**
 * A union type of all available prompt names (e.g., "example" | "generatePodcastScript").
 */
export type PromptName = keyof PromptRegistry;

/**
 * A helper type to get the specific module type for a given prompt name.
 * e.g., PromptModule<"example"> -> typeof example
 */
export type PromptModule<T extends PromptName> = PromptRegistry[T];

/**
 * A helper type to get the **input parameters type** for a given prompt name.
 * Requires the prompt module to export a `Params` type (usually inferred from `paramsSchema`).
 * e.g., PromptParams<"example"> -> example.Params
 */
export type PromptParams<T extends PromptName> = PromptModule<T> extends {
    // Infer the schema type directly from the exported value
    paramsSchema: infer S extends v.GenericSchema;
} ? v.InferInput<S> // Use valibot's InferInput on the schema
  : never;

/**
 * A helper type to get the **input schema** for a given prompt name.
 * Requires the prompt module to export a `paramsSchema` (Valibot schema).
 * e.g., PromptSchema<"example"> -> typeof example.paramsSchema
 */
export type PromptSchema<T extends PromptName> = PromptModule<T> extends {
  paramsSchema: infer S;
} ? S extends v.GenericSchema ? S : never // Ensure it's a Valibot schema
  : never;

/**
 * A helper type to get the **output schema** for a given prompt name.
 * Requires the prompt module to export an `outputSchema` (Valibot schema).
 * e.g., PromptOutputSchema<"generatePodcastScript"> -> typeof generatePodcastScript.outputSchema
 */
export type PromptOutputSchema<T extends PromptName> = PromptModule<T> extends {
  outputSchema: infer S;
} ? S extends v.GenericSchema ? S : never // Ensure it's a Valibot schema
  : never;


/**
 * A helper type to get the **inferred output type** from a prompt's `outputSchema`.
 * Requires the prompt module to export an `outputSchema`.
 * e.g., PromptOutputType<"generatePodcastScript"> -> generatePodcastScript.Output
 * Defaults to `never` if no outputSchema is found.
 */
export type PromptOutputType<T extends PromptName> = PromptModule<T> extends {
    outputSchema: infer S extends v.GenericSchema;
} ? v.InferOutput<S> // Use valibot's InferOutput on the schema
  : never; // Return never if the prompt doesn't define an outputSchema


/**
 * A helper type to get the **template function** for a given prompt name.
 * Requires the prompt module to export a `template` function.
 */
export type PromptTemplate<T extends PromptName> = PromptModule<T> extends {
  template: infer Func;
} ? Func extends (params: PromptParams<T>) => string ? Func : never
  : never;

/**
 * A helper type to get the **default options** for a given prompt name.
 * Requires the prompt module to optionally export `defaultOptions`.
 */
export type PromptDefaultOptions<T extends PromptName> =
  PromptModule<T> extends { defaultOptions: infer O }
    ? O extends Partial<import("../types").ChatOptions> ? O : never
    : undefined;


// Re-export individual prompt modules for direct access if needed
export * as example from "./example.prompt";
export * as generatePodcastScript from "./generate-podcast-script.prompt";