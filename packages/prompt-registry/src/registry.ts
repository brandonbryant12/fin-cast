import { PromptBuilder } from './prompt-builder'
import type { PromptVersion, CompileCapablePromptVersion } from './types'
import { promptDefinition, type NewPromptDefinition } from '@repo/db/schema'
import type { DatabaseInstance } from '@repo/db/client'
import { eq, and } from 'drizzle-orm';

class PromptRegistry {
  private cache: Map<string, { value: PromptVersion; expires: number }>
  private ttl: number
  private db: DatabaseInstance
  constructor(db: DatabaseInstance, ttlMs = 30000) {
    this.db = db
    this.ttl = ttlMs
    this.cache = new Map()
  }
  private now() {
    return Date.now()
  }
  private key(k: string, v: string) {
    return `${k}:${v}`
  }
  async get(promptKey: string, version = 'active'): Promise<PromptVersion> {
    const cacheKey = this.key(promptKey, version)
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expires > this.now()) return cached.value
    const row = await this.fetchFromDb(promptKey, version)
    if (!row) throw new Error('Prompt not found')
    this.cache.set(cacheKey, { value: row, expires: this.now() + this.ttl })
    return row
  }
  private async fetchFromDb(promptKey: string, version: string) {
    if (version && version !== 'active') {
      const rows = await this.db
        .select()
        .from(promptDefinition)
        // Corrected line:
        .where(and(eq(promptDefinition.promptKey, promptKey), eq(promptDefinition.version, version)))
        .limit(1)
      const row = rows[0] as unknown as PromptVersion
      if (!row) return undefined; // Handle case where no row is found
      const augmented: CompileCapablePromptVersion = {
        ...row,
        compile: <O = unknown>(placeholders: Record<string, unknown>) =>
          new PromptBuilder(row).compile<O>(placeholders),
      }
      return augmented
    }
    const rows = await this.db
      .select()
      .from(promptDefinition)
      .where(and(eq(promptDefinition.promptKey, promptKey), eq(promptDefinition.isActive, true)))
      .limit(1)
    const row = rows[0] as unknown as PromptVersion
    if (!row) return undefined;
    const augmented: CompileCapablePromptVersion = {
      ...row,
      compile: <O = unknown>(placeholders: Record<string, unknown>) =>
        new PromptBuilder(row).compile<O>(placeholders),
    }
    return augmented
  }

  private augment(row: PromptVersion): CompileCapablePromptVersion {
    return {
      ...row,
      compile: <O = unknown>(placeholders: Record<string, unknown>) =>
        new PromptBuilder(row).compile<O>(placeholders),
    }
  }

  async create(
    data: Partial<Omit<NewPromptDefinition, 'id' | 'createdAt'>> & { activate?: boolean } = {},
  ): Promise<CompileCapablePromptVersion> {
    const { activate = true, ...values } = data as Omit<NewPromptDefinition, 'id' | 'createdAt'> & { activate?: boolean };
    
    if (!values.promptKey || !values.version) {
        throw new Error('Prompt key and version are required to create a prompt.');
    }

    await this.db.transaction(async (tx) => {
      if (activate) {
        await tx
          .update(promptDefinition)
          .set({ isActive: false })
          .where(eq(promptDefinition.promptKey, values.promptKey!))
      }
      await tx.insert(promptDefinition).values({ ...values, isActive: activate } as NewPromptDefinition)
    })
    const row = await this.fetchFromDb(values.promptKey, values.version)
    if (!row) throw new Error('Prompt creation failed: Could not retrieve the prompt after insertion.')
    this.cache.set(this.key(values.promptKey, values.version), { value: row, expires: this.now() + this.ttl })
    if (activate) {
      this.cache.set(this.key(values.promptKey, 'active'), { value: row, expires: this.now() + this.ttl })
    }
    return this.augment(row)
  }

  async createNewVersion(
    promptKey: string,
    data: Omit<NewPromptDefinition, 'id' | 'createdAt' | 'promptKey'> & { activate?: boolean },
  ): Promise<CompileCapablePromptVersion> {
    return this.create({ ...data, promptKey })
  }
}

export const createPromptRegistry = ({ db }: { db: DatabaseInstance }) => new PromptRegistry(db)
export type { PromptVersion }