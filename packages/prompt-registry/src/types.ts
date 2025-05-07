import type { CoreMessage } from 'ai';

export interface PromptRuntime<O = unknown> {
  toMessages(): CoreMessage[]
  validate(raw: unknown): O
}

export interface PromptVersion {
  id: number
  promptKey: string
  version: number
  template: string
  userInstructions: string
  outputSchema: unknown
  inputSchema: unknown
  temperature: number
  maxTokens: number
  isActive: boolean
  createdBy: string | null
  creatorName: string | null;
  creatorEmail: string | null;
  createdAt: Date
}

export interface CompileCapablePromptVersion extends PromptVersion {
  compile: <O = unknown>(placeholders: Record<string, unknown>) => PromptRuntime<O>;
}