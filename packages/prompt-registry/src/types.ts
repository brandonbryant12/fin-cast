export interface PromptRuntime<O = unknown> {
  toMessages(): unknown[]
  validate(raw: unknown): O
}

export interface PromptVersion {
  id: number
  promptKey: string
  version: string
  template: string
  userInstructions: string
  outputSchema: unknown
  inputSchema: unknown
  temperature: number
  maxTokens: number
  isActive: boolean
  createdBy: string | null
  createdAt: Date
}

export interface CompileCapablePromptVersion extends PromptVersion {
  compile: <O = unknown>(placeholders: Record<string, unknown>) => PromptRuntime<O>;
}