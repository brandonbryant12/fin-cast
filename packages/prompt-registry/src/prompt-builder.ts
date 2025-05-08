import Handlebars from 'handlebars';
import * as v from 'valibot';
import type { PromptVersion, PromptRuntime } from './types';
import type { CoreMessage } from 'ai';
import { jsonSchemaToValibot } from './json-schema-to-valibot';

export class PromptBuilder {
  constructor(private promptVersion: PromptVersion) {}

  compile<O = unknown>(placeholders: Record<string, unknown>): PromptRuntime<O> {
    const schemaInstruction = `**Validate JSON:** Ensure the final output is a single, valid complete JSON object matching the schema exactly.


**REMEMBER: Output ONLY the JSON object.**
You MUST return JSON matching this schema: ${JSON.stringify(this.promptVersion.outputSchema)}`;
    const systemPrompt = this.promptVersion.systemPrompt;
    const inputValSchema = jsonSchemaToValibot(this.promptVersion.inputSchema as any);
    v.parse(inputValSchema, placeholders);
    const populatedTemplate = Handlebars.compile(this.promptVersion.template)({ ...placeholders });
    const messages: CoreMessage[] = [
      { role: 'system', content: `${systemPrompt}` },
      { role: 'user', content: `<schemaInstruction>${schemaInstruction}</schemaInstruction>\n\n${placeholders.userInstructions ? `<userInstructions>${placeholders.userInstructions}</userInstructions>\n\n` : ''}${populatedTemplate}\n<schemaInstruction>${schemaInstruction}</schemaInstruction>` }
    ];
    const schema = jsonSchemaToValibot(this.promptVersion.outputSchema as any);

    
    return {
      toMessages: () => messages,
      validate: (raw: unknown) => {
        let data: unknown = raw;
        if (typeof raw === 'string') {
          let s = raw;
          const m = raw.match(/```json\n([\s\S]*?)```/s);
          if (m && m[1]) s = m[1].trim();
          try { data = JSON.parse(s); } catch { data = s; }
        }
        return v.parse(schema, data) as O;
      }
    };
  }
}