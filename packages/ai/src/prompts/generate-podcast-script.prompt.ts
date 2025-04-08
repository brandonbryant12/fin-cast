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
  maxTokens: 2000,
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
    throw new Error('Invalid parameters provided to generate-podcast-script prompt.');
  }

  const { htmlContent } = params;

  return `
You are an expert podcast script writer. Your task is to create an engaging podcast script based on the main content extracted from the following HTML document.

The podcast should feature a dialogue between two hosts: Alex and Ben.
Focus on summarizing the key information, discussing the main points, and providing insightful commentary. Avoid simply reading the text verbatim. Make it conversational and natural.

**Source HTML Content:**
\`\`\`html
${htmlContent}
\`\`\`

**Instructions:**
1. Analyze the provided HTML content to understand its main topic and key points. Ignore boilerplate like navigation, ads, and footers. Focus on the core article or content.
2. Write a podcast script with dialogue between Alex and Ben discussing the content.
3. The script should have a clear introduction, discussion of key points, and a concluding summary.
4. Ensure the dialogue flows naturally and sounds like a real conversation.
5. Aim for a script length suitable for a short podcast segment (e.g., 5-10 minutes reading time).

**Example Output Format:**

[Intro Music fades in and then fades slightly to background]

Alex: Welcome back to "Tech Unpacked"! I'm Alex.

Ben: And I'm Ben. Today, we're diving into an interesting piece we found online about [Mention Topic].

Alex: Right, Ben. The core idea seems to be [Summarize main point 1]. What did you find most interesting about that?

Ben: Well, Alex, the article highlighted [Discuss key detail/aspect of point 1]. I thought that was fascinating because [Add commentary/insight].

Alex: Absolutely. And it also touched upon [Summarize main point 2].

Ben: Yes, and the way they explained [Discuss key detail/aspect of point 2] really made me think about [Add commentary/insight].

[...]

Alex: So, to wrap things up, the key takeaways from this article on [Mention Topic] are [Briefly summarize].

Ben: Definitely worth a read. That's all the time we have for today on "Tech Unpacked".

Alex: Thanks for tuning in!

[Outro Music fades in]

**Now, please generate the podcast script based on the provided HTML content.**
`;
} 