import { relations } from 'drizzle-orm';
import { pgTable, text, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-valibot';

import { podcast } from './podcasts';

export const tag = pgTable('tag', {
  podcastId: uuid('podcast_id')
    .notNull()
    .references(() => podcast.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.podcastId, table.tag] }),
  };
});

export const tagRelations = relations(tag, ({ one }) => ({
  podcast: one(podcast, {
    fields: [tag.podcastId],
    references: [podcast.id],
  }),
}));

export const Tag = createSelectSchema(tag);
export const NewTag = createInsertSchema(tag);