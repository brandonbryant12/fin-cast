import * as v from 'valibot';

/**
 * Schema for the parameters required by the podcast script generation prompt.
 */
export const paramsSchema = v.object({
  htmlContent: v.pipe(v.string(), v.minLength(1, 'HTML content cannot be empty.')),
});

/**
 * Type alias for the inferred input type of the paramsSchema.
 */
export type Params = v.InferInput<typeof paramsSchema>;

/**
 * Optional description for this prompt template.
 */
export const description = 'Generates a conversational podcast script between two hosts based on the provided HTML content.';

/**
 * Optional default LLM options for this prompt.
 */
export const defaultOptions = {
  temperature: 0.7,
  maxTokens: 2000, // Increased token limit for potentially longer content
};

/**
 * Creates the prompt string for generating a podcast script.
 *
 * @param params - The parameters object containing the HTML content.
 * @returns The formatted prompt string.
 * @throws {Error} If the params object does not match the schema.
 */
export function template(params: Params): string {
  // Runtime validation for robustness
  try {
    v.parse(paramsSchema, params);
  } catch (error) {
    console.error('Invalid parameters for generate-podcast-script prompt:', error);
     let errorMessage = "An unknown validation error occurred";
     if (error instanceof v.ValiError) {
        errorMessage = error.issues.map((issue) => issue.message).join(", ");
     } else if (error instanceof Error) {
        errorMessage = error.message;
     }
    throw new Error(`Invalid parameters provided to generate-podcast-script prompt: ${errorMessage}`);
  }

  const { htmlContent } = params;

  // Enhanced prompt instructions for clarity and better output control
  return `
You are an expert podcast script writer. Your task is to create an engaging and informative podcast script based *only* on the essential information extracted from the following HTML document.

**Podcast Details:**
- **Hosts:** Alex and Ben
- **Format:** Conversational dialogue.
- **Goal:** Summarize key information, discuss main points insightfully, and provide context or commentary. Avoid just reading the source text.
- **Tone:** Engaging, informative, and natural.
- **Target Length:** Suitable for a 5-10 minute podcast segment.

**Source HTML Content:**
(Focus on the main article/content body. Ignore headers, footers, navigation, ads, sidebars, and irrelevant boilerplate.)
\`\`\`html
${htmlContent}
\`\`\`

**Script Generation Instructions:**
1.  **Analyze:** Carefully read the HTML content to identify the core topic, main arguments, key findings, or narrative points. Disregard non-essential elements.
2.  **Introduction:** Start with a brief intro setting the stage (e.g., "Welcome back to... Today we're discussing...").
3.  **Dialogue:** Write a back-and-forth conversation between Alex and Ben:
    * Introduce and discuss the main points sequentially.
    * Use transition phrases naturally.
    * Incorporate questions to guide the conversation (e.g., "Alex, what was your take on...?").
    * Add brief commentary, opinions, or relevant context to make it more than just a summary.
4.  **Conclusion:** End with a concise summary of the key takeaways and a standard outro.
5.  **Formatting:** Use the example format below for clarity.

**Example Output Format:**

[Intro Music fades in and then fades slightly to background]

Alex: Welcome back to "FinCast Insights"! I'm Alex.

Ben: And I'm Ben. Today, we're dissecting an article about [Mention Topic Clearly].

Alex: Right, Ben. The central theme revolves around [Summarize Main Point 1 concisely]. What struck you most about this aspect?

Ben: Well, Alex, the author emphasized [Discuss Key Detail/Evidence for Point 1]. I found that particularly interesting because [Offer Brief Insight/Connection/Opinion].

Alex: That's a great point. The article also delves into [Summarize Main Point 2 concisely].

Ben: Yes, and the data presented regarding [Discuss Key Detail/Evidence for Point 2] really highlights [Offer Brief Insight/Connection/Opinion]. How did you interpret that?

Alex: I thought... [Alex responds and potentially transitions to the next point].

[...]

Ben: So, wrapping up our discussion on [Mention Topic Clearly], the core takeaways seem to be [Summarize 2-3 key points briefly].

Alex: Absolutely. A thought-provoking read. That's all for this segment of "FinCast Insights".

Ben: Thanks for listening!

[Outro Music fades in]

**--- START SCRIPT ---**
`;
} 