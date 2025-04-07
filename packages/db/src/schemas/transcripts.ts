import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-valibot';

import { podcast } from './podcasts';

export const transcriptFormatEnum = pgEnum('transcript_format', [
  'plain_text',
  'vtt',
  'json_timestamps',
]);

export const transcript = pgTable('transcript', {
  id: uuid('id').defaultRandom().primaryKey(),
  podcastId: uuid('podcast_id')
    .notNull()
    .references(() => podcast.id, { onDelete: 'cascade' })
    .unique(), // Enforce one-to-one relationship
  content: text('content').notNull(),
  format: transcriptFormatEnum('format').default('plain_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()), // Ensure this updates on modification
});

export const Transcript = createSelectSchema(transcript);
export const NewTranscript = createInsertSchema(transcript); 