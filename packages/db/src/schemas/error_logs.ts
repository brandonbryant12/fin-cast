import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-valibot";

import { user } from "./auth";

export const errorLog = pgTable("error_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  message: text("message").notNull(),
  stack: text("stack"),
  statusCode: integer("status_code").notNull(),
  path: text("path"),
  method: text("method"),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const SelectErrorLog = createSelectSchema(errorLog);
export const InsertErrorLog = createInsertSchema(errorLog);