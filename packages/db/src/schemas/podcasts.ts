import { relations } from 'drizzle-orm'; 
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
import { tag } from './tags';
import { transcript } from './transcripts';

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
  summary: text('summary').notNull(),
  description: text('description'),
  status: podcastStatusEnum('status').notNull().default('processing'),
  sourceType: text('source_type'),
  sourceDetail: text('source_detail'),
  audioUrl: text('audio_url'),
  durationSeconds: integer('duration_seconds'),
  errorMessage: text('error_message'),
  generatedAt: timestamp('generated_at'),
  hostPersonalityId: text('host_personality_id').notNull(),
  cohostPersonalityId: text('cohost_personality_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const podcastRelations = relations(podcast, ({ one, many }) => ({
  user: one(user, {
    fields: [podcast.userId],
    references: [user.id],
  }),
  transcript: one(transcript, {
    fields: [podcast.id],
    references: [transcript.podcastId],
  }),
  tags: many(tag),
}));

export const Podcast = createSelectSchema(podcast);
export const NewPodcast = createInsertSchema(podcast); 
