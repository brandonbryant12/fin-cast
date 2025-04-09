import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type CoreMessage } from "ai";
import * as v from "valibot";
import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { OpenAIClient } from "../llms/openai";
import type { PromptDefinition } from "../types";

// Mock SDK parts
vi.mock("@ai-sdk/openai", () => ({
    createOpenAI: vi.fn(() => mockOpenAIProvider),
}));
const mockOpenAIProvider = vi.fn().mockImplementation((modelId) => ({ modelId }));

vi.mock("ai", async (importOriginal: () => Promise<typeof import("ai")>) => {
    const actual = await importOriginal();
    return { ...actual, generateText: vi.fn() };
});

vi.mock("valibot", async (importOriginal: () => Promise<typeof import("valibot")>) => {
    const actual = await importOriginal();
    // Mock parse partially: pass through by default
    const parse = vi.fn((_, data) => data);
    return { ...actual, parse };
});

const typedMockGenerateText = generateText as MockedFunction<typeof generateText>;
const typedMockValibotParse = v.parse as MockedFunction<typeof v.parse>; // Get the mocked parse

// --- Test Setup ---
describe("OpenAIClient", () => {
    const apiKey = "sk-testkey123";
    const validOptions = { apiKey };
    let client: OpenAIClient;

     // Mock prompt definitions for testing BaseLLM's runPrompt via the client
     const mockSimplePromptDef: PromptDefinition<{ query: string }, string | null> = {
        template: (params) => `Answer this: ${params.query}`,
        description: "Simple Prompt",
     };

    const mockOutputSchema = v.object({ answer: v.string() });
    const mockStructuredPromptDef: PromptDefinition<{ question: string }, typeof mockOutputSchema> = {
        paramsSchema: v.object({ question: v.string() }),
        template: (params) => `Structure answer for: ${params.question}`,
        outputSchema: mockOutputSchema as any,
        description: "Structured Prompt",
        defaultOptions: { temperature: 0.2 }
    };


    beforeEach(() => {
        vi.resetAllMocks(); // Reset mocks between tests

        // Default mock implementations for external calls/validators
        typedMockValibotParse.mockImplementation((_, data) => data); // Pass through validation
        typedMockGenerateText.mockResolvedValue({
            text: "Default mock response",
            usage: { promptTokens: 5, completionTokens: 15, totalTokens: 20 },
            finishReason: 'stop',
             // Add other required fields if GenerateTextResult changes
             responseMessages: [], toolCalls: undefined, toolResults: undefined,
             providerMessages: [], prompt: '', logprobs: undefined, warnings: undefined, rawResponse: undefined,
        } as any);

        client = new OpenAIClient(validOptions);
    });

    describe("constructor", () => {
        it("should throw an error if apiKey is missing", () => {
            expect(() => new OpenAIClient({ apiKey: "" })).toThrow("OpenAI API key is required.");
        });

        it("should call createOpenAI with correct options", () => {
            new OpenAIClient({ apiKey, baseURL: "http://test.com" });
            expect(createOpenAI).toHaveBeenCalledWith({ apiKey, baseURL: "http://test.com" });
        });

        it("should set default model and system prompt if not provided", () => {
             const instance = new OpenAIClient({ apiKey });
             // Access private options for testing defaults (use 'as any' or make them protected)
             expect((instance as any).options.defaultModel).toBe("gpt-4o-mini");
             expect((instance as any).options.defaultSystemPrompt).toBe("You are a helpful assistant.");
        });
    });

    describe("_executeModel (Protected Method Test)", () => {
         // Test the core API calling logic directly
        const promptString = "Test execute prompt";
        const messages: CoreMessage[] = [{ role: "user", content: "Test execute message" }];

        it("should call generateText with client defaults when no options provided", async () => {
            // Access protected method for testing (use 'as any')
            await (client as any)._executeModel(promptString, {});
            expect(typedMockGenerateText).toHaveBeenCalledTimes(1);
            const args = typedMockGenerateText.mock.calls[0]![0];
            expect(args.model).toHaveProperty("modelId", "gpt-4o-mini");
            expect(args.system).toBe("You are a helpful assistant.");
            expect(args.prompt).toBe(promptString);
            expect(args.temperature).toBeUndefined(); // No temp override
        });

         it("should call generateText with merged options, overriding defaults", async () => {
            await (client as any)._executeModel(messages, {
                 model: "gpt-4",
                 systemPrompt: "Be quiet",
                 temperature: 0.9,
                 maxTokens: 500
             });
            expect(typedMockGenerateText).toHaveBeenCalledTimes(1);
            const args = typedMockGenerateText.mock.calls[0]![0];
            expect(args.model).toHaveProperty("modelId", "gpt-4");
            expect(args.system).toBe("Be quiet");
            expect(args.messages).toBe(messages);
            expect(args.temperature).toBe(0.9);
            expect(args.maxTokens).toBe(500);
        });

         it("should return correct ChatResponse structure on success", async () => {
            typedMockGenerateText.mockResolvedValue({
                 text: "Success response",
                 usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
                 // Other GenerateTextResult fields...
            } as any);
            const response = await (client as any)._executeModel(promptString, {});
            expect(response).toEqual({
                 content: "Success response",
                 usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
                 structuredOutput: undefined,
                 error: undefined,
            });
        });

        it("should return error structure on generateText failure", async () => {
            const apiError = new Error("API Failed");
            typedMockGenerateText.mockRejectedValue(apiError);
             const response = await (client as any)._executeModel(promptString, {});
            expect(response).toEqual({
                content: null,
                usage: undefined,
                structuredOutput: undefined,
                error: `OpenAI API Error: ${apiError.message}`,
            });
        });
    });

    describe("runPrompt (Integration via BaseLLM)", () => {
         // Test the inherited runPrompt, focusing on interaction with _executeModel

        it("should call _executeModel with formatted prompt and merged options", async () => {
            const executeSpy = vi.spyOn(client as any, '_executeModel');
            const params = { question: "Test?" };
            const callOptions = { temperature: 0.8, maxTokens: 150 }; // Override prompt default temp

            await client.runPrompt(mockStructuredPromptDef, params, callOptions);

            expect(executeSpy).toHaveBeenCalledTimes(1);
            // Check args passed to _executeModel: formatted prompt and *merged* options
            const expectedFormattedPrompt = `Structure answer for: ${params.question}`;
            const expectedMergedOptions = {
                 // Options from callOptions override promptDef.defaultOptions
                 ...callOptions, // { temperature: 0.8, maxTokens: 150 }
             };
            expect(executeSpy).toHaveBeenCalledWith(expectedFormattedPrompt, expect.objectContaining(expectedMergedOptions));
        });

        it("should return structured output when outputSchema is present and validation passes", async () => {
            const llmRawOutput = `{ "answer": "Structured data" }`;
            const expectedParsedOutput = { answer: "Structured data" };
            // Mock _executeModel to return the raw JSON string
            vi.spyOn(client as any, '_executeModel').mockResolvedValue({
                content: llmRawOutput, usage: {promptTokens:1, completionTokens:1, totalTokens:2}, error: undefined
            });
            // Mock parse for the output schema
             typedMockValibotParse.mockImplementation((schema, data) => {
                 if(schema === mockStructuredPromptDef.outputSchema) {
                     expect(data).toEqual(JSON.parse(llmRawOutput));
                     return expectedParsedOutput; // Return the validated object
                 }
                 return data; // Pass through input validation
             });

            const response = await client.runPrompt(mockStructuredPromptDef, { question: "test" });

            expect(response.content).toBe(llmRawOutput);
            expect(response.structuredOutput).toEqual(expectedParsedOutput);
            expect(typedMockValibotParse).toHaveBeenCalledWith(mockStructuredPromptDef.outputSchema, JSON.parse(llmRawOutput));
        });

        it("should return raw content when no outputSchema is present", async () => {
             const llmRawOutput = "Simple text answer";
             vi.spyOn(client as any, '_executeModel').mockResolvedValue({
                content: llmRawOutput, usage: {promptTokens:1, completionTokens:1, totalTokens:2}, error: undefined
            });

            const response = await client.runPrompt(mockSimplePromptDef, { query: "test" });

            expect(response.content).toBe(llmRawOutput);
            expect(response.structuredOutput).toBeUndefined();
            // Ensure parse wasn't called for output (might be called for input if schema existed)
             expect(typedMockValibotParse).not.toHaveBeenCalledWith(mockSimplePromptDef.outputSchema, expect.anything());
        });

        // Error handling tests (like validation failures) are implicitly tested
        // via BaseLLM, but can be added here if needed by mocking _executeModel
        // and triggering validation errors in the mock v.parse.
         it("should re-throw input validation errors from BaseLLM", async () => {
             // Create a minimal valid mock BaseIssue for ValiError
             const mockIssue: v.BaseIssue<unknown> = {
                 kind: "schema",
                 type: "string",
                 input: 123,
                 expected: "string",
                 received: `"number"`,
                 message: "Input bad",
                 // Add path if necessary for more specific tests
             };
             const inputError = new v.ValiError([mockIssue]);

             typedMockValibotParse.mockImplementation((schema) => {
                 if (schema === mockStructuredPromptDef.paramsSchema) {
                     throw inputError;
                 }
                 return {};
             });
             const executeSpy = vi.spyOn(client as any, '_executeModel');

             await expect(
                 client.runPrompt(mockStructuredPromptDef, { question: 123 as any }) // Invalid input type
             ).rejects.toThrow(inputError);
             expect(executeSpy).not.toHaveBeenCalled(); // Should fail before calling model
        });

        // Add tests for JSON parsing errors and output validation errors if desired,
        // though this logic resides in BaseLLM.
    });

     describe("chatCompletion (Integration via BaseLLM)", () => {
         // Test the inherited chatCompletion, ensuring it calls _executeModel

         it("should call _executeModel with the provided arguments", async () => {
             const executeSpy = vi.spyOn(client as any, '_executeModel');
             const messages: CoreMessage[] = [{ role: "user", content: "Test chat" }];
             const options = { temperature: 0.7 };

             await client.chatCompletion(messages, options);

             expect(executeSpy).toHaveBeenCalledTimes(1);
             expect(executeSpy).toHaveBeenCalledWith(messages, options);
         });
     });

});