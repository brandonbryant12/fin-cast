import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-valibot';
import * as v from 'valibot';

import { user } from './auth';

export const promptDefinition = pgTable(
  'prompt_definitions',
  {
    id: serial('id').primaryKey(),
    promptKey: text('prompt_key').notNull(),
    version: varchar('version', { length: 255 }).notNull(),
    template: text('template').notNull(), // Handlebars / mustache etc.
    inputSchema: jsonb('input_schema').notNull(),
    userInstructions: text('user_instructions').notNull(),
    outputSchema: jsonb('output_schema').notNull(),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).notNull(),
    maxTokens: integer('max_tokens').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      promptKeyVersionUnique: unique('prompt_key_version_unique_idx').on(
        table.promptKey,
        table.version,
      ),
    };
  },
);

export const SelectPromptDefinition = createSelectSchema(promptDefinition);
export const InsertPromptDefinition = createInsertSchema(promptDefinition);

export type PromptDefinition = v.InferInput<typeof SelectPromptDefinition>;
export type NewPromptDefinition = v.InferInput<typeof InsertPromptDefinition>;