import * as v from 'valibot';
import type { PromptDefinition } from '@repo/ai/prompts';

// --- Input Schema ---
const paramsSchema = v.object({
    htmlContent: v.pipe(v.string(), v.minLength(1, 'HTML content cannot be empty.')),
});
type Params = v.InferInput<typeof paramsSchema>;

// --- Output Schema ---
const dialogueSegmentSchema = v.object({
    speaker: v.picklist(["Alex", "Ben"], "Speaker must be either 'Alex' or 'Ben'."),
    line: v.pipe(v.string(), v.minLength(1, "Dialogue line cannot be empty.")),
});
const outputSchema = v.object({
    title: v.pipe(v.string(), v.minLength(1, "Title cannot be empty.")),
    intro: v.pipe(v.string(), v.minLength(1, "Intro cannot be empty.")),
    dialogue: v.pipe(v.array(dialogueSegmentSchema), v.minLength(1, "Dialogue must contain at least one segment.")),
    outro: v.pipe(v.string(), v.minLength(1, "Outro cannot be empty.")),
});
// Define the specific output type for clarity if needed elsewhere
export type GeneratePodcastScriptOutput = v.InferInput<typeof outputSchema>;

// --- Prompt Definition Object ---
export const generatePodcastScriptPrompt: PromptDefinition<Params, GeneratePodcastScriptOutput> = {
    paramsSchema: paramsSchema,
    outputSchema: outputSchema,
    description: 'Generates a conversational podcast script as JSON based on HTML content.',
    defaultOptions: {
        temperature: 0.7,
        maxTokens: 2500,
        // model: 'gpt-4o-mini' // Example
    },
    template: (params: Params): string => {
        try {
            v.parse(paramsSchema, params);
        } catch (error) {
            let errorMessage = "An unknown validation error occurred";
            if (error instanceof v.ValiError) {
                errorMessage = error.issues.map((issue) => issue.message).join(", ");
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            throw new Error(`Invalid parameters provided to generate-podcast-script prompt: ${errorMessage}`);
        }

        const { htmlContent } = params;

        return `
You are an expert podcast script writer. Your task is to create an engaging podcast script based *only* on the essential information extracted from the following HTML document.

**CRITICAL OUTPUT REQUIREMENT:**
Your entire response MUST be a single, valid JSON object. Do NOT include any text, explanation, markdown formatting, or anything else before or after the JSON object. The JSON object must strictly adhere to the following structure:

\`\`\`json
{
  "title": "string", // A concise title for the podcast segment
  "intro": "string", // Opening line(s) introducing the topic, spoken by Alex.
  "dialogue": [      // An array of dialogue objects
    {
      "speaker": "Alex" | "Ben", // The speaker of the line
      "line": "string"          // The dialogue content
    }
    // ... more dialogue objects
  ],
  "outro": "string" // Closing line(s) summarizing or concluding, spoken by Ben.
}
\`\`\`

**Podcast Details to Incorporate into the JSON:**
- **Hosts:** Alex and Ben
- **Format:** Conversational dialogue within the "dialogue" array.
- **Goal:** Summarize key information from the HTML, discuss main points insightfully, provide context. Avoid just reading the source. Generate natural back-and-forth.
- **Tone:** Engaging, informative.
- **Target Length:** Suitable for a 5-10 minute podcast segment (reflected in the number of dialogue entries).

**Source HTML Content:**
(Focus only on the main article/content. Ignore headers, footers, navigation, ads, sidebars.)
\`\`\`html
${htmlContent}
\`\`\`

**Script Generation Steps (for your internal process):**
1.  **Analyze HTML:** Extract the core topic, main points, and key details.
2.  **Structure JSON:** Create the JSON object according to the required schema.
3.  **Write Intro:** Populate the "intro" field (Alex speaking).
4.  **Write Dialogue:** Populate the "dialogue" array with back-and-forth conversation between Alex and Ben, discussing the extracted points. Use natural transitions and incorporate commentary.
5.  **Write Outro:** Populate the "outro" field (Ben speaking).
6.  **Validate JSON:** Ensure the final output is a single, valid JSON object matching the schema exactly.

**REMEMBER: Output ONLY the JSON object.**
`;
    },
}; 