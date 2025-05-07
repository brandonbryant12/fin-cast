import { PromptBuilder } from './prompt-builder'
import type { PromptVersion, CompileCapablePromptVersion } from './types'
import { promptDefinition, type NewPromptDefinition, type PromptDefinition } from '@repo/db/schema'
import type { DatabaseInstance } from '@repo/db/client'
import { eq, and, desc, max } from 'drizzle-orm'

class PromptRegistry {
  private db: DatabaseInstance
  constructor(db: DatabaseInstance) {
    this.db = db
  }

  async get(promptKey: string, version?: number): Promise<CompileCapablePromptVersion> {
    const row = await this.fetchFromDb(promptKey, version)
    if (!row) throw new Error(`Prompt not found for key "${promptKey}"`)
    return row
  }

  private async fetchFromDb(
    promptKey: string,
    version: number | undefined,
  ): Promise<CompileCapablePromptVersion | undefined> {
    let rows
    if (version === undefined) {
      rows = await this.db
        .select()
        .from(promptDefinition)
        .where(and(eq(promptDefinition.promptKey, promptKey), eq(promptDefinition.isActive, true)))
        .limit(1)
        .execute()
    } else {
      rows = await this.db
        .select()
        .from(promptDefinition)
        .where(and(eq(promptDefinition.promptKey, promptKey), eq(promptDefinition.version, version)))
        .limit(1)
        .execute()
    }
    const row = rows[0] as PromptDefinition | undefined
    return row ? this.augment(row) : undefined
  }

  private augment(row: PromptDefinition): CompileCapablePromptVersion {
    const base: PromptVersion = { ...row }
    return {
      ...base,
      compile: <O = unknown>(placeholders: Record<string, unknown>) =>
        new PromptBuilder(base).compile<O>(placeholders),
    }
  }

  async create(
    data: Omit<NewPromptDefinition, 'id' | 'createdAt' | 'isActive'> & { version: number; activate?: boolean },
  ): Promise<CompileCapablePromptVersion> {
    const { activate = true, ...values } = data
    if (!values.promptKey || values.version < 1) throw new Error('invalid prompt key or version')
    await this.db.transaction(async (tx) => {
      if (activate) {
        await tx.update(promptDefinition).set({ isActive: false }).where(eq(promptDefinition.promptKey, values.promptKey))
      }
      await tx.insert(promptDefinition).values({ ...values, isActive: activate } as NewPromptDefinition)
    })
    const row = await this.fetchFromDb(values.promptKey, values.version)
    if (!row) throw new Error('failed to create prompt')
    return row
  }

  async createNewVersion(
    promptKey: string,
    data: Omit<NewPromptDefinition, 'id' | 'createdAt' | 'promptKey' | 'version' | 'isActive'> & { activate?: boolean },
  ): Promise<CompileCapablePromptVersion> {
    const latest = await this.db
      .select({ value: max(promptDefinition.version) })
      .from(promptDefinition)
      .where(eq(promptDefinition.promptKey, promptKey))
      .execute()
    const nextVersion = (latest[0]?.value ?? 0) + 1
    return this.create({ ...data, promptKey, version: nextVersion, activate: data.activate })
  }

  async listAll(): Promise<CompileCapablePromptVersion[]> {
    const rows = await this.db
      .select()
      .from(promptDefinition)
      .where(eq(promptDefinition.isActive, true))
      .orderBy(promptDefinition.promptKey)
    return rows.map((r) => this.augment(r as PromptDefinition))
  }

  async listAllByPromptKey(promptKey: string): Promise<CompileCapablePromptVersion[]> {
    const rows = await this.db
      .select()
      .from(promptDefinition)
      .where(eq(promptDefinition.promptKey, promptKey))
      .orderBy(promptDefinition.createdAt)
    return rows.map((r) => this.augment(r as PromptDefinition))
  }

  async getDetails(promptKey: string, version?: number): Promise<PromptVersion | null> {
    const row = await this.fetchFromDb(promptKey, version)
    return row ?? null
  }

  async setActive(promptKey: string, version: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(promptDefinition).set({ isActive: false }).where(eq(promptDefinition.promptKey, promptKey))
      const res = await tx
        .update(promptDefinition)
        .set({ isActive: true })
        .where(and(eq(promptDefinition.promptKey, promptKey), eq(promptDefinition.version, version)))
        .returning({ id: promptDefinition.id })
      if (res.length === 0) throw new Error('prompt not found')
    })
  }
}

export const createPromptRegistry = ({ db }: { db: DatabaseInstance }) => new PromptRegistry(db)
export type { PromptRegistry, PromptVersion, CompileCapablePromptVersion }