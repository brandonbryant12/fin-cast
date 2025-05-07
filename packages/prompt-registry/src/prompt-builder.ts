import Handlebars from 'handlebars';
import * as v from 'valibot';
import type { PromptVersion, PromptRuntime } from './types';
import type { CoreMessage } from 'ai';
import { jsonSchemaToValibot } from './json-schema-to-valibot';

export class PromptBuilder {
  constructor(private promptVersion: PromptVersion) {}

  compile<O = unknown>(placeholders: Record<string, unknown>): PromptRuntime<O> {
    const systemInstructions = `You are a helpful AI assistant.`;

    const schemaInstruction = `You MUST return JSON matching this schema: ${JSON.stringify(this.promptVersion.outputSchema)}`;

    const userInstructions = this.promptVersion.userInstructions;

    const inputValSchema = jsonSchemaToValibot(this.promptVersion.inputSchema as any);
    v.parse(inputValSchema, placeholders);

    const templateCompiler = Handlebars.compile(this.promptVersion.template);
    const populatedTemplate = templateCompiler({
      ...placeholders,
    });

    const messages: CoreMessage[] = [
      { role: 'system' as const, content: `${systemInstructions}\n${schemaInstruction}` },
      { role: 'user' as const, content: `${userInstructions}\n\n${populatedTemplate}` },
    ] as CoreMessage[];
    const schema = jsonSchemaToValibot(this.promptVersion.outputSchema as any);
    return {
      toMessages: () => messages,
      validate: (raw: unknown) => {
        let data: unknown = raw;
        if (typeof raw === 'string') {
          let stringToParse = raw;
          const match = raw.match(/```json\n([\s\S]*?)```/s);
          if (match && match[1]) {
            stringToParse = match[1].trim();
          }
          try {
            data = JSON.parse(stringToParse);
          } catch {
            data = stringToParse; 
          }
        }
        return v.parse(schema, data) as O;
      },
    };
  }
}