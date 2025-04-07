import { describe, it, expect } from "vitest";
import { AIServiceFactory, type AIConfig } from "../factory";
import { OpenAIClient } from "../llms/openai";

// Mock the OpenAIClient constructor if needed for more isolated tests
// vi.mock("../llms/openai");

describe("AIServiceFactory", () => {
  describe("createLLM", () => {
    const validOpenAIConfig: AIConfig = {
      openai: { apiKey: "sk-testkey123" },
    };
    const invalidOpenAIConfig: AIConfig = {
      openai: { apiKey: "" },
    };
    const missingOpenAIConfig: AIConfig = {};
    const anthropicConfig: AIConfig = {
      anthropic: { apiKey: "ak-testkey456" },
    };

    it("should create an OpenAIClient for type 'openai' with valid config", () => {
      const llm = AIServiceFactory.createLLM("openai", validOpenAIConfig);
      expect(llm).toBeInstanceOf(OpenAIClient);
    });

    it("should throw an error if OpenAI config is missing or invalid", () => {
      expect(() =>
        AIServiceFactory.createLLM("openai", invalidOpenAIConfig),
      ).toThrow(
        "OpenAI configuration (apiKey) is required but missing in the provided AIConfig.",
      );
      expect(() =>
        AIServiceFactory.createLLM("openai", missingOpenAIConfig),
      ).toThrow(
        "OpenAI configuration (apiKey) is required but missing in the provided AIConfig.",
      );
    });

    it("should throw an error for unimplemented type 'anthropic'", () => {
      expect(() => AIServiceFactory.createLLM("anthropic", anthropicConfig)).toThrow(
        "Anthropic client not yet implemented.",
      );
    });

    it("should throw an error for unknown LLM types", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => AIServiceFactory.createLLM("unknown-llm" as any, {})).toThrow(
        "Unsupported LLM type: unknown-llm"
      );
    });
  });
}); 