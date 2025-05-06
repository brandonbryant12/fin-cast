import type { PromptVersion, PromptRuntime } from './types'
import { jsonSchemaToValibot } from './json-schema-to-valibot'
import * as v from 'valibot'
import Handlebars from 'handlebars'

export class PromptBuilder {
  constructor(private promptVersion: PromptVersion) {}

  compile<O = unknown>(placeholders: Record<string, unknown>): PromptRuntime<O> {
    const systemInstructions = `You are a helpful AI assistant.`;

    const schemaInstruction = `You MUST return JSON matching this schema: ${JSON.stringify(this.promptVersion.outputSchema)}`;

    const userInstructions = this.promptVersion.userInstructions;

    const inputValSchema = jsonSchemaToValibot(this.promptVersion.inputSchema as any)
    v.parse(inputValSchema, placeholders)

    const templateCompiler = Handlebars.compile(this.promptVersion.template);
    const populatedTemplate = templateCompiler({
      ...placeholders,
    });

    const messages = [
      { role: 'system' as const, content: `${systemInstructions}\n${schemaInstruction}` },
      { role: 'user' as const, content: `${userInstructions}\n\n${populatedTemplate}` },
    ];
    const schema = jsonSchemaToValibot(this.promptVersion.outputSchema as any)
    return {
      toMessages: () => messages,
      validate: (raw: unknown) => {
        let data: unknown = raw
        if (typeof raw === 'string') {
          try {
            data = JSON.parse(raw)
          } catch {
            data = raw
          }
        }
        return v.parse(schema, data) as O
      },
    }
  }
}