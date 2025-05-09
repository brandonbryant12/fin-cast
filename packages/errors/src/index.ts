import type { DatabaseInstance } from "@repo/db/client";
import type { AppLogger } from "@repo/logger";
import * as schema from '@repo/db/schema';

/**
 * Base application error.  `isOperational=true` means the error is an
 * expected business case and should NOT be logged to the DB.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}
export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}
export class InternalServerError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500, false);
  }
}

/**
 * Extra context captured when persisting an error.
 */
export interface ErrorContext {
  path?: string;
  method?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Normalise any thrown value to { statusCode, message }
 * and optionally persist it into the database if it’s unexpected
 * or a 5xx condition.
 */
export async function handleError(
  params: {
    error: unknown;
    logger: AppLogger;
    db: DatabaseInstance;
  } & ErrorContext
): Promise<{ statusCode: number; message: string }> {
  const { error, logger, db, ...ctx } = params;

  let statusCode = 500;
  let message = "Unexpected error";

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  const shouldPersist = statusCode >= 500 || !(error instanceof AppError);

  logger.error({ err: error, ...ctx }, message);

  if (shouldPersist) {
    try {
      await db.insert(schema.errorLog).values({
        message,
        stack: error instanceof Error ? error.stack : null,
        statusCode,
        path: ctx.path,
        method: ctx.method,
        userId: ctx.userId ?? null,
        metadata: ctx.metadata ?? null,
      });
    } catch (dbErr) {
      logger.error({ err: dbErr }, "Failed to persist error_log record");
    }
  }

  return { statusCode, message };
}