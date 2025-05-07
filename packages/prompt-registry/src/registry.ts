import { promptDefinition, user, type NewPromptDefinition, type PromptDefinition } from '@repo/db/schema';
import { eq, and, desc, max } from 'drizzle-orm';
import type { PromptVersion, CompileCapablePromptVersion } from './types';
import type { DatabaseInstance } from '@repo/db/client';
import { PromptBuilder } from './prompt-builder';

type PromptDefinitionWithCreatorDetails = PromptDefinition & {
  creatorName: string | null;
  creatorEmail: string | null;
};

class PromptRegistry {
  private db: DatabaseInstance;
  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  async get(promptKey: string, version?: number): Promise<CompileCapablePromptVersion> {
    const row = await this.fetchFromDbInternal(promptKey, version);
    if (!row) throw new Error(`Prompt not found for key "${promptKey}"`);
    return this.augment(row);
  }

  // Renamed to fetchFromDbInternal to avoid confusion with potential type conflicts,
  // and it returns the raw joined data structure.
  private async fetchFromDbInternal(
    promptKey: string,
    version: number | undefined,
  ): Promise<PromptDefinitionWithCreatorDetails | undefined> {
    const queryBase = this.db
      .select({
        // Explicitly list all fields from promptDefinition
        id: promptDefinition.id,
        promptKey: promptDefinition.promptKey,
        version: promptDefinition.version,
        template: promptDefinition.template,
        inputSchema: promptDefinition.inputSchema,
        userInstructions: promptDefinition.userInstructions,
        outputSchema: promptDefinition.outputSchema,
        temperature: promptDefinition.temperature,
        maxTokens: promptDefinition.maxTokens,
        isActive: promptDefinition.isActive,
        createdBy: promptDefinition.createdBy,
        createdAt: promptDefinition.createdAt,
        // Add user fields
        creatorName: user.name,
        creatorEmail: user.email,
      })
      .from(promptDefinition)
      .leftJoin(user, eq(promptDefinition.createdBy, user.id));

    let finalQuery;
    if (version === undefined) {
      finalQuery = queryBase
        .where(and(eq(promptDefinition.promptKey, promptKey), eq(promptDefinition.isActive, true)))
        .limit(1);
    } else {
      finalQuery = queryBase
        .where(and(eq(promptDefinition.promptKey, promptKey), eq(promptDefinition.version, version)))
        .limit(1);
    }

    const rows = await finalQuery.execute();
    return rows[0] as PromptDefinitionWithCreatorDetails | undefined;
  }

  // augment now takes PromptDefinitionWithCreatorDetails
  private augment(row: PromptDefinitionWithCreatorDetails): CompileCapablePromptVersion {
    const base: PromptVersion = { ...row };
    return {
      ...base,
      compile: <O = unknown>(placeholders: Record<string, unknown>) =>
        new PromptBuilder(base).compile<O>(placeholders),
    };
  }

  async create(
    data: Omit<NewPromptDefinition, 'id' | 'createdAt' | 'isActive'> & { version: number; activate?: boolean },
  ): Promise<CompileCapablePromptVersion> {
    const { activate = true, ...values } = data;
    if (!values.promptKey || values.version < 1) throw new Error('invalid prompt key or version');
    
    await this.db.transaction(async (tx) => {
      if (activate) {
        await tx.update(promptDefinition).set({ isActive: false }).where(eq(promptDefinition.promptKey, values.promptKey));
      }
      await tx.insert(promptDefinition).values({ ...values, isActive: activate } as NewPromptDefinition);
    });
    // Re-fetch to get the complete data including any joined fields like creatorName/Email
    const row = await this.fetchFromDbInternal(values.promptKey, values.version);
    if (!row) throw new Error('failed to create prompt or fetch after creation');
    return this.augment(row);
  }

  async createNewVersion(
    promptKey: string,
    data: Omit<NewPromptDefinition, 'id' | 'createdAt' | 'promptKey' | 'version' | 'isActive'> & { activate?: boolean },
  ): Promise<CompileCapablePromptVersion> {
    const latest = await this.db
      .select({ value: max(promptDefinition.version) })
      .from(promptDefinition)
      .where(eq(promptDefinition.promptKey, promptKey))
      .execute();
    const nextVersion = (latest[0]?.value ?? 0) + 1;
    
    // The create method will handle fetching and augmenting
    return this.create({ ...data, promptKey, version: nextVersion, activate: data.activate });
  }

  async listAll(): Promise<CompileCapablePromptVersion[]> {
    const rows = await this.db
      .select({
        id: promptDefinition.id,
        promptKey: promptDefinition.promptKey,
        version: promptDefinition.version,
        template: promptDefinition.template,
        inputSchema: promptDefinition.inputSchema,
        userInstructions: promptDefinition.userInstructions,
        outputSchema: promptDefinition.outputSchema,
        temperature: promptDefinition.temperature,
        maxTokens: promptDefinition.maxTokens,
        isActive: promptDefinition.isActive,
        createdBy: promptDefinition.createdBy,
        createdAt: promptDefinition.createdAt,
        creatorName: user.name,
        creatorEmail: user.email,
      })
      .from(promptDefinition)
      .leftJoin(user, eq(promptDefinition.createdBy, user.id))
      .where(eq(promptDefinition.isActive, true))
      .orderBy(promptDefinition.promptKey);
      
    return rows.map((r) => this.augment(r as PromptDefinitionWithCreatorDetails));
  }

  async listAllByPromptKey(promptKey: string): Promise<CompileCapablePromptVersion[]> {
    const rows = await this.db
      .select({
        id: promptDefinition.id,
        promptKey: promptDefinition.promptKey,
        version: promptDefinition.version,
        template: promptDefinition.template,
        inputSchema: promptDefinition.inputSchema,
        userInstructions: promptDefinition.userInstructions,
        outputSchema: promptDefinition.outputSchema,
        temperature: promptDefinition.temperature,
        maxTokens: promptDefinition.maxTokens,
        isActive: promptDefinition.isActive,
        createdBy: promptDefinition.createdBy,
        createdAt: promptDefinition.createdAt,
        creatorName: user.name,
        creatorEmail: user.email,
      })
      .from(promptDefinition)
      .leftJoin(user, eq(promptDefinition.createdBy, user.id))
      .where(eq(promptDefinition.promptKey, promptKey))
      .orderBy(promptDefinition.createdAt);
      
    return rows.map((r) => this.augment(r as PromptDefinitionWithCreatorDetails));
  }

  async getDetails(promptKey: string, version?: number): Promise<PromptVersion | null> {
    const row = await this.fetchFromDbInternal(promptKey, version);
    if (!row) return null;
    const augmentedRow = this.augment(row);
    const { compile, ...promptVersionData } = augmentedRow;
    return promptVersionData as PromptVersion;
  }

  async setActive(promptKey: string, version: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(promptDefinition).set({ isActive: false }).where(eq(promptDefinition.promptKey, promptKey));
      const res = await tx
        .update(promptDefinition)
        .set({ isActive: true })
        .where(and(eq(promptDefinition.promptKey, promptKey), eq(promptDefinition.version, version)))
        .returning({ id: promptDefinition.id });
      if (res.length === 0) throw new Error('prompt not found');
    });
  }
}

export const createPromptRegistry = ({ db }: { db: DatabaseInstance }) => new PromptRegistry(db);
export type { PromptRegistry, PromptVersion, CompileCapablePromptVersion };