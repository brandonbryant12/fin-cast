import * as v from 'valibot';
import type { PromptDefinition } from '@repo/ai/prompts';

const paramsSchema = v.object({
    htmlContent: v.pipe(v.string(), v.minLength(1, 'HTML content cannot be empty.')),
    hostName: v.pipe(v.string(), v.minLength(1, 'Host name cannot be empty.')),
    hostPersonalityDescription: v.pipe(v.string(), v.minLength(1, 'Host personality description cannot be empty.')),
    cohostName: v.pipe(v.string(), v.minLength(1, 'Cohost name cannot be empty.')),
    cohostPersonalityDescription: v.pipe(v.string(), v.minLength(1, 'Cohost personality description cannot be empty.')),
});
type Params = v.InferInput<typeof paramsSchema>;

const dialogueSegmentSchema = v.object({
    speaker: v.string(),
    line: v.pipe(v.string(), v.minLength(1, "Dialogue line cannot be empty.")),
});
const outputSchema = v.object({
    title: v.pipe(v.string(), v.minLength(1, "Title cannot be empty.")),
    dialogue: v.pipe(v.array(dialogueSegmentSchema), v.minLength(1, "Dialogue must contain at least one segment.")),
});
export type GeneratePodcastScriptOutput = v.InferInput<typeof outputSchema>;

export const generatePodcastScriptPrompt: PromptDefinition<Params, GeneratePodcastScriptOutput> = {
    paramsSchema: paramsSchema,
    outputSchema: outputSchema,
    description: 'Generates a conversational podcast script as JSON based on HTML content, embodying specific host personalities.',
    defaultOptions: {
        temperature: 0.70,
        maxTokens: 500,
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

        const { htmlContent, hostName, hostPersonalityDescription, cohostName, cohostPersonalityDescription } = params;

        return `
You are an expert podcast script writer. Your task is to create an engaging podcast script based *only* on the essential information extracted from the following HTML document. The script should feature two hosts, "${hostName}" and "${cohostName}", embodying specific personalities.

**Host Personalities:**
* **(Host):** Name is ${hostName}. Personality: ${hostPersonalityDescription}.
* **(Co-host):** Name is ${cohostName}. Personality: ${cohostPersonalityDescription}

**CRITICAL OUTPUT REQUIREMENT:**
Your entire response MUST be a single, valid JSON object. Do NOT include any text, explanation, markdown formatting, or anything else before or after the JSON object. The JSON object must strictly adhere to the following structure:

\`\`\`json
{
  "title": "string",
  "dialogue": [
    {
      "speaker":  ${hostName} | ${cohostName},
      "line": "string"
    }
  ],
}
\`\`\`

**Script Generation Guidelines:**
1.  **Analyze HTML:** Extract the core topic, main points, and key details from the provided HTML. Focus only on the main article/content. Ignore headers, footers, navigation, ads, sidebars.
2.  **Embody Personalities:** Write the dialogue for ${hostName} reflecting ${hostName}'s personality (${hostPersonalityDescription}) and the dialogue for ${cohostName} reflecting ${cohostName}'s personality (${cohostPersonalityDescription}). Create a natural, engaging back-and-forth conversation based on the HTML content.
3.  **Structure JSON:** Create the JSON object according to the required schema.
5.  **Write Dialogue:** Populate the "dialogue" array, ensuring the conversation flows logically and reflects the assigned personalities discussing the HTML content.
7.  **Validate JSON:** Ensure the final output is a single, valid JSON object matching the schema exactly.

**Source HTML Content:**
\`\`\`html
${htmlContent}
\`\`\`

**REMEMBER: Output ONLY the JSON object.**
`;
    },
};