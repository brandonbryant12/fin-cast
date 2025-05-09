import { relations } from 'drizzle-orm';
import { pgTable, text, uuid, integer, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-valibot';
import * as v from 'valibot';

import { user } from './auth';

export const reviewContentTypeEnum = pgEnum('review_content_type', ['podcast', 'app']);

export const review = pgTable('review', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id').notNull(),
  contentType: reviewContentTypeEnum('content_type').notNull().default('podcast'),
  stars: integer('stars').notNull(),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => ({
    entityIdx: uniqueIndex('review_entity_idx').on(table.entityId, table.contentType, table.userId),
}));

export const reviewRelations = relations(review, ({ one }) => ({
  user: one(user, {
    fields: [review.userId],
    references: [user.id],
  }),
}));

export const SelectReview = createSelectSchema(review);
export const CreateReview = v.omit(
  createInsertSchema(review, {
    stars: v.pipe(v.number(), v.minValue(1), v.maxValue(5)),
    feedback: v.optional(v.pipe(v.string(), v.maxLength(400))),
  }),
  ['id', 'createdAt', 'updatedAt', 'userId'],
);

export type Review = v.InferInput<typeof SelectReview>;
export type NewReview = v.InferInput<typeof CreateReview>;