import { inspect as utilInspect } from 'node:util';

// --- Interfaces ---

/**
 * Minimal interface for a schema validation library object
 * that has a `parse` method. Works with Zod, Valibot, etc.
 */
export interface SchemaLib<TParseFn extends (input: unknown) => unknown> {
  parse: TParseFn;
  // Optional: Add a method to generate a type representation string if possible
  _getTypeString?: () => string;
}

/**
 * Options for configuring LLM behavior for a specific prompt execution.
 */
export interface PromptOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPrompt?: string; // Overrides default system prompt if provided
}

// --- Default Values ---

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024; // Sensible default
const DEFAULT_TOP_P = 1.0;

const DEFAULT_PROMPT_OPTIONS: Required<PromptOptions> = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
  topP: DEFAULT_TOP_P,
};

// --- Type Alias for Constructor Args (Used by Builder) ---
// Explicitly defined type mirroring the private constructor's arguments
type PromptConstructorArgs<P extends object, O> = {
  name: string;
  description?: string;
  paramSchema: SchemaLib<(input: unknown) => P>;
  outputSchema: SchemaLib<(input: unknown) => O>;
  template: (params: P) => string;
  defaultOptions?: PromptOptions;
};

// Type Alias for the arguments needed by Prompt.define (used by Builder.build)
type PromptDefineArgs<P extends object, O> = Omit<PromptConstructorArgs<P, O>, 'name'> & { name: string };

// --- Prompt Class ---

export class Prompt<TParams extends object, TOutput> {
  /* ---------- Properties ---------- */
  readonly name: string;
  readonly description?: string;

  readonly paramSchema: SchemaLib<(input: unknown) => TParams>;
  readonly outputSchema: SchemaLib<(input: unknown) => TOutput>;

  readonly defaultOptions: Required<PromptOptions>;
  readonly template: (params: TParams) => string;

  /* ---------- Constructor ---------- */
  // Private constructor ensures usage of static factory or builder
  private constructor(args: PromptConstructorArgs<TParams, TOutput>) { // Use the explicit type alias
    if (!args.name) throw new Error("Prompt name cannot be empty.");

    this.name = args.name;
    this.description = args.description;
    this.paramSchema = args.paramSchema;
    this.outputSchema = args.outputSchema;
    this.template = args.template;

    // Merge provided defaults with base defaults
    this.defaultOptions = {
      ...DEFAULT_PROMPT_OPTIONS,
      ...(args.defaultOptions ?? {}),
    };
  }

  /* ---------- Static Factory ---------- */
  /**
   * Defines a new Prompt with strong type inference.
   * @param cfg Configuration object for the prompt.
   * @returns A new Prompt instance.
   */
  static define<P extends object, O>(
    cfg: PromptDefineArgs<P, O> // Use the specific type alias for define args
  ): Prompt<P, O> {
    return new Prompt<P, O>(cfg);
  }

  /* ---------- Fluent Builder ---------- */

  /**
   * Starts building a new Prompt instance using a fluent API.
   * @param name The unique name for the prompt.
   * @returns The first step of the builder.
   */
  static builder(name: string): NameStep {
    // Start with an empty state, only providing the name
    return new PromptBuilder({ name } as Partial<PromptDefineArgs<any, any>>); // Use Partial initially
  }

  /* ---------- Runtime Methods ---------- */

  /**
   * Validates raw input against the parameter schema.
   * Throws an error (e.g., ValiError, ZodError) if validation fails.
   * @param raw The raw input data.
   * @returns The validated and strongly-typed parameters.
   */
  validateParams(raw: unknown): TParams {
    try {
      return this.paramSchema.parse(raw);
    } catch (error: unknown) {
      // Re-throw the original validation error for detailed context
      console.error(`[Prompt "${this.name}"] Input validation failed:`, error);
      throw error;
    }
  }

  /**
   * Renders the full prompt string, including the user template,
   * system prompt preamble, and JSON output instructions.
   * @param params Validated input parameters.
   * @param runtimeOptions Optional overrides for this specific render call.
   * @returns The complete prompt string ready for the LLM.
   */
  render(params: TParams, runtimeOptions?: PromptOptions): { system: string, user: string } {
    // 1. Validate params (defensive check, though usually pre-validated)
    const safeParams = this.validateParams(params); // Ensure params are valid before templating

    // 2. Determine final options for this render
    const finalOptions = { ...this.defaultOptions, ...(runtimeOptions ?? {}) };

    // 3. Render user template
    const userTemplate = this.template(safeParams);

    // 4. Generate output schema instruction
    const outputSchemaRepresentation = this.outputSchema._getTypeString
        ? this.outputSchema._getTypeString()
        : `(Schema: ${this.outputSchema.constructor.name || 'Custom Schema'})`; // Basic fallback

    const jsonInstruction = `\n\n# Output Instructions\nYou MUST respond ONLY with valid JSON that conforms to the following structure:\n\`\`\`typescript\n${outputSchemaRepresentation}\n\`\`\`\nDo NOT include any other text, explanations, or markdown formatting outside the JSON structure.`;

    // 5. Combine parts
    const systemPrompt = finalOptions.systemPrompt;
    const userPrompt = userTemplate + jsonInstruction;

    return { system: systemPrompt, user: userPrompt };
  }

  /**
   * Parses and validates the raw string output from the LLM against the output schema.
   * Assumes the input string is potentially JSON.
   * Throws an error if parsing or validation fails.
   * @param raw The raw string response from the LLM.
   * @returns The validated and strongly-typed output object.
   */
  parseOutput(raw: string): TOutput {
    let parsedJson: unknown;
    try {
      // Basic cleaning: remove potential markdown fences
      const cleaned = raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim();
      if (!cleaned) {
          throw new Error("Received empty content after cleaning.");
      }
      parsedJson = JSON.parse(cleaned);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Prompt "${this.name}"] Failed to parse LLM output as JSON: ${message}. Raw: "${raw.substring(0, 100)}..."`);
      // Throw a new error with context, or re-throw specific JSON parse errors
      throw new Error(`[Prompt "${this.name}"] JSON Parsing Error: ${message}`);
    }

    try {
      return this.outputSchema.parse(parsedJson);
    } catch (error: unknown) {
      // Re-throw the original validation error
      console.error(`[Prompt "${this.name}"] Output validation failed:`, error);
      throw error; // Throw validation error (e.g., ValiError, ZodError)
    }
  }

  /**
   * Creates a *new* Prompt instance with overridden default options.
   * Useful for creating variations of a base prompt.
   * @param overrides The options to override.
   * @returns A new Prompt instance with the merged options.
   */
  withOptions(overrides: PromptOptions): Prompt<TParams, TOutput> {
    // Re-use the private constructor to create the new instance
    return new Prompt<TParams, TOutput>({
      ...this.toJSON(), // Spread existing properties (might need adjustment if toJSON isn't perfect)
      template: this.template, // Ensure function is carried over
      paramSchema: this.paramSchema, // Ensure schema is carried over
      outputSchema: this.outputSchema, // Ensure schema is carried over
      defaultOptions: { ...this.defaultOptions, ...overrides },
    });
  }

  /* ---------- Introspection / Serialization ---------- */

  /**
   * Returns a plain object representation of the prompt's configuration.
   * Note: Schemas and template function are not directly serializable.
   */
  toJSON(): PromptConstructorArgs<TParams, TOutput> { // Return the constructor args type
    return {
      name: this.name,
      description: this.description,
      defaultOptions: this.defaultOptions,
      paramSchema: this.paramSchema, // Keep the actual schema object
      outputSchema: this.outputSchema, // Keep the actual schema object
      template: this.template, // Keep the actual function
    };
  }

  /**
   * Provides a detailed string representation for debugging.
   */
  inspect() {
    // Adapt inspect to handle non-serializable fields better if needed
    const data = this.toJSON();
    const displayData = {
        ...data,
        paramSchema: `Schema: ${data.paramSchema.constructor.name || 'Custom'} ${data.paramSchema._getTypeString ? `(${data.paramSchema._getTypeString()})` : ''}` ,
        outputSchema: `Schema: ${data.outputSchema.constructor.name || 'Custom'} ${data.outputSchema._getTypeString ? `(${data.outputSchema._getTypeString()})` : ''}` ,
        template: '[Function]'
    };
    return utilInspect(displayData, { depth: null, colors: true });
  }
}

// --- Fluent Builder Implementation ---
// Define steps using interfaces
interface NameStep {
  describe(description: string): NameStep; // Can still describe after name
  input<P extends object>(schema: SchemaLib<(input: unknown) => P>): OutputSchemaStep<P>;
}

interface OutputSchemaStep<P extends object> {
  output<O>(schema: SchemaLib<(input: unknown) => O>): TemplateStep<P, O>;
}

interface TemplateStep<P extends object, O> {
  template(templateFn: (params: P) => string): BuildStep<P, O>;
}

interface BuildStep<P extends object, O> {
  defaults(options: PromptOptions): BuildStep<P, O>; // Optional
  build(): Prompt<P, O>;
}

// The actual builder class implementing the steps
// Kept generic over P and O, relies on casting and careful state management
class PromptBuilder<P extends object, O> implements NameStep, OutputSchemaStep<P>, TemplateStep<P, O>, BuildStep<P, O> {
  // Store partial args for Prompt.define
  private state: Partial<PromptDefineArgs<P, O>>;

  constructor(initialState: Partial<PromptDefineArgs<P, O>>) {
    this.state = initialState;
  }

  describe(description: string): this {
    this.state.description = description;
    return this; // Return 'this' and rely on interface implementation
  }

  // Input sets the P generic type
  input<NewP extends object>(schema: SchemaLib<(input: unknown) => NewP>): OutputSchemaStep<NewP> {
    this.state.paramSchema = schema as any; // Cast needed
    // We are now transitioning state, P becomes NewP. Return 'this' cast to the next step's interface.
    return this as unknown as OutputSchemaStep<NewP>;
  }

  // Output sets the O generic type
  output<NewO>(schema: SchemaLib<(input: unknown) => NewO>): TemplateStep<P, NewO> {
    this.state.outputSchema = schema as any; // Cast needed
    // We are now transitioning state, O becomes NewO. Return 'this' cast to the next step's interface.
    return this as unknown as TemplateStep<P, NewO>;
  }

  template(templateFn: (params: P) => string): BuildStep<P, O> {
    this.state.template = templateFn as any; // Cast needed
    // Return 'this' cast to the build step interface
    return this as BuildStep<P, O>;
  }

  defaults(options: PromptOptions): BuildStep<P, O> {
    this.state.defaultOptions = { ...(this.state.defaultOptions ?? {}), ...options };
    return this; // Remain in the build step
  }

  build(): Prompt<P, O> {
    // Validate required fields before building
    if (!this.state.name) throw new Error("Builder error: Name is required.");
    if (!this.state.paramSchema) throw new Error("Builder error: Input schema is required.");
    if (!this.state.outputSchema) throw new Error("Builder error: Output schema is required.");
    if (!this.state.template) throw new Error("Builder error: Template function is required.");

    // Final state is cast to the args needed by Prompt.define
    const finalArgs = this.state as PromptDefineArgs<P, O>;

    // Call the static factory method - THIS is allowed
    return Prompt.define<P, O>(finalArgs);
  }
}

// --- Example Usage (Illustrative) ---
/*
import * as v from 'valibot'; // Or import * as z from 'zod';

// Define schemas using your chosen library
const exampleParamSchema = v.object({ topic: v.string() });
const exampleOutputSchema = v.object({ explanation: v.string() });

// Create a Prompt instance using define
const explainPromptDefine = Prompt.define({
  name: "concept-explainer-define",
  description: "Explains a concept simply.",
  paramSchema: exampleParamSchema, // Pass the Valibot/Zod schema object directly
  outputSchema: exampleOutputSchema,
  template: ({ topic }) => `Explain the concept of "${topic}" in simple terms.`,
  defaultOptions: { temperature: 0.5 }
});

// Create a Prompt instance using the builder
const explainPromptBuilder = Prompt.builder("concept-explainer-builder")
    .describe("Explains a concept simply using the builder.")
    .input(exampleParamSchema) // Sets P type
    .output(exampleOutputSchema) // Sets O type
    .template(({ topic }) => `Explain the concept of "${topic}" via the builder.`)
    .defaults({ temperature: 0.6, topP: 0.9 })
    .build();

// --- Later, in your LLM service ---
async function executeMyPrompt(promptInstance: Prompt<any, any>, rawParams: unknown) {
  try {
    // 1. Validate input
    const validatedParams = promptInstance.validateParams(rawParams);

    // 2. Render prompt text (including system prompt and JSON instructions)
    const { system, user } = promptInstance.render(validatedParams);

    // 3. Call LLM (replace with actual LLM call)
    console.log("--- Sending to LLM ---");
    console.log("System:", system);
    console.log("User:", user);
    // const rawResponse = await llmApiClient.chatCompletion({ messages: [{role: 'system', content: system}, {role: 'user', content: user}], ...promptInstance.defaultOptions });
    const fakeRawResponse = `{ "explanation": "The concept of '${validatedParams.topic}' is..." }`; // Simulate LLM response
    console.log("--- Received from LLM ---");
    console.log(fakeRawResponse);

    // 4. Parse and validate output
    const typedOutput = promptInstance.parseOutput(fakeRawResponse);

    console.log("--- Parsed & Validated Output ---");
    console.log(typedOutput); // { explanation: '...' }

    return typedOutput;

  } catch (error) {
    console.error(`Error executing prompt "${promptInstance.name}":`, error);
    // Handle error appropriately
    return null;
  }
}

// Example call
// executeMyPrompt(explainPromptDefine, { topic: "Valibot Schemas" });
// executeMyPrompt(explainPromptBuilder, { topic: "Fluent Builder" });
// executeMyPrompt(explainPromptDefine, { topsy: "Invalid" }); // Example invalid input
*/ 