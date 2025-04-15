import * as v from "valibot";

export const paramsSchema = v.object({
  topic: v.pipe(
    v.string("Topic must be a string."),
    v.minLength(3, "Topic must be at least 3 characters long.")
  ),
  tone: v.optional(v.picklist(["formal", "casual", "humorous"]), "casual"),
});

export type Params = v.InferInput<typeof paramsSchema>;

export const template = (params: Params): string => {
  try {
    // Runtime validation for robustness, especially if used directly
    v.parse(paramsSchema, params);
  } catch (error) {
    console.error("Invalid parameters for example prompt:", error);
    let errorMessage = "An unknown validation error occurred";
    // Improved error handling to extract messages from ValiError
    if (error instanceof v.ValiError) {
       errorMessage = error.issues.map((issue) => issue.message).join(", ");
    } else if (error instanceof Error) {
       errorMessage = error.message;
    }
    // Throw a more informative error
    throw new Error(`Invalid parameters for example prompt: ${errorMessage}`);
  }

  // Use validated parameters
  return `Explain the concept of "${params.topic}" in a ${params.tone ?? 'casual'} tone.`;
};

export const description = "Generates an explanation for a given topic and tone.";

export const defaultOptions = {
  temperature: 0.7,
  maxTokens: 150,
}; 