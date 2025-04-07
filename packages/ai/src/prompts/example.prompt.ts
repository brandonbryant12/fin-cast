import * as v from "valibot";

// 1. (Optional but recommended) Input validation schema
export const paramsSchema = v.object({
  topic: v.pipe(
    v.string("Topic must be a string."),
    v.minLength(3, "Topic must be at least 3 characters long.")
  ),
  tone: v.optional(v.picklist(["formal", "casual", "humorous"]), "casual"),
});

// 2. Type alias for parameters, inferred from the schema
export type Params = v.InferInput<typeof paramsSchema>;

// 3. Prompt template function
export const template = (params: Params): string => {
  // Optional runtime validation (could also be done in the LLM client)
  try {
    v.parse(paramsSchema, params);
  } catch (error) {
    // Handle validation errors appropriately
    console.error("Invalid parameters for example prompt:", error);
    let errorMessage = "An unknown validation error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error instanceof v.ValiError) {
      // Valibot errors have a specific structure
      errorMessage = error.issues.map((issue) => issue.message).join(", ");
    }
    throw new Error(`Invalid parameters: ${errorMessage}`);
  }

  return `Explain the concept of "${params.topic}" in a ${params.tone} tone.`;
};

// 4. (Optional) Metadata about the prompt
export const description = "Generates an explanation for a given topic and tone.";

// 5. (Optional) Default options for this specific prompt
export const defaultOptions = {
  temperature: 0.7,
  maxTokens: 150,
}; 