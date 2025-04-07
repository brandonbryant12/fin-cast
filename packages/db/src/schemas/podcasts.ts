import { sql } from 'drizzle-orm';
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-valibot';

import { user } from './auth';

export const podcastStatusEnum = pgEnum('podcast_status', [
  'processing',
  'failed',
  'success',
]);

export const podcast = pgTable('podcast', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 256 }).notNull(),
  description: text('description'),
  status: podcastStatusEnum('status').notNull().default('processing'),
  sourceType: text('source_type'), // e.g., 'url', 'account_summary'
  sourceDetail: text('source_detail'), // e.g., the source URL
  audioUrl: text('audio_url'), // Can store URL or potentially base64 string
  durationSeconds: integer('duration_seconds'),
  errorMessage: text('error_message'),
  generatedAt: timestamp('generated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()), // Ensure this updates on modification
});

export const Podcast = createSelectSchema(podcast);
export const NewPodcast = createInsertSchema(podcast); 