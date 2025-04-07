
import * as v from "valibot";
import * as example from "./example.prompt";

export const prompts = {
  example, 
} as const;

/**
 * The type representing the prompt registry object.
 */
export type PromptRegistry = typeof prompts;

/**
 * A union type of all available prompt names (e.g., "example" | "summarize").
 */
export type PromptName = keyof PromptRegistry;

/**
 * A helper type to get the specific module type for a given prompt name.
 * e.g., PromptModule<"example"> -> typeof example
 */
export type PromptModule<T extends PromptName> = PromptRegistry[T];

/**
 * A helper type to get the **input parameters type** for a given prompt name.
 * Requires the prompt module to export a `Params` type (usually inferred from a schema).
 * e.g., PromptParams<"example"> -> example.Params
 */
export type PromptParams<T extends PromptName> = PromptModule<T> extends {
  Params: infer P;
} ? P
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


export * as example from "./example.prompt";