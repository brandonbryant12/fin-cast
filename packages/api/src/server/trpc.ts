import { handleError } from "@repo/errors";
import { initTRPC, TRPCError } from '@trpc/server';
import SuperJSON from 'superjson';
import type { AuthInstance } from '@repo/auth/server';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';

export interface CreateContextOptions {
  auth: AuthInstance;
  db: DatabaseInstance;
  headers: Headers;
  logger: AppLogger;
}

export interface TRPCContext {
  db: DatabaseInstance;
  session: AuthInstance['$Infer']['Session'] | null;
  logger: AppLogger;
  isAdmin: boolean;
}

export const createTRPCContext = async ({
  auth,
  db,
  headers,
  logger,
}: CreateContextOptions): Promise<TRPCContext> => {
  const session = await auth.api.getSession({
    headers,
  });

  let isAdmin = false;
  if (session?.user) {
    try {
      const userResult = await db.query.user.findFirst({
        where: (users, { eq }) => eq(users.id, session.user.id),
        columns: { isAdmin: true },
      });
      isAdmin = userResult?.isAdmin ?? false;
    } catch (error) {
      logger.error({ err: error, userId: session.user.id }, "Failed to fetch user admin status during context creation");
      isAdmin = false;
    }
  }

  return {
    db,
    session,
    logger,
    isAdmin,
  };
};

export const t = initTRPC.context<TRPCContext>().create({
  transformer: SuperJSON,
});

export const router = t.router;

const mapStatusToTRPCCode = (status: number): TRPCError['code'] => {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    default:  return 'INTERNAL_SERVER_ERROR';
  }
};

const timingMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const start = Date.now();
  const result = await next();
  const end = Date.now();
  const durationMs = end - start;

  const logPayload: { path: string; durationMs: number; } = {
    path,
    durationMs,
  };

  ctx.logger.info(logPayload, `[TRPC] /${path} executed.`);

  return result;
});

const errorHandlingMiddleware = t.middleware(async ({ ctx, path, next }) => {
  try {
    return await next();
  } catch (err) {
    ctx.logger.error(JSON.stringify(err) + ' ERROR ');
    const { statusCode, message } = await handleError({
      error: err,
      logger: ctx.logger,
      db: ctx.db,
      path,
      userId: ctx.session?.user.id ?? null,
    });
    throw new TRPCError({
      code: mapStatusToTRPCCode(statusCode),
      message,
      cause: err instanceof Error ? err : undefined,
    });
  }
});

export const baseProcedure = t.procedure
  .use(timingMiddleware)
  .use(errorHandlingMiddleware);

export const publicProcedure = baseProcedure;

export const protectedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, session: { ...ctx.session } } });
});

const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires admin privileges' });
  }
  return next({ ctx: { ...ctx, session: ctx.session! } });
});

export const adminProcedure = protectedProcedure.use(enforceUserIsAdmin);