import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type CoreMessage } from "ai";
import { parse } from "valibot";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIClient } from "../llms/openai";
import { prompts, type PromptParams } from "../prompts";

vi.mock("@ai-sdk/openai", () => ({
    createOpenAI: vi.fn(() => mockOpenAIProvider),
}));

const mockOpenAIProvider = vi.fn().mockImplementation((modelId) => ({
    modelId: modelId,
}));

vi.mock("ai", async (importOriginal: () => Promise<typeof import("ai")>) => {
    const actual = await importOriginal();
    return {
        ...actual,
        generateText: vi.fn(),
    };
});

vi.mock("valibot", async (importOriginal: () => Promise<typeof import("valibot")>) => {
    const actual = await importOriginal();
    return {
        ...actual,
        parse: vi.fn(),
    };
});

const typedMockGenerateText = vi.mocked(generateText);
const typedMockValibotParseFn = vi.mocked(parse);

// --- Tests ---
describe("OpenAIClient", () => {
    const apiKey = "sk-testkey123";
    const validOptions = { apiKey };
    let client: OpenAIClient;

    beforeEach(() => {
        vi.restoreAllMocks();
        
        typedMockValibotParseFn.mockImplementation(() => {});
        // @ts-expect-error - Ignoring complex GenerateTextResult type for mock simplicity
        typedMockGenerateText.mockResolvedValue({
            text: "Mock response",
        });

        client = new OpenAIClient(validOptions);
    });

    describe("constructor", () => {
        it("should throw an error if apiKey is missing", () => {
            expect(() => new OpenAIClient({ apiKey: "" })).toThrow(
                "OpenAI API key is required.",
            );
        });

        it("should call createOpenAI and store the provider", () => {
             const specificClient = new OpenAIClient(validOptions);
             expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
                 apiKey: apiKey,
                 baseURL: undefined,
             });
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             expect((specificClient as any).client).toBe(mockOpenAIProvider);
        });

         it("should store the configured provider instance (using beforeEach instance)", () => {
             expect(vi.mocked(createOpenAI)).toHaveBeenCalled();
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             expect((client as any).client).toBe(mockOpenAIProvider);
         });
    });

    describe("chatCompletion", () => {
        const prompt = "Test prompt";
        const messages: CoreMessage[] = [{ role: "user", content: "Test message" }];

        it("should call generateText with correct parameters using prompt string", async () => {
            const response = await client.chatCompletion(prompt);
            expect(typedMockGenerateText).toHaveBeenCalledTimes(1);
            const generateTextArgs = typedMockGenerateText.mock.calls[0]![0];
            expect(generateTextArgs.model).toBeDefined();
            expect(generateTextArgs.model).toHaveProperty("modelId", "gpt-4o-mini");
            expect(generateTextArgs.prompt).toBe(prompt);
            expect(generateTextArgs.messages).toEqual([]);
            expect(generateTextArgs.system).toBe("You are a helpful assistant.");
            expect(response.content).toBe("Mock response");
        });

        it("should call generateText with correct parameters using messages array", async () => {
            await client.chatCompletion(messages);
            expect(typedMockGenerateText).toHaveBeenCalledTimes(1);
            const generateTextArgs = typedMockGenerateText.mock.calls[0]![0];
            expect(generateTextArgs.model).toBeDefined();
            expect(generateTextArgs.model).toHaveProperty("modelId", "gpt-4o-mini");
            expect(generateTextArgs.prompt).toBeUndefined();
            expect(generateTextArgs.messages).toBe(messages);
            expect(generateTextArgs.system).toBe("You are a helpful assistant.");
        });

        it("should allow overriding model and system prompt via options", async () => {
            await client.chatCompletion(prompt, {
                model: "gpt-4",
                systemPrompt: "Be concise",
            });
            expect(typedMockGenerateText).toHaveBeenCalledTimes(1);
            const generateTextArgs = typedMockGenerateText.mock.calls[0]![0];
            expect(generateTextArgs.model).toBeDefined();
            expect(generateTextArgs.model).toHaveProperty("modelId", "gpt-4");
            expect(generateTextArgs.system).toBe("Be concise");
        });

        it("should return null content on generateText error", async () => {
            const error = new Error("API Error");
            typedMockGenerateText.mockRejectedValue(error);
            const response = await client.chatCompletion(prompt);
            expect(response.content).toBeNull();
        });
    });

    describe("runPrompt", () => {
        const exampleParams = {
            topic: "testing",
            tone: "formal" as const,
        };
        it("should successfully run a registered prompt", async () => {
            const response = await client.runPrompt(
                "example",
                exampleParams as PromptParams<"example">,
            );
            expect(typedMockValibotParseFn).toHaveBeenCalledWith(
                prompts.example.paramsSchema,
                exampleParams,
            );
            expect(typedMockGenerateText).toHaveBeenCalledTimes(1);
            const generateTextArgs = typedMockGenerateText.mock.calls[0]![0];
            expect(generateTextArgs.model).toBeDefined();
            expect(generateTextArgs.model).toHaveProperty("modelId", "gpt-4o-mini");
            expect(generateTextArgs.prompt).toBe(
                `Explain the concept of "testing" in a formal tone.`,
            );
            expect(generateTextArgs.temperature).toBe(0.7);
            expect(generateTextArgs.maxTokens).toBe(150);
            expect(response.content).toBe("Mock response");
        });

        it("should override prompt default options with call-specific options", async () => {
            await client.runPrompt(
                "example",
                exampleParams as PromptParams<"example">,
                {
                    temperature: 0.9,
                    maxTokens: 50,
                    model: 'gpt-3.5-turbo'
                },
            );
            expect(typedMockGenerateText).toHaveBeenCalledTimes(1);
            const generateTextArgs = typedMockGenerateText.mock.calls[0]![0];
            expect(generateTextArgs.model).toBeDefined();
            expect(generateTextArgs.model).toHaveProperty("modelId", "gpt-3.5-turbo");
            expect(generateTextArgs.temperature).toBe(0.9);
            expect(generateTextArgs.maxTokens).toBe(50);
        });

        it("should throw an error if prompt validation fails", async () => {
            const validationError = new Error("Invalid topic");
            typedMockValibotParseFn.mockImplementation(() => {
                throw validationError;
            });
            await expect(
                client.runPrompt("example", exampleParams as PromptParams<"example">),
            ).rejects.toThrow(
                `Invalid parameters for prompt "example": ${validationError.message}`,
            );
            expect(typedMockGenerateText).not.toHaveBeenCalled();
        });

        it("should throw an error for an unregistered prompt name", async () => {
            await expect(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                client.runPrompt("nonexistent" as any, {}),
            ).rejects.toThrow('Prompt named "nonexistent" not found in registry.');
            expect(typedMockGenerateText).not.toHaveBeenCalled();
        });
    });
});