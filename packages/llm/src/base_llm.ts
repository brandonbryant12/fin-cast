import { toJsonSchema } from '@valibot/to-json-schema';
import * as v from "valibot";
import type { ChatOptions, ChatResponse, PromptDefinition } from "./types";
import type { CoreMessage } from 'ai';

export interface LLMInterface {
  chatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>>;

  runPrompt<
    TInputParams extends Record<string, unknown>,
    TOutputData = unknown
  >(
    promptDef: PromptDefinition<TInputParams, TOutputData>,
    params: TInputParams,
    options?: ChatOptions,
  ): Promise<ChatResponse<TOutputData>>;
}

export abstract class BaseLLM implements LLMInterface {
  protected abstract _executeModel(
    request: string | CoreMessage[],
    options: ChatOptions,
  ): Promise<ChatResponse<string | null>>;

  protected preValidateParams<P extends Record<string, any>>(
    def: PromptDefinition<P, unknown>,
    params: P,
  ): P {
    if (def.paramsSchema) {
      try {
        return v.parse(def.paramsSchema, params);
      } catch (error: unknown) {
        const promptName = def.description || 'unnamed prompt';
        if (error instanceof v.ValiError) {
          const errorMessage = error.issues.map((issue) => `${issue.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${issue.message}`).join("; ");
          console.error(`[LLM Prompt Error - Base] Invalid input parameters for prompt "${promptName}": ${errorMessage}`, { params, issues: error.issues });
          throw new v.ValiError(error.issues);
        } else {
          const message = error instanceof Error ? error.message : "Unknown validation error";
          console.error(`[LLM Prompt Error - Base] Error during input validation for prompt "${promptName}": ${message}`, { params, error });
          throw new Error(`Input validation failed for prompt "${promptName}": ${message}`);
        }
      }
    }
    return params;
  }

  protected renderPrompt<
    TInputParams extends Record<string, unknown>,
    TOutputData = unknown
  >(
    def: PromptDefinition<TInputParams, TOutputData>,
    params: TInputParams
  ): string {
    const corePrompt = def.template(params);
    const jsonSchemaDefinition = toJsonSchema(def.outputSchema);
    const jsonSchemaString = JSON.stringify(jsonSchemaDefinition, null, 2);
    const instruction =
      `\n\n---\n` +
      `You MUST reply with **only** a valid JSON object that strictly conforms to the following JSON Schema definition. Do not include any other text, explanations, or markdown formatting outside of the JSON:\n` +
        + jsonSchemaString;
    console.log({ prompt: corePrompt + instruction});
    return corePrompt + instruction;
  }

  protected postProcessRaw(raw: string | null | undefined): string {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    const jsonFenceRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
    const match = trimmed.match(jsonFenceRegex);
    return (match?.[1] ?? trimmed).trim();
  }

  protected parseJson(cleanedJsonString: string): unknown | undefined {
    if (!cleanedJsonString) return undefined;
    try {
      return JSON.parse(cleanedJsonString);
    } catch (e) {
      console.warn(`[LLM Prompt - Base] Failed to parse JSON: ${(e as Error).message}. Content: "${cleanedJsonString.substring(0,100)}..."`);
      return undefined;
    }
  }

  protected validateOutput<
    TOutputData = unknown
  >(
      schema: v.GenericSchema<TOutputData>,
      parsed: unknown,
      promptName: string
  ): TOutputData {
      if (schema) {
          try {
              return v.parse(schema, parsed) as TOutputData;
          } catch (error: unknown) {
              if (error instanceof v.ValiError) {
                  const errorMessage = error.issues.map((issue) => `${issue.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${issue.message} (received: ${JSON.stringify(issue.input)})`).join("; ");
                  console.error(`[LLM Prompt Error - Base] LLM output failed schema validation for prompt "${promptName}": ${errorMessage}`, { parsedJson: parsed, issues: error.issues });
                  throw new v.ValiError(error.issues);
              } else {
                  const message = error instanceof Error ? error.message : "Unknown validation error";
                  console.error(`[LLM Prompt Error - Base] Error during output validation for prompt "${promptName}": ${message}`, { parsedJson: parsed, error });
                  throw new Error(`Output validation failed for prompt "${promptName}": ${message}`);
              }
          }
      }
      return parsed as TOutputData;
  }

  async runPrompt<
    TInputParams extends Record<string, unknown>,
    TOutputData = unknown
  >(
    def: PromptDefinition<TInputParams, TOutputData>,
    params: TInputParams,
    options?: ChatOptions,
  ): Promise<ChatResponse<TOutputData>> {
    const promptName = def.description || 'unnamed prompt';
    let validatedParams: TInputParams;
    let formattedPrompt: string;
    let rawResponse: ChatResponse<string | null> | undefined = undefined;
    let cleanedContent: string;
    let parsedJson: unknown | undefined;
    const baseErrorMessage = `Error processing prompt "${promptName}"`;
    let specificError = "An unknown error occurred.";

    try {
      validatedParams = this.preValidateParams(def, params);
      formattedPrompt = this.renderPrompt(def, validatedParams);

      const finalOptions: ChatOptions = {
        ...def.defaultOptions,
        ...(options ?? {}),
      };

      console.log(`[LLM Prompt - Base] Running prompt "${promptName}"`, { params: validatedParams, finalOptions });

      rawResponse = await this._executeModel(formattedPrompt, finalOptions);

      if (rawResponse.content === null || rawResponse.error) {
        const errorMsg = rawResponse.error || 'Content was null';
        console.error(`[LLM Prompt Error - Base] LLM execution failed for prompt "${promptName}": ${errorMsg}`, { rawResponse });
        return {
          content: rawResponse.content,
          usage: rawResponse.usage,
          structuredOutput: undefined as TOutputData,
          error: rawResponse.error ?? `LLM execution failed for prompt "${promptName}": Content was null`,
        };
      }

      cleanedContent = this.postProcessRaw(rawResponse.content);
      parsedJson = this.parseJson(cleanedContent);

      if (parsedJson === undefined) {
        console.error(`[LLM Prompt Error - Base] Failed to parse LLM output as JSON for prompt "${promptName}". Cleaned Content: "${cleanedContent.substring(0,150)}..."`, { rawContent: rawResponse.content});
        return {
          content: rawResponse.content,
          usage: rawResponse.usage,
          structuredOutput: undefined as TOutputData,
          error: `Failed to parse LLM output as JSON for prompt "${promptName}".`,
        };
      }

      const structuredOutput = this.validateOutput<TOutputData>(def.outputSchema, parsedJson, promptName);
      console.log(`[LLM Prompt - Base] Successfully parsed and validated structured output for prompt "${promptName}".`);

      return {
        content: rawResponse.content,
        usage: rawResponse.usage,
        structuredOutput,
        error: undefined,
      };

    } catch (error: unknown) {
        if (error instanceof v.ValiError) {
            specificError = `Validation failed: ${error.issues.map(i => `${i.path?.map((p: { key: string | number }) => p.key).join('.') || 'root'}: ${i.message}`).join('; ')}`;
            console.error(`${baseErrorMessage}: ${specificError}`, { error: error.issues });
        } else if (error instanceof Error) {
            specificError = error.message;
            console.error(`${baseErrorMessage}: ${specificError}`, { error });
        } else {
            console.error(`${baseErrorMessage}: ${specificError}`, { error });
        }

        const responseBase = rawResponse ?? { content: null, usage: undefined };
        return {
            content: responseBase.content,
            usage: responseBase.usage,
            structuredOutput: undefined as TOutputData,
            error: `${baseErrorMessage}: ${specificError}`,
        };
    }
  }

  async chatCompletion(
    promptOrMessages: string | CoreMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse<string | null>> {
    const finalOptions = { ...(options ?? {}) };
    return this._executeModel(promptOrMessages, finalOptions);
  }
}