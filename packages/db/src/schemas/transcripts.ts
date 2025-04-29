import { relations } from 'drizzle-orm';
import { jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
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
    .unique(),
  content: jsonb('content').notNull(),
  format: transcriptFormatEnum('format').default('plain_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const transcriptRelations = relations(transcript, ({ one }) => ({
  podcast: one(podcast, {
    fields: [transcript.podcastId],
    references: [podcast.id],
  }),
}));

export const Transcript = createSelectSchema(transcript);
export const NewTranscript = createInsertSchema(transcript); 